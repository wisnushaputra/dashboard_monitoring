import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import { fetchDeviceConfig } from '../lib/configFetcher'
import { computeLineDiff } from '../lib/diffEngine'

const router = Router({ mergeParams: true })

router.use(authMiddleware)

// GET /api/nodes/:nodeId/configs - List backup versions for a node
router.get('/', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId)
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' })
    }

    const configs = await prisma.deviceConfig.findMany({
      where: { nodeId },
      select: {
        id: true,
        nodeId: true,
        version: true,
        hash: true,
        changesCount: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { version: 'desc' },
    })

    res.json(configs)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/nodes/:nodeId/configs/backup - Trigger new config backup
router.post('/backup', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId)
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' })
    }

    const node = await prisma.node.findUnique({ where: { id: nodeId } })
    if (!node) {
      return res.status(404).json({ error: 'Node not found' })
    }

    // Fetch new config snapshot
    const fetched = await fetchDeviceConfig(node)

    // Get latest version
    const latest = await prisma.deviceConfig.findFirst({
      where: { nodeId },
      orderBy: { version: 'desc' },
    })

    const newVersion = latest ? latest.version + 1 : 1
    let changesCount = 0

    if (latest) {
      const diffResult = computeLineDiff(latest.content, fetched.content)
      changesCount = diffResult.addedCount + diffResult.removedCount
    }

    const newConfig = await prisma.deviceConfig.create({
      data: {
        nodeId,
        version: newVersion,
        content: fetched.content,
        hash: fetched.hash,
        changesCount,
        status: 'success',
      },
    })

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        username: req.user?.username || 'system',
        action: 'CONFIG_BACKUP',
        target: `Node [${node.name}]`,
        details: `Created config backup v${newVersion} (${changesCount} changes)`,
      },
    })

    res.status(201).json(newConfig)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/nodes/:nodeId/configs/diff - Calculate diff between 2 versions
router.get('/diff', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId)
    const v1 = parseInt(req.query.v1 as string)
    const v2 = parseInt(req.query.v2 as string)

    if (isNaN(nodeId) || isNaN(v1) || isNaN(v2)) {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    const [c1, c2] = await Promise.all([
      prisma.deviceConfig.findFirst({ where: { nodeId, version: v1 } }),
      prisma.deviceConfig.findFirst({ where: { nodeId, version: v2 } }),
    ])

    if (!c1 || !c2) {
      return res.status(404).json({ error: 'One or both config versions not found' })
    }

    const diffResult = computeLineDiff(c1.content, c2.content)

    res.json({
      v1: c1.version,
      v2: c2.version,
      v1CreatedAt: c1.createdAt,
      v2CreatedAt: c2.createdAt,
      addedCount: diffResult.addedCount,
      removedCount: diffResult.removedCount,
      diffs: diffResult.diffs,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/nodes/:nodeId/configs/:configId - Get single config details
router.get('/:configId', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId)
    const configId = parseInt(req.params.configId)

    if (isNaN(nodeId) || isNaN(configId)) {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    const config = await prisma.deviceConfig.findFirst({
      where: { id: configId, nodeId },
    })

    if (!config) {
      return res.status(404).json({ error: 'Device config not found' })
    }

    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
