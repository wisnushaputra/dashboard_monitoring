import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import prisma from '../src/lib/prisma'
import eventEmitter from '../src/lib/eventEmitter'
import { ping, pingFast } from '../src/lib/ping'

let testNodeId: number
let testCustomerId: number

before(async () => {
  let cust = await prisma.customer.findFirst({ where: { code: 'TEST' } })
  if (!cust) {
    cust = await prisma.customer.create({ data: { name: 'Test Customer', code: 'TEST' } })
  }
  testCustomerId = cust.id
})

after(async () => {
  await prisma.eventLog.deleteMany({ where: { nodeId: testNodeId } }).catch(() => {})
  await prisma.alarm.deleteMany({ where: { nodeId: testNodeId } }).catch(() => {})
  await prisma.node.deleteMany({ where: { id: testNodeId } }).catch(() => {})
  await prisma.site.deleteMany({ where: { customerId: testCustomerId } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { code: 'TEST' } }).catch(() => {})
})

describe('Monitoring Engine', () => {
  it('should create node and set initial status', async () => {
    const node = await prisma.node.create({
      data: { name: 'Monitor Node', ipAddress: '127.0.0.1', customerId: testCustomerId, status: 'unknown', enabled: true },
    })
    testNodeId = node.id
    assert.strictEqual(node.status, 'unknown')
    assert.ok(node.enabled)
  })

  it('should create event log (simulating pingWorker on status change)', async () => {
    const event = await prisma.eventLog.create({
      data: { nodeId: testNodeId, eventType: 'up', message: 'Recovered (avg:1ms, loss:0%)', latencyMs: 1.2 },
    })
    assert.ok(event.id)
    assert.strictEqual(event.eventType, 'up')
  })

  it('should update node status in DB (simulating pingWorker)', async () => {
    const updated = await prisma.node.update({
      where: { id: testNodeId },
      data: { status: 'warning', latencyMs: 150, packetLoss: 0, lastChecked: new Date() },
    })
    assert.strictEqual(updated.status, 'warning')
    assert.strictEqual(updated.latencyMs, 150)
  })

  it('should create alarm and emit event', async () => {
    const events: any[] = []
    const handler = (data: any) => events.push(data)
    eventEmitter.on('alarm:created', handler)

    const alarm = await prisma.alarm.create({
      data: { nodeId: testNodeId, status: 'active', startTime: new Date() },
    })
    assert.strictEqual(alarm.status, 'active')

    eventEmitter.emit('alarm:created', { id: alarm.id, nodeId: testNodeId, status: 'active' })

    // Wait for async emit
    await new Promise(r => setTimeout(r, 50))
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].status, 'active')

    eventEmitter.off('alarm:created', handler)

    // Cleanup
    await prisma.alarm.deleteMany({ where: { id: alarm.id } }).catch(() => {})
  })

  it('should resolve alarm and emit event', async () => {
    // Create alarm first
    const alarm = await prisma.alarm.create({
      data: { nodeId: testNodeId, status: 'active', startTime: new Date() },
    })

    const events: any[] = []
    const handler = (data: any) => events.push(data)
    eventEmitter.on('alarm:resolved', handler)

    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - new Date(alarm.startTime).getTime()) / 1000)
    const resolved = await prisma.alarm.update({
      where: { id: alarm.id },
      data: { status: 'resolved', endTime, duration },
    })
    assert.strictEqual(resolved.status, 'resolved')
    assert.ok(resolved.duration !== null)

    eventEmitter.emit('alarm:resolved', { id: alarm.id, nodeId: testNodeId, status: 'resolved' })

    await new Promise(r => setTimeout(r, 50))
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].status, 'resolved')

    eventEmitter.off('alarm:resolved', handler)
  })

  it('should create multiple events for history', async () => {
    const types = ['up', 'down', 'warning', 'up']
    for (const t of types) {
      await prisma.eventLog.create({
        data: { nodeId: testNodeId, eventType: t, latencyMs: Math.random() * 200 },
      })
    }

    const events = await prisma.eventLog.findMany({
      where: { nodeId: testNodeId },
      orderBy: { timestamp: 'desc' },
    })
    assert.ok(events.length >= 4)
    assert.ok(events.some(e => e.eventType === 'down'))
  })

  it('should compute uptime from alarms', async () => {
    // Create resolved alarm with known duration
    await prisma.alarm.create({
      data: {
        nodeId: testNodeId, status: 'resolved',
        startTime: new Date(Date.now() - 60000), // 60s ago
        endTime: new Date(),
        duration: 60,
      },
    })

    const alarms = await prisma.alarm.findMany({ where: { nodeId: testNodeId } })
    const totalDowntime = alarms.reduce((sum, a) => sum + (a.duration || 0), 0)
    const totalSeconds = 7 * 86400
    const availability = totalSeconds > 0 ? ((totalSeconds - totalDowntime) / totalSeconds * 100) : 100

    assert.ok(availability > 99)
    assert.ok(availability <= 100)
  })

  it('should query summary from events API perspective', async () => {
    const [totalNodes, onlineNodes, offlineNodes, activeAlarms] = await Promise.all([
      prisma.node.count(),
      prisma.node.count({ where: { status: 'up' } }),
      prisma.node.count({ where: { status: 'down' } }),
      prisma.alarm.count({ where: { status: 'active' } }),
    ])

    assert.ok(totalNodes > 0)
    assert.ok(typeof onlineNodes === 'number')
    assert.ok(typeof offlineNodes === 'number')
    assert.ok(typeof activeAlarms === 'number')
  })
})
