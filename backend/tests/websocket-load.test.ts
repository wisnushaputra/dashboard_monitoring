import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as ioc } from 'socket.io-client'
import eventEmitter from '../src/lib/eventEmitter'

let httpServer: http.Server
let io: SocketIOServer
let port: number

before(async () => {
  httpServer = http.createServer()
  io = new SocketIOServer(httpServer, { cors: { origin: '*' } })

  eventEmitter.on('node:status', (data) => { io.emit('node:status', data) })
  eventEmitter.on('alarm:created', (data) => { io.emit('alarm:created', data) })

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  port = (httpServer.address() as { port: number }).port
})

after(async () => {
  io.close()
  await new Promise((resolve) => httpServer.close(resolve))
})

describe('WebSocket Load Test', () => {
  it('should handle 50 concurrent clients', async () => {
    const clients = await Promise.all(
      Array.from({ length: 50 }, () =>
        new Promise<any>((resolve) => {
          const c = ioc(`http://localhost:${port}`, { transports: ['websocket'] })
          c.on('connect', () => resolve(c))
        })
      )
    )

    assert.strictEqual(clients.length, 50)

    let received = 0
    clients.forEach((c) => {
      c.on('node:status', () => received++)
    })

    eventEmitter.emit('node:status', { nodeId: 1, status: 'up' })
    await new Promise(r => setTimeout(r, 200))

    assert.strictEqual(received, 50, `Only ${received}/${50} clients received the event`)

    clients.forEach((c: any) => c.close())
  })

  it('should deliver events within 100ms', async () => {
    const client = ioc(`http://localhost:${port}`, { transports: ['websocket'] })
    await new Promise<void>((resolve) => client.on('connect', resolve))

    const latencies: number[] = []
    for (let i = 0; i < 20; i++) {
      const before = Date.now()
      await new Promise<any>((resolve) => {
        client.once('node:status', (data) => resolve(data))
        eventEmitter.emit('node:status', { nodeId: i, status: 'up' })
      })
      latencies.push(Date.now() - before)
    }

    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length
    const max = Math.max(...latencies)

    console.log(`\n  WS event delivery (20x): avg ${avg.toFixed(1)}ms  max ${max}ms`)
    assert.ok(avg < 100, `avg latency ${avg.toFixed(1)}ms >= 100ms`)

    client.close()
  })

  it('should handle burst of 100 events to 20 clients', async () => {
    const clients = await Promise.all(
      Array.from({ length: 20 }, () =>
        new Promise<any>((resolve) => {
          const c = ioc(`http://localhost:${port}`, { transports: ['websocket'] })
          c.on('connect', () => resolve(c))
        })
      )
    )

    let total = 0
    clients.forEach((c) => { c.on('node:status', () => total++) })

    for (let i = 0; i < 100; i++) {
      eventEmitter.emit('node:status', { nodeId: i, status: 'up' })
    }

    await new Promise(r => setTimeout(r, 500))

    // 100 events × 20 clients = 2000 deliveries expected
    assert.ok(total >= 1800, `Only ${total}/2000 events delivered`)
    console.log(`\n  Burst 100 events × 20 clients: ${total}/2000 delivered`)

    clients.forEach((c: any) => c.close())
  })
})
