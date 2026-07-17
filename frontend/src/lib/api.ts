const BASE = '/api'

let token: string | null = localStorage.getItem('token')

export function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('token', t)
  else localStorage.removeItem('token')
}

export function getToken() { return token }

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    setToken(null)
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res.json()
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
  },
  nodes: {
    list: (params?: Record<string, string>) =>
      request(`/nodes?${new URLSearchParams(params || {})}`),
    get: (id: number) => request(`/nodes/${id}`),
    create: (data: any) => request('/nodes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/nodes/${id}`, { method: 'DELETE' }),
    import: (nodes: any[]) => request('/nodes/import', { method: 'POST', body: JSON.stringify({ nodes }) }),
  },
  alarms: {
    list: (params?: Record<string, string>) =>
      request(`/alarms?${new URLSearchParams(params || {})}`),
    resolve: (id: number, data: any) =>
      request(`/alarms/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  events: {
    list: (params?: Record<string, string>) =>
      request(`/events?${new URLSearchParams(params || {})}`),
    summary: () => request('/events/summary'),
    history: (nodeId: number, days = 7) => request(`/events/history/${nodeId}?days=${days}`),
  },
  customers: {
    list: () => request('/customers'),
    create: (data: any) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  },
  export: {
    alarmsXlsx: (params?: Record<string, string>) =>
      `${BASE}/export/alarms/xlsx?${new URLSearchParams(params || {})}&token=${token}`,
    alarmsCsv: (params?: Record<string, string>) =>
      `${BASE}/export/alarms/csv?${new URLSearchParams(params || {})}&token=${token}`,
    alarmsPdf: (params?: Record<string, string>) =>
      `${BASE}/export/alarms/pdf?${new URLSearchParams(params || {})}&token=${token}`,
  },
}
