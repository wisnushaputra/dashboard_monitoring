import prisma from '../lib/prisma'
import { ping } from '../lib/ping'
import eventEmitter from '../lib/eventEmitter'

const WARN_THRESHOLD_MS = 100
const FAIL_THRESHOLD = 2
const CHECK_INTERVAL_MS = 5000

interface NodeState {
  consecutiveFailures: number
  lastStatus: string | null
  alarmId: number | null
}

const nodeStates = new Map<number, NodeState>()

async function checkNode(node: { id: number; ipAddress: string; monitoringInterval: number; status: string; name: string }) {
  const state = nodeStates.get(node.id) || { consecutiveFailures: 0, lastStatus: null, alarmId: null }

  if (node.monitoringInterval < CHECK_INTERVAL_MS / 1000) {
    return
  }

  const result = await ping(node.ipAddress)

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

  if (changed) {
    state.lastStatus = newStatus

    // Update node status in DB
    await prisma.node.update({
      where: { id: node.id },
      data: { status: newStatus, latencyMs: result.latencyMs, lastChecked: new Date() },
    })

    // Log event
    await prisma.eventLog.create({
      data: {
        nodeId: node.id,
        eventType: newStatus,
        message: `Node ${newStatus === 'up' ? 'recovered' : 'went ' + newStatus} (${result.latencyMs || 'N/A'}ms)`,
        latencyMs: result.latencyMs,
      },
    })

    // Handle alarms
    if (newStatus === 'down') {
      const alarm = await prisma.alarm.create({
        data: { nodeId: node.id, status: 'active', startTime: new Date() },
      })
      state.alarmId = alarm.id
      eventEmitter.emit('alarm:created', alarm)
    }

    if (newStatus === 'up' && state.alarmId) {
      const alarm = await prisma.alarm.update({
        where: { id: state.alarmId },
        data: { status: 'resolved', endTime: new Date() },
      })
      eventEmitter.emit('alarm:resolved', alarm)
      state.alarmId = null
    }

    // Emit status change
    eventEmitter.emit('node:status', {
      nodeId: node.id,
      status: newStatus,
      latencyMs: result.latencyMs,
      lastChecked: new Date(),
    })
  } else {
    // Still update latency and lastChecked periodically
    await prisma.node.update({
      where: { id: node.id },
      data: { latencyMs: result.latencyMs, lastChecked: new Date() },
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
        select: { id: true, ipAddress: true, monitoringInterval: true, status: true, name: true },
      })

      for (const node of nodes) {
        const intervalMs = node.monitoringInterval * 1000
        // Only check nodes whose interval has elapsed since last check
        if (intervalMs <= CHECK_INTERVAL_MS || Math.random() < intervalMs / (CHECK_INTERVAL_MS * nodes.length * 0.1)) {
          checkNode(node).catch((err) => console.error(`[PingWorker] Error checking ${node.name}:`, err))
        }
      }
    } catch (err) {
      console.error('[PingWorker] Error:', err)
    }
  }

  // Run immediately then every CHECK_INTERVAL_MS
  await run()
  setInterval(run, CHECK_INTERVAL_MS)
}
