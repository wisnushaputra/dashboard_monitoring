import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

export default function History() {
  const [nodes, setNodes] = useState<any[]>([])
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [data, setData] = useState<any>(null)
  const [days, setDays] = useState(7)

  useEffect(() => {
    api.nodes.list().then(setNodes).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedNode) return
    api.events.history(selectedNode, days).then(setData).catch(() => {})
  }, [selectedNode, days])

  // Latency chart data
  const chartData = data?.events?.map((e: any) => ({
    time: new Date(e.timestamp).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    latency: e.latencyMs || 0,
    eventType: e.eventType,
    idx: e.id,
  })) || []

  // Build Gantt-like data: group events into down periods
  const ganttData = data?.alarms?.map((a: any) => {
    const start = new Date(a.startTime)
    const end = a.endTime ? new Date(a.endTime) : new Date()
    const computedDuration = a.duration || Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
    const labelStart = start.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const labelEnd = end.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return {
      name: `${labelStart} - ${labelEnd}`,
      duration: Math.round(computedDuration / 60), // in minutes
      status: a.status,
      id: a.id,
    }
  }) || []

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">History Monitoring</h1>

      <div className="flex flex-wrap gap-2 items-center">
        <select className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 flex-1 min-w-[200px]"
          value={selectedNode ?? ''} onChange={(e) => setSelectedNode(parseInt(e.target.value) || null)}>
          <option value="">Select a node...</option>
          {nodes.map((n: any) => <option key={n.id} value={n.id}>{n.name} ({n.ipAddress})</option>)}
        </select>
        <select className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={1}>24 hours</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Alarms', value: data.stats.totalAlarms, color: 'text-red-500' },
              { label: 'Total Downtime', value: `${Math.round(data.stats.totalDowntime / 60)}m`, color: 'text-amber-500' },
              { label: 'Availability', value: `${data.stats.availability}%`, color: 'text-emerald-500' },
              { label: 'Events', value: data.events.length, color: 'text-blue-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-zinc-800 rounded-xl border p-4">
                <div className="text-xs text-zinc-500">{s.label}</div>
                <div className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Latency Chart */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border p-4">
            <h3 className="text-sm font-medium mb-3">Latency Timeline</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <XAxis dataKey="time" tick={false} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-zinc-400">No data available</div>
            )}
          </div>

          {/* Downtime Gantt Chart */}
          {ganttData.length > 0 && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl border p-4">
              <h3 className="text-sm font-medium mb-3">Downtime Events (minutes)</h3>
              <ResponsiveContainer width="100%" height={Math.max(100, ganttData.length * 40)}>
                <BarChart data={ganttData} layout="vertical" margin={{ left: 180, right: 20 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={170} />
                  <Tooltip formatter={(value: any) => `${value}m`} />
                  <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                    {ganttData.map((entry: any) => (
                      <Cell key={entry.id} fill={entry.status === 'active' ? '#ef4444' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Event Timeline */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border">
            <div className="px-4 py-3 border-b font-medium text-sm">Event Timeline</div>
            <div className="divide-y text-sm max-h-64 overflow-y-auto">
              {data.events.map((e: any) => (
                <div key={e.id} className="px-4 py-2 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    e.eventType === 'down' ? 'bg-red-500' : e.eventType === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-zinc-500 text-xs shrink-0">{new Date(e.timestamp).toLocaleString('id-ID')}</span>
                  <span className={`font-medium text-xs px-1.5 py-0.5 rounded ${
                    e.eventType === 'down' ? 'bg-red-100 text-red-700' : e.eventType === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{e.eventType}</span>
                  <span className="text-zinc-400 truncate">{e.message}</span>
                </div>
              ))}
              {data.events.length === 0 && <div className="text-center py-4 text-zinc-400">No events</div>}
            </div>
          </div>
        </>
      )}

      {!data && selectedNode && <div className="text-center py-8 text-zinc-400">Loading...</div>}
    </div>
  )
}
