import prisma from '../lib/prisma'
import { pingFast, ping } from '../lib/ping'
import eventEmitter from '../lib/eventEmitter'
import { sendNotifications } from '../lib/notifications'
import { detectNodeAnomalies } from '../lib/anomalyDetector'

const WARN_THRESHOLD_MS = 100
const FAIL_THRESHOLD = 2
const CHECK_INTERVAL_MS = 5000
const FLAPPING_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const FLAPPING_THRESHOLD = 3 // 3 status transitions in 5 mins
const STABLE_RECOVERY_CHECKS = 5 // 5 consecutive checks to clear flapping

interface NodeState {
  consecutiveFailures: number
  consecutiveWarnings: number
  lastStatus: string | null
  alarmId: number | null
  statusHistory: Array<{ status: string; timestamp: number }>
  isFlapping: boolean
  stableCheckCount: number
  flappingAlarmId: number | null
}

const nodeStates = new Map<number, NodeState>()

async function checkNode(node: { id: number; ipAddress: string; monitoringInterval: number; status: string; name: string; deviceType: string; customerId: number; isMaintenance: boolean; monitorConfig: any }) {
  const state = nodeStates.get(node.id) || {
    consecutiveFailures: 0,
    consecutiveWarnings: 0,
    lastStatus: null,
    alarmId: null,
    statusHistory: [],
    isFlapping: false,
    stableCheckCount: 0,
    flappingAlarmId: null,
  }

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

  const rawStatus = newStatus
  const changed = rawStatus !== state.lastStatus
  const detail = result
  const nowTs = Date.now()

  if (changed) {
    state.statusHistory.push({ status: rawStatus, timestamp: nowTs })
  }

  // Filter history to last 5 minutes
  state.statusHistory = state.statusHistory.filter(h => nowTs - h.timestamp <= FLAPPING_WINDOW_MS)

  let effectiveStatus = rawStatus

  // Check for Flapping state
  if (state.statusHistory.length >= FLAPPING_THRESHOLD && !state.isFlapping && !isUnderMaintenance) {
    state.isFlapping = true
    state.stableCheckCount = 0
    effectiveStatus = 'flapping'

    // Create a Flapping Alarm
    const alarm = await prisma.alarm.create({
      data: {
        nodeId: node.id,
        status: 'active',
        startTime: new Date(),
        cause: `Flapping Link: Node status toggled ${state.statusHistory.length} times in 5 minutes (Jitter: ${detail.jitterMs?.toFixed(1) || 0}ms)`
      }
    })
    state.flappingAlarmId = alarm.id
    eventEmitter.emit('alarm:created', alarm)

    sendNotifications({
      nodeName: node.name,
      nodeIp: node.ipAddress,
      status: 'warning',
      deviceType: node.deviceType,
    }).catch(() => {})
  } else if (state.isFlapping) {
    if (!changed) {
      state.stableCheckCount++
    } else {
      state.stableCheckCount = 0
    }

    if (state.stableCheckCount >= STABLE_RECOVERY_CHECKS) {
      // Link stabilized!
      state.isFlapping = false
      effectiveStatus = rawStatus

      if (state.flappingAlarmId) {
        const alarmRecord = await prisma.alarm.findUnique({ where: { id: state.flappingAlarmId } })
        const endTime = new Date()
        let duration: number | undefined
        if (alarmRecord) {
          duration = Math.floor((endTime.getTime() - alarmRecord.startTime.getTime()) / 1000)
        }
        const resolvedAlarm = await prisma.alarm.update({
          where: { id: state.flappingAlarmId },
          data: {
            status: 'resolved',
            endTime,
            duration,
            recoveryNote: `Link stabilized after flapping (status: ${rawStatus.toUpperCase()})`
          }
        })
        eventEmitter.emit('alarm:resolved', resolvedAlarm)
        state.flappingAlarmId = null
      }
    } else {
      effectiveStatus = 'flapping'
    }
  }

  if (changed || effectiveStatus !== node.status) {
    const prevStatus = state.lastStatus
    state.lastStatus = rawStatus

    await prisma.node.update({
      where: { id: node.id },
      data: {
        status: effectiveStatus,
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        jitterMs: detail.jitterMs,
        packetLoss: detail.packetLoss,
        lastChecked: new Date(),
      },
    })

    const msg = isUnderMaintenance
      ? `Entered maintenance mode`
      : effectiveStatus === 'flapping'
        ? `Flapping link detected (${state.statusHistory.length} toggles in 5m, jitter: ${detail.jitterMs?.toFixed(1) || 0}ms)`
        : rawStatus === 'up'
          ? `Recovered (avg:${detail.avgLatency?.toFixed(0) || '?'}ms, jitter:${detail.jitterMs?.toFixed(1) || 0}ms, loss:${detail.packetLoss}%)`
          : `${rawStatus} (avg:${detail.avgLatency?.toFixed(0) || '?'}ms, loss:${detail.packetLoss}%)`

    await prisma.eventLog.create({
      data: {
        nodeId: node.id,
        eventType: effectiveStatus,
        message: msg,
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        jitterMs: detail.jitterMs,
        packetLoss: detail.packetLoss,
      },
    })

    if (rawStatus === 'down' && !state.isFlapping) {
      const parentDownCheck = await isParentDown(node.id)
      let causeText = undefined
      let shouldAlert = true

      if (parentDownCheck && parentDownCheck.isDown) {
        causeText = `Suppressed: Parent POP [${parentDownCheck.parentName}] is Down`
        shouldAlert = false
      }

      if (!state.alarmId) {
        const alarm = await prisma.alarm.create({
          data: { 
            nodeId: node.id, 
            status: 'active', 
            startTime: new Date(),
            cause: causeText
          },
        })
        state.alarmId = alarm.id
        eventEmitter.emit('alarm:created', alarm)
      }

      if (shouldAlert) {
        sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'down', deviceType: node.deviceType }).catch(() => {})
      }
    }

    if (rawStatus === 'warning' && !state.isFlapping) {
      sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'warning', deviceType: node.deviceType }).catch(() => {})
    }

    if ((rawStatus === 'up' || isUnderMaintenance) && state.alarmId && !state.isFlapping) {
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
          recoveryNote: isUnderMaintenance ? 'Entered maintenance mode' : undefined,
        },
      })
      eventEmitter.emit('alarm:resolved', alarm)
      state.alarmId = null
    }

    if (rawStatus === 'up' && (prevStatus === 'down' || prevStatus === 'warning') && !state.isFlapping) {
      sendNotifications({ nodeName: node.name, nodeIp: node.ipAddress, status: 'up', deviceType: node.deviceType }).catch(() => {})
    }

    eventEmitter.emit('node:status', {
      nodeId: node.id,
      status: effectiveStatus,
      latencyMs: detail.avgLatency,
      jitterMs: detail.jitterMs,
      packetLoss: detail.packetLoss,
      lastChecked: new Date(),
    })

    const dbNode = await prisma.node.findUnique({ where: { id: node.id }, select: { parentId: true } })
    if (dbNode?.parentId) {
      await updateParentStatus(dbNode.parentId)
    }
  } else {
    await prisma.node.update({
      where: { id: node.id },
      data: {
        latencyMs: detail.avgLatency,
        minLatencyMs: detail.minLatency,
        maxLatencyMs: detail.maxLatency,
        jitterMs: detail.jitterMs,
        packetLoss: detail.packetLoss,
        lastChecked: new Date(),
      },
    })
  }

  // AI Anomaly & Slow Degradation Detection
  if (!isUnderMaintenance && detail.alive) {
    const anomaly = detectNodeAnomalies(node.id, detail.avgLatency, detail.jitterMs)
    if (anomaly.isAnomaly) {
      await prisma.anomalyLog.create({
        data: {
          nodeId: node.id,
          anomalyType: anomaly.type || 'latency_spike',
          severity: anomaly.severity || 'warning',
          zScore: anomaly.zScore,
          currentValue: anomaly.currentValue,
          baselineAvg: anomaly.baselineAvg,
          message: anomaly.message || `AI Anomaly detected (Z-Score: ${anomaly.zScore})`,
        }
      })
      eventEmitter.emit('node:anomaly', {
        nodeId: node.id,
        nodeName: node.name,
        ...anomaly,
      })
    }
  }

  nodeStates.set(node.id, state)
}

