import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

// GET /api/anomalies - List recent AI anomalies across all nodes
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20

    const anomalies = await prisma.anomalyLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        node: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
            deviceType: true,
            status: true,
            customer: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })

    res.json(anomalies)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/anomalies/node/:nodeId - Get anomaly logs for a node
router.get('/node/:nodeId', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId)
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' })
    }

    const anomalies = await prisma.anomalyLog.findMany({
      where: { nodeId },
      take: 15,
      orderBy: { createdAt: 'desc' },
    })

    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, name: true, ipAddress: true, latencyMs: true, jitterMs: true, status: true },
    })

    res.json({
      node,
      anomalies,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
