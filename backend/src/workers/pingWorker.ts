import prisma from '../lib/prisma'
import { pingFast, ping } from '../lib/ping'
import eventEmitter from '../lib/eventEmitter'
import { sendNotifications } from '../lib/notifications'

const WARN_THRESHOLD_MS = 100
const FAIL_THRESHOLD = 2
const CHECK_INTERVAL_MS = 5000

interface NodeState {
  consecutiveFailures: number
  consecutiveWarnings: number
  lastStatus: string | null
  alarmId: number | null
}

const nodeStates = new Map<number, NodeState>()

async function checkNode(node: { id: number; ipAddress: string; monitoringInterval: number; status: string; name: string; deviceType: string; customerId: number; isMaintenance: boolean; monitorConfig: any }) {
  const state = nodeStates.get(node.id) || { consecutiveFailures: 0, consecutiveWarnings: 0, lastStatus: null, alarmId: null }

  if (node.monitoringInterval < CHECK_INTERVAL_MS / 1000) {
    return
  }

  // Use a 3-packet ping to measure packet loss and latency on every check interval
  const result = await ping(node.ipAddress, 3)

  // Check if node is under manual or scheduled maintenance window
  const now = new Date()
  const activeWindow = await prisma.maintenanceWindow.findFirst({
    where: {
      nodeId: node.id,
      startTime: { lte: now },
      endTime: { gte: now },
    }
  })
  const isUnderMaintenance = node.isMaintenance || !!activeWindow

  // Load custom warnings thresholds
  const config = (node.monitorConfig as any) || {}
  const latencyThreshold = config.latencyWarningMs || 150
  const packetLossThreshold = config.packetLossWarningPercent || 10

  let newStatus: string
  if (isUnderMaintenance) {
    newStatus = 'maintenance'
    state.consecutiveFailures = 0
    state.consecutiveWarnings = 0
  } else if (!result.alive) {
    state.consecutiveFailures++
    state.consecutiveWarnings = 0
    newStatus = state.consecutiveFailures >= FAIL_THRESHOLD ? 'down' : 'warning'
  } else {
    state.consecutiveFailures = 0
    const hasLatencyWarning = result.latencyMs !== null && result.latencyMs > latencyThreshold
    const hasPacketLossWarning = result.packetLoss > 0 && result.packetLoss >= packetLossThreshold

    if (hasLatencyWarning || hasPacketLossWarning) {
      state.consecutiveWarnings++
      newStatus = state.consecutiveWarnings >= 3 ? 'warning' : 'up'
    } else {
      state.consecutiveWarnings = 0
      newStatus = 'up'
    }
  }

  const changed = newStatus !== state.lastStatus

  // Since we already do a 3-packet check on every cycle, we don't need a redundant detailed ping on status change.
  const detail = result

  if (changed) {
    const prevStatus = state.lastStatus
    state.lastStatus = newStatus

    await prisma.node.update({
      where: { id: node.id },
      data: {
        status: newStatus,
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        packetLoss: detail.packetLoss,
        lastChecked: new Date(),
      },
    })

    const msg = isUnderMaintenance
      ? `Entered maintenance mode (scheduled or manual)`
      : newStatus === 'up'
        ? `Recovered (avg:${detail.avgLatency?.toFixed(0) || '?'}ms, loss:${detail.packetLoss}%)`
        : `${newStatus} (avg:${detail.avgLatency?.toFixed(0) || '?'}ms, loss:${detail.packetLoss}%)`

    await prisma.eventLog.create({
      data: {
        nodeId: node.id,
        eventType: newStatus,
        message: msg,
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        packetLoss: detail.packetLoss,
      },
    })

    if (newStatus === 'down') {
      const alarm = await prisma.alarm.create({
        data: { nodeId: node.id, status: 'active', startTime: new Date() },
      })
      state.alarmId = alarm.id
      eventEmitter.emit('alarm:created', alarm)
      sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'down', deviceType: node.deviceType }).catch(() => {})
    }

    if (newStatus === 'warning') {
      sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'warning', deviceType: node.deviceType }).catch(() => {})
    }

    if ((newStatus === 'up' || newStatus === 'maintenance') && state.alarmId) {
      const alarmRecord = await prisma.alarm.findUnique({ where: { id: state.alarmId } })
      const endTime = new Date()
      let duration: number | undefined
      if (alarmRecord) {
        duration = Math.floor((endTime.getTime() - alarmRecord.startTime.getTime()) / 1000)
      }

      const alarm = await prisma.alarm.update({
        where: { id: state.alarmId },
        data: {
          status: 'resolved',
          endTime,
          duration,
          recoveryNote: newStatus === 'maintenance' ? 'Entered maintenance mode' : undefined,
        },
      })
      eventEmitter.emit('alarm:resolved', alarm)
      state.alarmId = null
    }

    if (newStatus === 'up' && (prevStatus === 'down' || prevStatus === 'warning')) {
      sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'up', deviceType: node.deviceType }).catch(() => {})
    }

    eventEmitter.emit('node:status', {
      nodeId: node.id,
      status: newStatus,
      latencyMs: detail.avgLatency,
      packetLoss: detail.packetLoss,
      lastChecked: new Date(),
    })
  } else {
    await prisma.node.update({
      where: { id: node.id },
      data: {
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        packetLoss: detail.packetLoss,
        lastChecked: new Date(),
      },
    })
  }

  nodeStates.set(node.id, state)
}

export async function startPingWorker() {
  console.log('[PingWorker] Starting monitoring loop...')

  const run = async () => {
    try {
      const nodes = await prisma.node.findMany({
        where: { enabled: true },
        select: { id: true, ipAddress: true, monitoringInterval: true, status: true, name: true, deviceType: true, customerId: true, isMaintenance: true, monitorConfig: true },
      })

      for (const node of nodes) {
        const intervalMs = node.monitoringInterval * 1000
        if (intervalMs <= CHECK_INTERVAL_MS || Math.random() < intervalMs / (CHECK_INTERVAL_MS * nodes.length * 0.1)) {
          checkNode(node).catch((err) => console.error(`[PingWorker] Error checking ${node.name}:`, err))
        }
      }
    } catch (err) {
      console.error('[PingWorker] Error:', err)
    }
  }

  await run()
  setInterval(run, CHECK_INTERVAL_MS)
}