async function updateParentStatus(parentId: number) {
  try {
    const children = await prisma.node.findMany({
      where: { parentId, enabled: true },
      select: { status: true }
    })

    if (children.length === 0) {
      await prisma.node.update({
        where: { id: parentId },
        data: { status: 'unknown' }
      })
      return
    }

    let newStatus = 'up'
    const statuses = children.map(c => c.status)

    if (statuses.includes('down')) {
      const allDown = statuses.every(s => s === 'down')
      newStatus = allDown ? 'down' : 'warning'
    } else if (statuses.includes('warning')) {
      newStatus = 'warning'
    } else if (statuses.includes('maintenance')) {
      const allMaint = statuses.every(s => s === 'maintenance' || s === 'unknown')
      if (allMaint) newStatus = 'maintenance'
    }

    const parentNode = await prisma.node.findUnique({
      where: { id: parentId },
      select: { id: true, status: true, parentId: true }
    })

    if (parentNode && parentNode.status !== newStatus) {
      await prisma.node.update({
        where: { id: parentId },
        data: { status: newStatus, lastChecked: new Date() }
      })

      eventEmitter.emit('node:status', {
        nodeId: parentId,
        status: newStatus,
        lastChecked: new Date()
      })

      if (parentNode.parentId) {
        await updateParentStatus(parentNode.parentId)
      }
    }
  } catch (err) {
    console.error('[PingWorker] Error updating parent status:', err)
  }
}

export async function startPingWorker() {
  console.log('[PingWorker] Starting monitoring loop...')

  const run = async () => {
    try {
      const nodes = await prisma.node.findMany({
        where: { enabled: true, NOT: { deviceType: 'pop' } },
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

async function isParentDown(nodeId: number): Promise<{ isDown: boolean; parentName?: string } | null> {
  let currentId = nodeId
  while (true) {
    const node = await prisma.node.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    })
    if (!node || !node.parentId) {
      return null
    }

    const parent = await prisma.node.findUnique({
      where: { id: node.parentId },
      select: { id: true, name: true, status: true }
    })

    if (!parent) return null
    if (parent.status === 'down') {
      return { isDown: true, parentName: parent.name }
    }
    currentId = parent.id
  }
}
