import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { Activity, Wifi, WifiOff, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react'

interface Summary {
  totalSites: number
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  activeAlarms: number
  recentEvents: any[]
  nodesStats: any[]
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
    { label: 'Total Sites', value: summary?.totalSites ?? '-', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20' },
    { label: 'Node Online', value: summary?.onlineNodes ?? '-', icon: Wifi, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
    { label: 'Node Offline', value: summary?.offlineNodes ?? '-', icon: WifiOff, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20' },
    { label: 'Active Alarms', value: summary?.activeAlarms ?? '-', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  ]

  const getSlaColorClass = (val: number) => {
    if (val >= 99) return 'text-emerald-600 dark:text-emerald-400 font-bold'
    if (val >= 95) return 'text-amber-600 dark:text-amber-400 font-semibold'
    return 'text-red-600 dark:text-red-400 font-bold'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard Overview</h1>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-zinc-800 rounded-xl border p-4 flex items-center gap-3 shadow-sm hover:shadow transition-shadow">
            <div className={`p-2.5 rounded-lg ${c.bg}`}>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="text-[10px] uppercase font-semibold text-zinc-400">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Split widgets layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Performance & SLA Table */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-500" />
              Node Performance & SLA (Last 7 Days)
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">Availability Stats</span>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-zinc-400 uppercase tracking-wider border-b sticky top-0 bg-white dark:bg-zinc-800 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5">Node / IP</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Latency & Loss</th>
                  <th className="text-right px-4 py-2.5">7-Day SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                {summary?.nodesStats?.map((node: any) => (
                  <tr key={node.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-700 dark:text-zinc-200">{node.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{node.ipAddress}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        node.status === 'up' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                        node.status === 'down' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 animate-pulse' :
                        node.status === 'maintenance' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                      }`}>
                        {node.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      <div>{node.latencyMs ? `${Math.round(node.latencyMs)}ms` : '-'} Latency</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{node.packetLoss ?? 0}% Loss</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getSlaColorClass(node.availability)}>
                        {node.availability.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!summary?.nodesStats || summary.nodesStats.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-zinc-400">
                      No nodes registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Events List */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Recent Incidents & Events
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">Real-time Feed</span>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-zinc-400 uppercase tracking-wider border-b sticky top-0 bg-white dark:bg-zinc-800 z-10">
                <tr className="border-b">
                  <th className="text-left px-4 py-2.5">Node</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Event Details</th>
                  <th className="text-right px-4 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                {summary?.recentEvents?.map((e: any) => (
                  <tr key={e.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                      {e.node?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        e.eventType === 'down' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 animate-pulse' :
                        e.eventType === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                      }`}>{e.eventType.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[150px] truncate" title={e.message}>
                      {e.message}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {new Date(e.timestamp).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
                {(!summary?.recentEvents || summary.recentEvents.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-zinc-400">
                      No recent events
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
