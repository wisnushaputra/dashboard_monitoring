import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { Activity, Wifi, WifiOff, AlertTriangle, ShieldAlert, Cpu, Users, Brain, TrendingUp, Sparkles } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface Summary {
  totalSites: number
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  activeAlarms: number
  recentEvents: any[]
  nodesStats: any[]
  incidentTrend: any[]
  customerSla: any[]
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)

  const [anomalies, setAnomalies] = useState<any[]>([])

  const load = () => api.events.summary().then(setSummary).catch(() => {})
  const loadAnomalies = () => (api as any).anomalies.list(6).then(setAnomalies).catch(() => {})

  useEffect(() => {
    load()
    loadAnomalies()
    const id = setInterval(() => { load(); loadAnomalies() }, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = () => load()
    socket.on('node:status', handler)
    socket.on('alarm:created', handler)
    socket.on('node:anomaly', () => { load(); loadAnomalies() })
    return () => {
      socket.off('node:status', handler)
      socket.off('alarm:created', handler)
      socket.off('node:anomaly')
    }
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

  const getProgressBarColor = (val: number) => {
    if (val >= 99) return 'bg-emerald-500'
    if (val >= 95) return 'bg-amber-500'
    return 'bg-red-500'
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

      {/* 24-Hour Incident Trend Chart */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-500" />
            24-Hour Incident Trend (Down & Warning Alert Counts)
          </h2>
          <span className="text-[10px] text-zinc-400 font-medium text-right">Hourly Trend</span>
        </div>
        <div className="h-[200px] w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary?.incidentTrend || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWarning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-700/50" />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
                labelClassName="font-bold text-zinc-800"
              />
              <Area type="monotone" dataKey="down" name="Down Alerts" stroke="#ef4444" fillOpacity={1} fill="url(#colorDown)" strokeWidth={2} />
              <Area type="monotone" dataKey="warning" name="Warning Alerts" stroke="#f59e0b" fillOpacity={1} fill="url(#colorWarning)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency Performance Heatmap Grid */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b dark:border-zinc-700/50">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            Network Latency Heatmap
          </h2>
          
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-zinc-500">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-600 block animate-pulse" />
              <span>Low (&lt;50ms)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-600 block" />
              <span>Warn (50-150ms)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-red-500 border border-red-600 block" />
              <span>High (&gt;150ms) / Down</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-fuchsia-500 border border-fuchsia-600 block animate-pulse" />
              <span>Flapping</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-purple-500 border border-purple-600 block" />
              <span>Maint</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-zinc-200 dark:bg-zinc-700 border block" />
              <span>Unknown</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {summary?.nodesStats?.map((node: any) => {
            let bgColor = 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
            let valText = '-'

            if (node.status === 'flapping') {
              bgColor = 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-fuchsia-200 dark:shadow-none animate-pulse'
              valText = 'FLAP'
            } else if (node.status === 'down') {
              bgColor = 'bg-red-500 text-white border-red-600 shadow-red-200 dark:shadow-none'
              valText = 'DOWN'
            } else if (node.status === 'maintenance') {
              bgColor = 'bg-purple-500 text-white border-purple-600 shadow-purple-200 dark:shadow-none'
              valText = 'MNT'
            } else if (node.status === 'up' || node.status === 'warning') {
              if (node.latencyMs !== null && node.latencyMs !== undefined) {
                const lat = Math.round(node.latencyMs)
                valText = `${lat}ms`
                if (lat < 50) {
                  bgColor = 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200 dark:shadow-none'
                } else if (lat < 150) {
                  bgColor = 'bg-amber-500 text-white border-amber-600 shadow-amber-200 dark:shadow-none'
                } else {
                  bgColor = 'bg-red-500 text-white border-red-600 shadow-red-200 dark:shadow-none'
                }
              } else {
                valText = 'UP'
                bgColor = 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200 dark:shadow-none'
              }
            }

            return (
              <div 
                key={node.id} 
                className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center text-[9px] font-bold shadow-sm transition-all hover:scale-110 cursor-default relative group ${bgColor}`}
              >
                <span className="truncate w-full text-center px-1 opacity-75 tracking-tighter uppercase font-mono">
                  {node.name.slice(0, 3)}
                </span>
                <span className="font-semibold text-[8px] tracking-tight">{valText}</span>

                {/* Tooltip Card on Hover */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 w-48 p-2.5 bg-zinc-900 text-white text-[10px] rounded-lg shadow-xl border border-zinc-700 pointer-events-none animate-toast">
                  <div className="font-bold text-xs truncate border-b border-zinc-800 pb-1 mb-1">{node.name}</div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">IP:</span>
                    <span className="font-mono">{node.ipAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <span className="uppercase font-bold">{node.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Latency:</span>
                    <span>{node.latencyMs !== null ? `${Math.round(node.latencyMs)} ms` : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Jitter:</span>
                    <span>{node.jitterMs !== null && node.jitterMs !== undefined ? `${node.jitterMs.toFixed(1)} ms` : '0 ms'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Packet Loss:</span>
                    <span>{node.packetLoss !== null ? `${node.packetLoss}%` : '-'}</span>
                  </div>
                </div>
              </div>
            )
          })}
          {(!summary?.nodesStats || summary.nodesStats.length === 0) && (
            <div className="text-xs text-zinc-400 py-4 w-full text-center">
              No registered nodes to display in latency heatmap
            </div>
          )}
        </div>
      </div>

      {/* Split widgets layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer SLA Leaderboard */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-500" />
              Customer SLA (Last 30 Days)
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">Leaderboard</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[460px] p-4 space-y-4">
            {summary?.customerSla?.map((cust: any, idx: number) => (
              <div key={cust.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 w-4.5 h-4.5 rounded-full flex items-center justify-center font-mono shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate max-w-[120px]" title={cust.name}>
                      {cust.code} - {cust.name}
                    </span>
                  </div>
                  <span className={getSlaColorClass(cust.sla)}>{cust.sla.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-700/50 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(cust.sla)}`} 
                    style={{ width: `${cust.sla}%` }}
                  />
                </div>
              </div>
            ))}
            {(!summary?.customerSla || summary.customerSla.length === 0) && (
              <div className="text-center text-xs py-8 text-zinc-400">
                No customers registered
              </div>
            )}
          </div>
        </div>

        {/* AI Anomaly & Slow Degradation Alert Widget */}
        <div className="bg-gradient-to-br from-purple-900/10 via-white to-indigo-900/10 dark:from-purple-950/30 dark:via-zinc-800 dark:to-indigo-950/30 rounded-xl border border-purple-200 dark:border-purple-900/40 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-purple-100 dark:border-purple-900/40 font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 font-bold">
              <Brain className="w-4 h-4 text-purple-500 animate-pulse" />
              AI Anomaly & Slow Degradation Monitor
            </span>
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Real-time Z-Score Engine
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[460px] p-3 space-y-2.5">
            {anomalies.map((anom: any) => (
              <div
                key={anom.id}
                className="p-3 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                    {anom.node?.name || `Node #${anom.nodeId}`}
                  </span>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    anom.severity === 'critical'
                      ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300 border border-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                  }`}>
                    Z-SCORE {anom.zScore?.toFixed(1)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug font-medium">
                  {anom.message}
                </p>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t dark:border-zinc-800">
                  <span>Current: {anom.currentValue}ms (Base: {anom.baselineAvg}ms)</span>
                  <span>{new Date(anom.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {anomalies.length === 0 && (
              <div className="text-center py-10 text-xs text-zinc-400 space-y-1">
                <Brain className="w-7 h-7 mx-auto text-purple-300 dark:text-purple-800 opacity-60" />
                <div className="font-semibold text-zinc-500 dark:text-zinc-400">All Nodes Operating Within Normal Baseline</div>
                <div className="text-[10px] text-zinc-400">AI Z-Score engine is continuously analyzing latency patterns</div>
              </div>
            )}
          </div>
        </div>

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
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[120px] truncate" title={e.message}>
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
