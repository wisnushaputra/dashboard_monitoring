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

  res.json({
    totalSites,
    totalNodes,
    onlineNodes,
    maintenanceNodes,
    offlineNodes: totalNodes - onlineNodes - maintenanceNodes,
    activeAlarms,
    recentEvents,
    nodesStats,
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
