import prisma from '../lib/prisma'
import { pingFast, ping } from '../lib/ping'
import eventEmitter from '../lib/eventEmitter'
import { sendNotifications } from '../lib/notifications'

const WARN_THRESHOLD_MS = 100
const FAIL_THRESHOLD = 2
const CHECK_INTERVAL_MS = 5000

interface NodeState {
  consecutiveFailures: number
  lastStatus: string | null
  alarmId: number | null
}

const nodeStates = new Map<number, NodeState>()

async function checkNode(node: { id: number; ipAddress: string; monitoringInterval: number; status: string; name: string; deviceType: string; customerId: number }) {
  const state = nodeStates.get(node.id) || { consecutiveFailures: 0, lastStatus: null, alarmId: null }

  if (node.monitoringInterval < CHECK_INTERVAL_MS / 1000) {
    return
  }

  const result = await pingFast(node.ipAddress)

  let newStatus: string
  if (!result.alive) {
    state.consecutiveFailures++
    newStatus = state.consecutiveFailures >= FAIL_THRESHOLD ? 'down' : 'warning'
  } else if (result.latencyMs && result.latencyMs > WARN_THRESHOLD_MS) {
    state.consecutiveFailures = 0
    newStatus = 'warning'
  } else {
    state.consecutiveFailures = 0
    newStatus = 'up'
  }

  const changed = newStatus !== state.lastStatus

  // For status changes, run a detailed multi-ping for richer data
  let detail = result
  if (changed) {
    detail = await ping(node.ipAddress, 4)
  }

  if (changed) {
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

    const msg = newStatus === 'up'
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

    if (newStatus === 'up' && state.alarmId) {
      const alarm = await prisma.alarm.update({
        where: { id: state.alarmId },
        data: { status: 'resolved', endTime: new Date() },
      })
      eventEmitter.emit('alarm:resolved', alarm)
      state.alarmId = null
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
        select: { id: true, ipAddress: true, monitoringInterval: true, status: true, name: true, deviceType: true, customerId: true },
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
