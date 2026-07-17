import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as ioc } from 'socket.io-client'
import eventEmitter from '../src/lib/eventEmitter'
import prisma from '../src/lib/prisma'

let httpServer: http.Server
let io: SocketIOServer
let clientSocket: ReturnType<typeof ioc>

before(async () => {
  httpServer = http.createServer()
  io = new SocketIOServer(httpServer, { cors: { origin: '*' } })

  // Same bridge logic as server.ts
  eventEmitter.on('node:status', (data) => { io.emit('node:status', data) })
  eventEmitter.on('alarm:created', (data) => { io.emit('alarm:created', data) })
  eventEmitter.on('alarm:resolved', (data) => { io.emit('alarm:resolved', data) })

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address() as { port: number }
  clientSocket = ioc(`http://localhost:${address.port}`, { transports: ['websocket'] })
  await new Promise<void>((resolve) => clientSocket.on('connect', resolve))
})

after(async () => {
  clientSocket.close()
  io.close()
  await new Promise((resolve) => httpServer.close(resolve))
})

describe('WebSocket Integration', () => {
  it('should receive node:status event', async () => {
    const msg = await new Promise<any>((resolve) => {
      clientSocket.once('node:status', resolve)
      eventEmitter.emit('node:status', { nodeId: 1, status: 'up', latencyMs: 5 })
    })
    assert.strictEqual(msg.nodeId, 1)
    assert.strictEqual(msg.status, 'up')
  })

  it('should receive alarm:created event', async () => {
    const msg = await new Promise<any>((resolve) => {
      clientSocket.once('alarm:created', resolve)
      eventEmitter.emit('alarm:created', { nodeId: 1, status: 'active' })
    })
    assert.strictEqual(msg.status, 'active')
  })

  it('should receive alarm:resolved event', async () => {
    const msg = await new Promise<any>((resolve) => {
      clientSocket.once('alarm:resolved', resolve)
      eventEmitter.emit('alarm:resolved', { nodeId: 1, status: 'resolved' })
    })
    assert.strictEqual(msg.status, 'resolved')
  })

  it('should handle multiple concurrent events', async () => {
    const count = 5
    const received: string[] = []

    clientSocket.on('node:status', (data: any) => { received.push(data.status) })

    for (let i = 0; i < count; i++) {
      eventEmitter.emit('node:status', { nodeId: i, status: i % 2 === 0 ? 'up' : 'down' })
    }

    await new Promise(r => setTimeout(r, 100))
    assert.strictEqual(received.length, count)
    assert.strictEqual(received[0], 'up')
    assert.strictEqual(received[1], 'down')

    clientSocket.off('node:status')
  })
})
