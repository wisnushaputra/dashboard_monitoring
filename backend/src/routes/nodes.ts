import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, roleMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  const { customerId, siteId, status, deviceType, search } = req.query

  const where: any = {}
  if (customerId) where.customerId = parseInt(customerId as string)
  if (siteId) where.siteId = parseInt(siteId as string)
  if (status) where.status = status
  if (deviceType) where.deviceType = deviceType
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { ipAddress: { contains: search as string, mode: 'insensitive' } },
    ]
  }

  const nodes = await prisma.node.findMany({
    where,
    include: { customer: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(nodes)
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const node = await prisma.node.findUnique({
    where: { id },
    include: { customer: true, site: true, alarms: true, eventLogs: { take: 20, orderBy: { timestamp: 'desc' } } },
  })
  if (!node) { res.status(404).json({ error: 'Node not found' }); return }
  res.json(node)
})

router.post('/', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { name, ipAddress, deviceType, location, description, monitoringInterval, monitorType, monitorConfig, customerId, siteId, x, y } = req.body
  if (!name || !ipAddress || !customerId) {
    res.status(400).json({ error: 'Name, IP address, and customer ID required' })
    return
  }

  const node = await prisma.node.create({
    data: { name, ipAddress, deviceType, location, description, monitoringInterval, monitorType, monitorConfig, customerId, siteId: siteId || null, x, y },
  })
  res.status(201).json(node)
})

router.put('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { name, ipAddress, deviceType, location, description, monitoringInterval, monitorType, monitorConfig, customerId, siteId, x, y, enabled } = req.body

  const data: any = {}
  if (name !== undefined) data.name = name
  if (ipAddress !== undefined) data.ipAddress = ipAddress
  if (deviceType !== undefined) data.deviceType = deviceType
  if (location !== undefined) data.location = location
  if (description !== undefined) data.description = description
  if (monitoringInterval !== undefined) data.monitoringInterval = monitoringInterval
  if (monitorType !== undefined) data.monitorType = monitorType
  if (monitorConfig !== undefined) data.monitorConfig = monitorConfig
  if (customerId !== undefined) data.customerId = customerId
  if (siteId !== undefined) data.siteId = siteId
  if (x !== undefined) data.x = x
  if (y !== undefined) data.y = y
  if (enabled !== undefined) data.enabled = enabled

  const node = await prisma.node.update({ where: { id }, data })
  res.json(node)
})

router.delete('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  await prisma.node.delete({ where: { id } })
  res.json({ message: 'Node deleted' })
})

// Bulk import nodes from JSON body
router.post('/import', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { nodes } = req.body
  if (!Array.isArray(nodes) || nodes.length === 0) {
    res.status(400).json({ error: 'Provide a nodes array' })
    return
  }

  const created = await prisma.node.createMany({ data: nodes.map((n: any) => ({
    name: n.name || n.Nama_Node,
    ipAddress: n.ipAddress || n.IP_Address,
    deviceType: n.deviceType || n.Tipe_Perangkat || 'router',
    location: n.location || n.Lokasi,
    description: n.description || n.Deskripsi,
    monitoringInterval: n.monitoringInterval || n.Interval_Detik || 30,
    customerId: n.customerId || 1,
  })) })

  res.status(201).json({ count: created.count })
})

// Export nodes
router.get('/export/json', async (req: Request, res: Response) => {
  const nodes = await prisma.node.findMany({ include: { customer: { select: { name: true } }, site: { select: { name: true } } } })
  res.json(nodes)
})

export default router
