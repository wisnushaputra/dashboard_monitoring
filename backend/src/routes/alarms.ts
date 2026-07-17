import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  const { nodeId, status, startDate, endDate, search, page = '1', limit = '50' } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const take = parseInt(limit as string)

  const where: any = {}
  if (nodeId) where.nodeId = parseInt(nodeId as string)
  if (status) where.status = status
  if (startDate || endDate) {
    where.startTime = {}
    if (startDate) where.startTime.gte = new Date(startDate as string)
    if (endDate) where.startTime.lte = new Date(endDate as string)
  }
  if (search) {
    where.node = { name: { contains: search as string, mode: 'insensitive' } }
  }

  const [alarms, total] = await Promise.all([
    prisma.alarm.findMany({
      where,
      include: { node: { select: { name: true, ipAddress: true, deviceType: true } } },
      orderBy: { startTime: 'desc' },
      skip,
      take,
    }),
    prisma.alarm.count({ where }),
  ])

  res.json({ alarms, total, page: parseInt(page as string), limit: take })
})

router.put('/:id/resolve', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { recoveryNote, cause } = req.body

  const alarm = await prisma.alarm.findUnique({ where: { id } })
  if (!alarm) { res.status(404).json({ error: 'Alarm not found' }); return }

  const endTime = new Date()
  const duration = alarm.startTime ? Math.round((endTime.getTime() - new Date(alarm.startTime).getTime()) / 1000) : 0

  const updated = await prisma.alarm.update({
    where: { id },
    data: { status: 'resolved', endTime, duration, recoveryNote, cause },
  })
  res.json(updated)
})

export default router
