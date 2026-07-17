import { describe, it, expect } from 'vitest'
import { api } from '../lib/api'

describe('API Client', () => {
  it('has expected methods', () => {
    expect(api.auth.login).toBeDefined()
    expect(api.auth.me).toBeDefined()
    expect(api.nodes.list).toBeDefined()
    expect(api.nodes.create).toBeDefined()
    expect(api.alarms.list).toBeDefined()
    expect(api.events.summary).toBeDefined()
    expect(api.export.alarmsXlsx).toBeDefined()
  })
})
