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
  const [totalSites, totalNodes, onlineNodes, activeAlarms, recentEvents] = await Promise.all([
    prisma.site.count(),
    prisma.node.count(),
    prisma.node.count({ where: { status: 'up' } }),
    prisma.alarm.count({ where: { status: 'active' } }),
    prisma.eventLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: { node: { select: { name: true, deviceType: true } } },
    }),
  ])

  res.json({
    totalSites,
    totalNodes,
    onlineNodes,
    offlineNodes: totalNodes - onlineNodes,
    activeAlarms,
    recentEvents,
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

  const totalDowntime = alarms.reduce((sum, a) => sum + (a.duration || 0), 0)
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
