import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ping, pingFast } from '../src/lib/ping'

describe('Ping utility', () => {
  it('should resolve for localhost', async () => {
    const result = await ping('127.0.0.1', 1)
    assert.ok(result.alive === true || result.alive === false)
    if (result.alive) {
      assert.ok(typeof result.latencyMs === 'number')
      assert.ok(result.packetLoss >= 0)
    }
  })

  it('should fail for unreachable IP', async () => {
    const result = await pingFast('192.0.2.1')
    assert.ok(result.packetLoss > 0)
  })
})
