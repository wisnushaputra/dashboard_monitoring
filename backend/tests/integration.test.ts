import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import express from 'express'
import request from 'supertest'

import authRoutes from '../src/routes/auth'
import nodeRoutes from '../src/routes/nodes'
import alarmRoutes from '../src/routes/alarms'
import eventRoutes from '../src/routes/events'
import customerRoutes from '../src/routes/customers'
import exportRoutes from '../src/routes/exports'
import notificationRoutes from '../src/routes/notifications'

import prisma from '../src/lib/prisma'
import { signToken } from '../src/middleware/auth'

function buildApp() {
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/api/auth', authRoutes)
  app.use('/api/nodes', nodeRoutes)
  app.use('/api/alarms', alarmRoutes)
  app.use('/api/events', eventRoutes)
  app.use('/api/customers', customerRoutes)
  app.use('/api/export', exportRoutes)
  app.use('/api/notifications', notificationRoutes)
  return app
}

let app: ReturnType<typeof buildApp>
let adminToken: string
let operatorToken: string
let viewerToken: string
let testCustomerId: number
let testNodeId: number
let testAlarmId: number

before(async () => {
  app = buildApp()
  adminToken = signToken({ userId: 1, username: 'admin', role: 'admin' })
  operatorToken = signToken({ userId: 2, username: 'operator', role: 'operator' })
  viewerToken = signToken({ userId: 3, username: 'viewer', role: 'viewer' })

  // Create test data
  let cust = await prisma.customer.findFirst({ where: { code: 'TEST' } })
  if (!cust) {
    cust = await prisma.customer.create({ data: { name: 'Test Customer', code: 'TEST' } })
  }
  testCustomerId = cust.id
})

after(async () => {
  // Cleanup test data
  if (testAlarmId) await prisma.alarm.deleteMany({ where: { id: testAlarmId } }).catch(() => {})
  if (testNodeId) await prisma.node.deleteMany({ where: { id: testNodeId } }).catch(() => {})
  await prisma.site.deleteMany({ where: { customerId: testCustomerId } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { code: 'TEST' } }).catch(() => {})
})

describe('Auth API', () => {
  it('POST /api/auth/login - success', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' })
    assert.strictEqual(res.status, 200)
    assert.ok(res.body.token)
    assert.strictEqual(res.body.user.role, 'admin')
  })

  it('POST /api/auth/login - wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' })
    assert.strictEqual(res.status, 401)
  })

  it('POST /api/auth/login - missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    assert.strictEqual(res.status, 400)
  })

  it('GET /api/auth/me - valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.role, 'admin')
  })

  it('GET /api/auth/me - no token', async () => {
    const res = await request(app).get('/api/auth/me')
    assert.strictEqual(res.status, 401)
  })

  it('GET /api/auth - admin lists users', async () => {
    const res = await request(app).get('/api/auth').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body))
    assert.ok(res.body.length >= 3)
  })

  it('GET /api/auth - operator forbidden', async () => {
    const res = await request(app).get('/api/auth').set('Authorization', `Bearer ${operatorToken}`)
    assert.strictEqual(res.status, 403)
  })

  it('POST /api/auth - admin creates user', async () => {
    const uname = `testuser_${Date.now()}`
    const res = await request(app).post('/api/auth').set('Authorization', `Bearer ${adminToken}`).send({ username: uname, password: 'test123', role: 'viewer' })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.username, uname)
    // Cleanup
    await prisma.user.delete({ where: { id: res.body.id } }).catch(() => {})
  })

  it('POST /api/auth - duplicate username', async () => {
    const res = await request(app).post('/api/auth').set('Authorization', `Bearer ${adminToken}`).send({ username: 'admin', password: 'test123' })
    assert.strictEqual(res.status, 409)
  })
})

