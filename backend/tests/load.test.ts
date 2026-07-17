import { describe, it } from 'node:test'
import assert from 'node:assert'
import { signToken } from '../src/middleware/auth'

const BASE = 'http://localhost:4000/api'
const adminToken = signToken({ userId: 1, username: 'admin', role: 'admin' })

async function request(path: string, opts: RequestInit = {}) {
  const start = Date.now()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json', ...opts.headers },
  })
  return { status: res.status, ms: Date.now() - start, body: await res.json().catch(() => ({})) }
}

describe('API Load Test', () => {
  it('GET /health under 50 concurrent calls', async () => {
    const calls = Array.from({ length: 50 }, () => request('/health'))
    const results = await Promise.all(calls)

    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length
    const max = Math.max(...results.map(r => r.ms))
    const p95 = results.map(r => r.ms).sort((a, b) => a - b)[Math.floor(results.length * 0.95)]

    console.log(`\n  GET /health  (50x concurrent)`)
    console.log(`  avg: ${avg.toFixed(0)}ms  max: ${max}ms  p95: ${p95}ms`)

    assert.ok(results.every(r => r.status === 200))
    assert.ok(avg < 500, `avg ${avg}ms >= 500ms`)
  })

  it('GET /events/summary under 30 concurrent calls', async () => {
    const calls = Array.from({ length: 30 }, () => request('/events/summary'))
    const results = await Promise.all(calls)

    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length
    const max = Math.max(...results.map(r => r.ms))

    console.log(`\n  GET /events/summary  (30x concurrent)`)
    console.log(`  avg: ${avg.toFixed(0)}ms  max: ${max}ms`)

    assert.ok(results.every(r => r.status === 200))
    assert.ok(avg < 1000)
  })

  it('GET /nodes under 20 concurrent calls', async () => {
    const calls = Array.from({ length: 20 }, () => request('/nodes'))
    const results = await Promise.all(calls)

    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length
    const max = Math.max(...results.map(r => r.ms))

    console.log(`\n  GET /nodes  (20x concurrent)`)
    console.log(`  avg: ${avg.toFixed(0)}ms  max: ${max}ms`)

    assert.ok(results.every(r => r.status === 200))
  })

  it('GET /alarms with pagination under 20 concurrent', async () => {
    const calls = Array.from({ length: 20 }, (_, i) => request(`/alarms?page=${i + 1}&limit=25`))
    const results = await Promise.all(calls)

    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length
    const max = Math.max(...results.map(r => r.ms))

    console.log(`\n  GET /alarms (pagination, 20x concurrent)`)
    console.log(`  avg: ${avg.toFixed(0)}ms  max: ${max}ms`)

    assert.ok(results.every(r => r.status === 200))
  })

  it('POST /auth/login under 10 concurrent', async () => {
    const calls = Array.from({ length: 10 }, () =>
      fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      }).then(async r => ({ status: r.status, ms: 0, body: await r.json().catch(() => ({})) }))
    )
    const results = await Promise.all(calls)

    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length
    console.log(`\n  POST /auth/login  (10x concurrent)`)
    console.log(`  avg: ${avg.toFixed(0)}ms`)

    assert.ok(results.every(r => r.status === 200))
  })
})
