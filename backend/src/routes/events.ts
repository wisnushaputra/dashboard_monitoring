import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  const { nodeId, eventType, startDate, endDate, search, page = '1', limit = '100' } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const take = parseInt(limit as string)

  const where: any = {}
  if (nodeId) where.nodeId = parseInt(nodeId as string)
  if (eventType) where.eventType = eventType
  if (startDate || endDate) {
    where.timestamp = {}
    if (startDate) where.timestamp.gte = new Date(startDate as string)
    if (endDate) where.timestamp.lte = new Date(endDate as string)
  }
  if (search) {
    where.node = { name: { contains: search as string, mode: 'insensitive' } }
  }

  const [events, total] = await Promise.all([
    prisma.eventLog.findMany({
      where,
      include: { node: { select: { name: true, ipAddress: true, deviceType: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take,
    }),
    prisma.eventLog.count({ where }),
  ])

  res.json({ events, total, page: parseInt(page as string), limit: take })
})

// Dashboard summary
router.get('/summary', async (req: Request, res: Response) => {
  const now = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(now.getDate() - 7)
  const totalPeriodSeconds = 7 * 24 * 3600

  const [totalSites, totalNodes, onlineNodes, maintenanceNodes, activeAlarms, recentEvents, allNodes, allAlarms] = await Promise.all([
    prisma.site.count(),
    prisma.node.count(),
    prisma.node.count({ where: { status: 'up' } }),
    prisma.node.count({ where: { status: 'maintenance' } }),
    prisma.alarm.count({ where: { status: 'active' } }),
    prisma.eventLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: { node: { select: { name: true, deviceType: true } } },
    }),
    prisma.node.findMany({
      select: {
        id: true,
        name: true,
        ipAddress: true,
        deviceType: true,
        status: true,
        latencyMs: true,
        packetLoss: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.alarm.findMany({
      where: {
        startTime: { lte: now },
        OR: [
          { endTime: { gte: sevenDaysAgo } },
          { endTime: null },
        ],
      },
    }),
  ])

  // Group alarms by nodeId in memory
  const alarmsByNode: Record<number, typeof allAlarms> = {}
  allAlarms.forEach((alarm) => {
    if (!alarmsByNode[alarm.nodeId]) {
      alarmsByNode[alarm.nodeId] = []
    }
    alarmsByNode[alarm.nodeId].push(alarm)
  })

  // Calculate availability for each node
  const nodesStats = allNodes.map((node) => {
    const nodeAlarms = alarmsByNode[node.id] || []
    let downtimeSeconds = 0

    nodeAlarms.forEach((alarm) => {
      const alarmStart = Math.max(new Date(alarm.startTime).getTime(), sevenDaysAgo.getTime())
      const alarmEnd = Math.min((alarm.endTime ? new Date(alarm.endTime) : now).getTime(), now.getTime())
      const overlap = (alarmEnd - alarmStart) / 1000
      if (overlap > 0) {
        downtimeSeconds += overlap
      }
    })

    const availability = Math.max(0, Math.min(100, ((totalPeriodSeconds - downtimeSeconds) / totalPeriodSeconds) * 100))

    return {
      ...node,
      availability: Math.round(availability * 100) / 100,
      downtimeSeconds,
    }
  })

  // Calculate 24-hour incident trend (Down & Warning Alert Counts)
  const incidentTrend: Array<{ timestamp: number; hour: string; down: number; warning: number }> = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    const hourLabel = `${String(d.getHours()).padStart(2, '0')}:00`
    incidentTrend.push({
      timestamp: d.getTime(),
      hour: hourLabel,
      down: 0,
      warning: 0
    })
  }

  const trendStartTime = incidentTrend[0].timestamp
  const recentEventLogs = await prisma.eventLog.findMany({
    where: {
      timestamp: { gte: new Date(trendStartTime) },
      eventType: { in: ['down', 'warning'] }
    },
    select: {
      timestamp: true,
      eventType: true
    }
  })

  recentEventLogs.forEach(log => {
    const logMs = new Date(log.timestamp).getTime()
    const hourMs = 60 * 60 * 1000
    const index = Math.floor((logMs - trendStartTime) / hourMs)
    if (index >= 0 && index < 24) {
      if (log.eventType === 'down') {
        incidentTrend[index].down++
      } else if (log.eventType === 'warning') {
        incidentTrend[index].warning++
      }
    }
  })

  // Calculate Customer SLA Leaderboard (Last 30 Days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const total30DaysSeconds = 30 * 24 * 3600

  // Fetch all customers with their nodes
  const allCustomers = await prisma.customer.findMany({
    include: {
      nodes: {
        select: {
          id: true,
          enabled: true
        }
      }
    }
  })

  // Fetch all alarms in the last 30 days
  const alarms30Days = await prisma.alarm.findMany({
    where: {
      startTime: { lte: now },
      OR: [
        { endTime: { gte: thirtyDaysAgo } },
        { endTime: null }
      ]
    }
  })

  // Group alarms by nodeId in memory
  const alarmsByNode30Days: Record<number, typeof alarms30Days> = {}
  alarms30Days.forEach(alarm => {
    if (!alarmsByNode30Days[alarm.nodeId]) {
      alarmsByNode30Days[alarm.nodeId] = []
    }
    alarmsByNode30Days[alarm.nodeId].push(alarm)
  })

  // Compute availability for each customer
  const customerSla = allCustomers.map(cust => {
    const activeNodes = cust.nodes.filter(n => n.enabled)
    if (activeNodes.length === 0) {
      return {
        id: cust.id,
        name: cust.name,
        code: cust.code,
        sla: 100
      }
    }

    let totalSlaSum = 0
    activeNodes.forEach(node => {
      const nodeAlarms = alarmsByNode30Days[node.id] || []
      let downtimeSeconds = 0

      nodeAlarms.forEach(alarm => {
        const alarmStart = Math.max(new Date(alarm.startTime).getTime(), thirtyDaysAgo.getTime())
        const alarmEnd = Math.min((alarm.endTime ? new Date(alarm.endTime) : now).getTime(), now.getTime())
        const overlap = (alarmEnd - alarmStart) / 1000
        if (overlap > 0) {
          downtimeSeconds += overlap
        }
      })

      const availability = Math.max(0, Math.min(100, ((total30DaysSeconds - downtimeSeconds) / total30DaysSeconds) * 100))
      totalSlaSum += availability
    })

    const avgSla = totalSlaSum / activeNodes.length
    return {
      id: cust.id,
      name: cust.name,
      code: cust.code,
      sla: Math.round(avgSla * 100) / 100
    }
  })

  // Sort customerSla descending by SLA to show a leaderboard
  customerSla.sort((a, b) => b.sla - a.sla)

  res.json({
    totalSites,
    totalNodes,
    onlineNodes,
    maintenanceNodes,
    offlineNodes: totalNodes - onlineNodes - maintenanceNodes,
    activeAlarms,
    recentEvents,
    nodesStats,
    incidentTrend,
    customerSla,
  })
})

// History stats for a node
router.get('/history/:nodeId', async (req: Request, res: Response) => {
  const nodeId = parseInt(req.params.nodeId)
  const { days = '7' } = req.query

  const since = new Date()
  since.setDate(since.getDate() - parseInt(days as string))

  const [alarms, events] = await Promise.all([
    prisma.alarm.findMany({
      where: { nodeId, startTime: { gte: since } },
      orderBy: { startTime: 'desc' },
    }),
    prisma.eventLog.findMany({
      where: { nodeId, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    }),
  ])

  const now = new Date()
  const totalDowntime = alarms.reduce((sum, a) => {
    const dur = a.duration || (a.endTime
      ? Math.floor((new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / 1000)
      : Math.floor((now.getTime() - new Date(a.startTime).getTime()) / 1000))
    return sum + Math.max(0, dur)
  }, 0)
  const totalSeconds = parseInt(days as string) * 86400
  const availability = totalSeconds > 0 ? ((totalSeconds - totalDowntime) / totalSeconds * 100) : 100

  res.json({
    alarms,
    events,
    stats: {
      totalAlarms: alarms.length,
      totalDowntime,
      availability: Math.round(availability * 100) / 100,
    },
  })
})

export default router
