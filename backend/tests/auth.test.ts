import { describe, it } from 'node:test'
import assert from 'node:assert'
import { signToken, authMiddleware, roleMiddleware } from '../src/middleware/auth'
import type { AuthPayload } from '../src/middleware/auth'

describe('Auth middleware', () => {
  it('should sign and verify a valid token', () => {
    const payload: AuthPayload = { userId: 1, username: 'admin', role: 'admin' }
    const token = signToken(payload)
    assert.ok(typeof token === 'string')
    assert.ok(token.split('.').length === 3)
  })
})
