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
  if (res.status === 401 && !path.startsWith('/auth/login')) {
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
  connections: {
    list: () => request('/nodes/connections'),
    create: (fromNodeId: number, toNodeId: number, sourceHandle?: string | null, targetHandle?: string | null) =>
      request('/nodes/connections', { method: 'POST', body: JSON.stringify({ fromNodeId, toNodeId, sourceHandle, targetHandle }) }),
    delete: (id: number) => request(`/nodes/connections/${id}`, { method: 'DELETE' }),
  },
  nodes: {
    list: (params?: Record<string, string>) =>
      request(`/nodes?${new URLSearchParams(params || {})}`),
    get: (id: number) => request(`/nodes/${id}`),
    create: (data: any) => request('/nodes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/nodes/${id}`, { method: 'DELETE' }),
    import: (nodes: any[]) => request('/nodes/import', { method: 'POST', body: JSON.stringify({ nodes }) }),
    diagnosticUrl: (id: number, type: string) =>
      `/api/nodes/${id}/diagnostic?type=${type}&token=${token}`,
    toggleMaintenance: (id: number, isMaintenance: boolean) =>
      request(`/nodes/${id}/maintenance`, { method: 'PUT', body: JSON.stringify({ isMaintenance }) }),
    listMaintenanceWindows: (id: number) =>
      request(`/nodes/${id}/maintenance-windows`),
    listAllMaintenanceWindows: () =>
      request('/nodes/maintenance-windows/all'),
    createMaintenanceWindow: (id: number, data: { startTime: string; endTime: string; description?: string }) =>
      request(`/nodes/${id}/maintenance-windows`, { method: 'POST', body: JSON.stringify(data) }),
    deleteMaintenanceWindow: (windowId: number) =>
      request(`/nodes/maintenance-windows/${windowId}`, { method: 'DELETE' }),
    updatePositions: (positions: Array<{ id: number; x: number; y: number }>) =>
      request('/nodes/positions', { method: 'PUT', body: JSON.stringify({ positions }) }),
  },
  alarms: {
    list: (params?: Record<string, string>) =>
      request(`/alarms?${new URLSearchParams(params || {})}`),
    resolve: (id: number, data: any) =>
      request(`/alarms/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) }),
    updateNote: (id: number, data: { recoveryNote?: string; cause?: string }) =>
      request(`/alarms/${id}/note`, { method: 'PUT', body: JSON.stringify(data) }),
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
  notifications: {
    uploadAlarmSound: (fileData: string) =>
      request('/notifications/alarm-sound', { method: 'POST', body: JSON.stringify({ fileData }) }),
  },
  reports: {
    preview: (customerId: number, startDate: string, endDate: string) =>
      request(`/reports/sla/preview?customerId=${customerId}&startDate=${startDate}&endDate=${endDate}`),
    pdfUrl: (customerId: number, startDate: string, endDate: string) =>
      `${BASE}/reports/sla/pdf?customerId=${customerId}&startDate=${startDate}&endDate=${endDate}&token=${token}`,
    xlsxUrl: (customerId: number, startDate: string, endDate: string) =>
      `${BASE}/reports/sla/xlsx?customerId=${customerId}&startDate=${startDate}&endDate=${endDate}&token=${token}`,
  },
  audit: {
    list: (params?: Record<string, string>) =>
      request(`/audit-logs?${new URLSearchParams(params || {})}`),
  },
}
