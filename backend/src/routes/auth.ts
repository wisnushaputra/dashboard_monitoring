import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { signToken, authMiddleware, roleMiddleware } from '../middleware/auth'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role })
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
})

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json(req.user)
})

router.get('/', authMiddleware, roleMiddleware('admin'), async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
  })
  res.json(users)
})

router.post('/', authMiddleware, roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    res.status(409).json({ error: 'Username already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { username, passwordHash, role: role || 'viewer' },
    select: { id: true, username: true, role: true, createdAt: true },
  })
  res.status(201).json(user)
})

router.put('/:id', authMiddleware, roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { username, password, role } = req.body

  const data: any = {}
  if (username) data.username = username
  if (role) data.role = role
  if (password) data.passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, createdAt: true },
  })
  res.json(user)
})

router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  await prisma.user.delete({ where: { id } })
  res.json({ message: 'User deleted' })
})

export default router