describe('Customer API', () => {
  it('GET /api/customers - list', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })

  it('POST /api/customers - admin creates', async () => {
    const code = `T${Date.now()}`
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send({ name: `Test ${code}`, code })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.code, code)
    await prisma.customer.deleteMany({ where: { code } }).catch(() => {})
  })

  it('POST /api/customers - viewer forbidden', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${viewerToken}`).send({ name: 'X', code: 'X' })
    assert.strictEqual(res.status, 403)
  })

  it('POST /api/customers/:customerId/sites - admin creates', async () => {
    const res = await request(app).post(`/api/customers/${testCustomerId}/sites`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Site', location: 'Jakarta' })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.name, 'Test Site')
  })

  it('GET /api/customers/:customerId/sites - list', async () => {
    const res = await request(app).get(`/api/customers/${testCustomerId}/sites`).set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })
})

describe('Node API', () => {
  it('POST /api/nodes - admin creates', async () => {
    const res = await request(app).post('/api/nodes').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Test Router', ipAddress: '10.0.0.1', customerId: testCustomerId, deviceType: 'router',
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.name, 'Test Router')
    testNodeId = res.body.id
  })

  it('POST /api/nodes - missing fields', async () => {
    const res = await request(app).post('/api/nodes').set('Authorization', `Bearer ${adminToken}`).send({ name: 'X' })
    assert.strictEqual(res.status, 400)
  })

  it('POST /api/nodes - viewer forbidden', async () => {
    const res = await request(app).post('/api/nodes').set('Authorization', `Bearer ${viewerToken}`).send({
      name: 'X', ipAddress: '10.0.0.2', customerId: testCustomerId,
    })
    assert.strictEqual(res.status, 403)
  })

  it('GET /api/nodes - list', async () => {
    const res = await request(app).get('/api/nodes').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body))
    assert.ok(res.body.some((n: any) => n.id === testNodeId))
  })

  it('GET /api/nodes - filter by search', async () => {
    const res = await request(app).get('/api/nodes?search=Test').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(res.body.length > 0)
  })

  it('GET /api/nodes/:id - single node', async () => {
    const res = await request(app).get(`/api/nodes/${testNodeId}`).set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.name, 'Test Router')
  })

  it('GET /api/nodes/:id - not found', async () => {
    const res = await request(app).get('/api/nodes/99999').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 404)
  })

  it('PUT /api/nodes/:id - admin updates', async () => {
    const res = await request(app).put(`/api/nodes/${testNodeId}`).set('Authorization', `Bearer ${adminToken}`).send({ description: 'Updated desc' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.description, 'Updated desc')
  })

  it('DELETE /api/nodes/:id - admin deletes and re-creates', async () => {
    // Create, delete, verify
    const created = await request(app).post('/api/nodes').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Temp Node', ipAddress: '10.0.0.99', customerId: testCustomerId,
    })
    const del = await request(app).delete(`/api/nodes/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(del.status, 200)
    const get = await request(app).get(`/api/nodes/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(get.status, 404)
  })

  it('POST /api/nodes/import - bulk import', async () => {
    const res = await request(app).post('/api/nodes/import').set('Authorization', `Bearer ${adminToken}`).send({
      nodes: [
        { name: 'Import1', ipAddress: '10.0.1.1', customerId: testCustomerId, deviceType: 'router' },
        { name: 'Import2', ipAddress: '10.0.1.2', customerId: testCustomerId, deviceType: 'switch' },
      ],
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.count, 2)
  })

  it('GET /api/nodes/export/json - export', async () => {
    const res = await request(app).get('/api/nodes/export/json').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })
})

describe('Alarm API', () => {
  before(async () => {
    // Create an alarm for test
    const alarm = await prisma.alarm.create({
      data: { nodeId: testNodeId, status: 'active', startTime: new Date() },
    })
    testAlarmId = alarm.id
  })

  it('GET /api/alarms - list with pagination', async () => {
    const res = await request(app).get('/api/alarms?page=1&limit=10').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok('alarms' in res.body)
    assert.ok('total' in res.body)
    assert.ok(res.body.alarms.length > 0)
  })

  it('GET /api/alarms - filter by status', async () => {
    const res = await request(app).get('/api/alarms?status=active').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(res.body.alarms.every((a: any) => a.status === 'active'))
  })

  it('PUT /api/alarms/:id/resolve - resolve alarm', async () => {
    const res = await request(app).put(`/api/alarms/${testAlarmId}/resolve`).set('Authorization', `Bearer ${adminToken}`).send({
      recoveryNote: 'Issue fixed', cause: 'Network outage',
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.status, 'resolved')
    assert.strictEqual(res.body.recoveryNote, 'Issue fixed')
  })

  it('PUT /api/alarms/:id/resolve - not found', async () => {
    const res = await request(app).put('/api/alarms/99999/resolve').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 404)
  })
})

describe('Event API', () => {
  it('GET /api/events - list', async () => {
    const res = await request(app).get('/api/events?page=1&limit=10').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok('events' in res.body)
    assert.ok('total' in res.body)
  })

  it('GET /api/events/summary - dashboard summary', async () => {
    const res = await request(app).get('/api/events/summary').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok('totalNodes' in res.body)
    assert.ok('onlineNodes' in res.body)
    assert.ok('offlineNodes' in res.body)
    assert.ok('activeAlarms' in res.body)
    assert.ok('recentEvents' in res.body)
  })

  it('GET /api/events/history/:nodeId - node history', async () => {
    const res = await request(app).get(`/api/events/history/${testNodeId}?days=7`).set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok('alarms' in res.body)
    assert.ok('events' in res.body)
    assert.ok('stats' in res.body)
    assert.ok('availability' in res.body.stats)
  })
})

describe('Notification API', () => {
  it('GET /api/notifications - get (auto-create defaults)', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    // Should have auto-created defaults
    assert.ok('soundEnabled' in res.body)
    assert.ok('emailEnabled' in res.body)
  })

  it('PUT /api/notifications - update settings', async () => {
    const res = await request(app).put('/api/notifications').set('Authorization', `Bearer ${adminToken}`).send({
      soundEnabled: true, emailEnabled: true, emailAddress: 'test@example.com',
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.soundEnabled, true)
    assert.strictEqual(res.body.emailAddress, 'test@example.com')
  })
})

describe('Export API', () => {
  it('GET /api/export/alarms/xlsx - export XLSX', async () => {
    const res = await request(app).get('/api/export/alarms/xlsx').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(res.headers['content-type']?.includes('openxmlformats'))
  })

  it('GET /api/export/alarms/csv - export CSV', async () => {
    const res = await request(app).get('/api/export/alarms/csv').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(res.headers['content-type']?.includes('text/csv'))
  })

  it('GET /api/export/alarms/pdf - export PDF', async () => {
    const res = await request(app).get('/api/export/alarms/pdf').set('Authorization', `Bearer ${adminToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(res.headers['content-type']?.includes('application/pdf'))
  })
})
