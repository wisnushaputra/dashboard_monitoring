import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dotenv from 'dotenv'

dotenv.config()

import prisma from './lib/prisma'
import eventEmitter from './lib/eventEmitter'
import { startPingWorker } from './workers/pingWorker'
import authRoutes from './routes/auth'
import nodeRoutes from './routes/nodes'
import alarmRoutes from './routes/alarms'
import eventRoutes from './routes/events'
import customerRoutes from './routes/customers'
import exportRoutes from './routes/exports'
import notificationRoutes from './routes/notifications'

const app = express()
const server = http.createServer(app)

const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/nodes', nodeRoutes)
app.use('/api/alarms', alarmRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/notifications', notificationRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// WebSocket - emit real-time events to connected clients
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})

eventEmitter.on('node:status', (data) => {
  io.emit('node:status', data)
})

eventEmitter.on('alarm:created', (data) => {
  io.emit('alarm:created', data)
})

eventEmitter.on('alarm:resolved', (data) => {
  io.emit('alarm:resolved', data)
})

// Start
const PORT = parseInt(process.env.PORT || '4000')

async function main() {
  // Verify DB connection
  await prisma.$connect()
  console.log('[Server] Database connected')

  // Start ping worker
  startPingWorker().catch(console.error)

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err)
  process.exit(1)
})

export { app, server, io }
