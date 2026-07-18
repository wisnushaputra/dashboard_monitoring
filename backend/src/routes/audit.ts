import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, roleMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)
router.use(roleMiddleware('admin'))

router.get('/', async (req: Request, res: Response) => {
  const { search, action, startDate, endDate, page = '1', limit = '50' } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const take = parseInt(limit as string)

  const where: any = {}

  if (action) {
    where.action = action as string
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string)
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string)
    }
  }

  if (search) {
    where.OR = [
      { username: { contains: search as string, mode: 'insensitive' } },
      { action: { contains: search as string, mode: 'insensitive' } },
      { target: { contains: search as string, mode: 'insensitive' } },
      { details: { contains: search as string, mode: 'insensitive' } },
    ]
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs, total, page: parseInt(page as string), limit: take })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
