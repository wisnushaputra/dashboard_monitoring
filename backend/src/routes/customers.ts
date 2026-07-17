import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, roleMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({ include: { _count: { select: { nodes: true, sites: true } } } })
  res.json(customers)
})

router.post('/', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { name, code } = req.body
  if (!name || !code) { res.status(400).json({ error: 'Name and code required' }); return }
  const customer = await prisma.customer.create({ data: { name, code } })
  res.status(201).json(customer)
})

router.put('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const customer = await prisma.customer.update({ where: { id }, data: req.body })
  res.json(customer)
})

router.delete('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  await prisma.customer.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ message: 'Deleted' })
})

// Sites
router.get('/:customerId/sites', async (req: Request, res: Response) => {
  const sites = await prisma.site.findMany({ where: { customerId: parseInt(req.params.customerId) } })
  res.json(sites)
})

router.post('/:customerId/sites', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { name, location } = req.body
  const site = await prisma.site.create({ data: { name, location, customerId: parseInt(req.params.customerId) } })
  res.status(201).json(site)
})

export default router
