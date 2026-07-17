import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

interface Summary {
  totalSites: number
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  activeAlarms: number
  recentEvents: any[]
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)

  const load = () => api.events.summary().then(setSummary).catch(() => {})
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [])

  useEffect(() => {
    const handler = () => load()
    socket.on('node:status', handler)
    socket.on('alarm:created', handler)
    return () => { socket.off('node:status', handler); socket.off('alarm:created', handler) }
  }, [])

  const cards = [
    { label: 'Total Sites', value: summary?.totalSites ?? '-', icon: Activity, color: 'text-blue-500' },
    { label: 'Node Online', value: summary?.onlineNodes ?? '-', icon: Wifi, color: 'text-emerald-500' },
    { label: 'Node Offline', value: summary?.offlineNodes ?? '-', icon: WifiOff, color: 'text-red-500' },
    { label: 'Active Alarms', value: summary?.activeAlarms ?? '-', icon: AlertTriangle, color: 'text-amber-500' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-zinc-800 rounded-xl border p-4 flex items-center gap-3">
            <c.icon className={`w-8 h-8 ${c.color}`} />
            <div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-zinc-500">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl border">
        <div className="px-4 py-3 border-b font-medium text-sm">Recent Events</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 uppercase">
              <tr className="border-b">
                <th className="text-left px-4 py-2">Node</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Event</th>
                <th className="text-left px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {summary?.recentEvents?.map((e: any) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{e.node?.name || 'N/A'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      e.eventType === 'down' ? 'bg-red-100 text-red-700' :
                      e.eventType === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{e.eventType}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{e.message}</td>
                  <td className="px-4 py-2 text-zinc-400">{new Date(e.timestamp).toLocaleString('id-ID')}</td>
                </tr>
              ))}
              {(!summary?.recentEvents || summary.recentEvents.length === 0) && (
                <tr><td colSpan={4} className="text-center py-6 text-zinc-400">No recent events</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
