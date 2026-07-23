import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck,
  Activity, Server, RefreshCw, Calendar, ArrowLeft
} from 'lucide-react'

export default function PublicStatus() {
  const { customerCode } = useParams<{ customerCode: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStatus = async () => {
    if (!customerCode) return
    try {
      const res = await (api as any).publicStatus.get(customerCode)
      setData(res)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load status page')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    const id = setInterval(loadStatus, 30000)
    return () => clearInterval(id)
  }, [customerCode])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return {
          text: 'ALL SYSTEMS OPERATIONAL',
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
          iconColor: 'text-emerald-500',
        }
      case 'degraded':
        return {
          text: 'PARTIAL SERVICE DEGRADATION',
          bg: 'bg-amber-500/10 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/30',
          icon: AlertTriangle,
          iconColor: 'text-amber-500',
        }
      case 'outage':
        return {
          text: 'MAJOR SERVICE OUTAGE',
          bg: 'bg-red-500/10 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-500/30',
          icon: XCircle,
          iconColor: 'text-red-500',
        }
      case 'maintenance':
        return {
          text: 'SCHEDULED MAINTENANCE UNDERWAY',
          bg: 'bg-purple-500/10 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-500/30',
          icon: Clock,
          iconColor: 'text-purple-500',
        }
      default:
        return {
          text: 'OPERATIONAL',
          bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
          icon: CheckCircle2,
          iconColor: 'text-emerald-500',
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
          <div className="text-sm font-semibold text-slate-300">Loading Network Status Portal...</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-100">Customer Status Page Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || `No registered network customer status found for code [${customerCode}]`}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go to NOC Login
          </Link>
        </div>
      </div>
    )
  }

  const badgeInfo = getStatusBadge(data.overallStatus)
  const BadgeIcon = badgeInfo.icon

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-600 selection:text-white">
      {/* Top Banner Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-extrabold text-lg">
              {data.customer.code.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-100 tracking-tight leading-snug">
                {data.customer.name}
              </h1>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                  {data.customer.code}
                </span>
                <span>• Service Level Status Portal</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={loadStatus}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              NOC Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Main Status Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overall Status Banner */}
        <div className={`p-6 rounded-2xl border ${badgeInfo.bg} shadow-xl backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 shrink-0">
              <BadgeIcon className={`w-8 h-8 ${badgeInfo.iconColor}`} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Current Network Health</div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">{badgeInfo.text}</h2>
            </div>
          </div>
          <div className="text-right sm:border-l sm:border-slate-800/60 sm:pl-6">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">30-Day SLA Uptime</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{data.sla30Days.toFixed(2)}%</div>
          </div>
        </div>

        {/* 30-Day Daily Availability Bar Chart */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              30-Day Service Availability Timeline
            </h3>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full font-mono">
              {data.sla30Days.toFixed(2)}% Operational Uptime
            </span>
          </div>

          {/* Daily Status Blocks */}
          <div className="flex items-center justify-between gap-1 pt-2">
            {data.dailyHistory.map((day: any, idx: number) => {
              const bg =
                day.status === 'operational'
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                  : day.status === 'degraded'
                    ? 'bg-amber-500 hover:bg-amber-400'
                    : 'bg-red-500 hover:bg-red-400'

              return (
                <div key={idx} className="flex-1 group relative cursor-pointer">
                  <div className={`h-10 rounded-md transition-all duration-200 shadow-sm ${bg}`} />
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-36 p-2 bg-slate-950 text-slate-100 text-[10px] rounded-lg border border-slate-700 shadow-2xl pointer-events-none text-center">
                    <div className="font-mono text-slate-400 border-b border-slate-800 pb-1 mb-1">{day.date}</div>
                    <div className="font-extrabold uppercase text-emerald-400">{day.status}</div>
                    <div className="text-[9px] text-slate-300 mt-0.5">SLA: {day.sla}%</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
            <span>30 Days Ago</span>
            <span>15 Days Ago</span>
            <span>Today (Live)</span>
          </div>
        </div>

        {/* Monitored Customer Services & Node List */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-400" />
              Monitored Network Infrastructure & Customer POPs ({data.nodes.length})
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Auto-refreshed live</span>
          </div>

          <div className="space-y-2">
            {data.nodes.map((node: any) => {
              const isFlapping = node.status === 'flapping'
              const isDown = node.status === 'down'
              const isMaint = node.status === 'maintenance' || node.isMaintenance

              const statusClass = isDown
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : isFlapping
                  ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30 animate-pulse'
                  : isMaint
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'

              return (
                <div
                  key={node.id}
                  className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
                      style={{
                        backgroundColor: isDown ? '#ef4444' : isFlapping ? '#d946ef' : isMaint ? '#a855f7' : '#10b981'
                      }}
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-200 flex items-center gap-2">
                        <span>{node.name}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {node.deviceType}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                        <span>IP: {node.ipAddress}</span>
                        {node.location && <span>Location: {node.location}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                    <div className="text-right font-mono text-[10px] text-slate-400">
                      <div>Latency: <span className="text-slate-200 font-bold">{node.latencyMs ? `${Math.round(node.latencyMs)} ms` : '-'}</span></div>
                      <div>Jitter: <span className="text-slate-200 font-bold">{node.jitterMs !== undefined && node.jitterMs !== null ? `${node.jitterMs.toFixed(1)} ms` : '0 ms'}</span></div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${statusClass}`}>
                      {node.status}
                    </span>
                  </div>
                </div>
              )
            })}
            {data.nodes.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-500">
                No active network nodes mapped to this corporate account.
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Maintenance Section */}
        {data.maintenanceWindows && data.maintenanceWindows.length > 0 && (
          <div className="bg-purple-950/20 border border-purple-900/40 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              Active & Upcoming Scheduled Maintenance
            </h3>
            <div className="space-y-2">
              {data.maintenanceWindows.map((mw: any) => (
                <div key={mw.id} className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-xs space-y-1">
                  <div className="font-bold text-purple-200 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    {new Date(mw.startTime).toLocaleString('id-ID')} — {new Date(mw.endTime).toLocaleString('id-ID')}
                  </div>
                  {mw.description && (
                    <div className="text-[11px] text-purple-300/80">{mw.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incident History Timeline */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            Recent Incident Log & Resolved Activity (Last 7 Days)
          </h3>

          <div className="space-y-3">
            {data.recentIncidents.map((inc: any) => (
              <div key={inc.id} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {inc.nodeName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(inc.startTime).toLocaleString()}
                  </span>
                </div>
                {inc.cause && (
                  <div className="text-[11px] text-amber-300/90 font-medium">Cause: {inc.cause}</div>
                )}
                {inc.recoveryNote && (
                  <div className="text-[11px] text-emerald-400 font-medium">Resolution: {inc.recoveryNote}</div>
                )}
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900 flex justify-between">
                  <span>Status: <strong className="text-slate-300 uppercase">{inc.status}</strong></span>
                  <span>Duration: {inc.duration ? `${Math.floor(inc.duration / 60)} mins` : 'Ongoing'}</span>
                </div>
              </div>
            ))}
            {data.recentIncidents.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-500">
                No recent incidents reported in the last 7 days.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-500 py-6 border-t border-slate-900 space-y-1">
          <div>Enterprise NOC Network Monitoring System • Powered by Passnet Operations</div>
          <div>Last Updated: {new Date(data.updatedAt).toLocaleString()}</div>
        </footer>
      </main>
    </div>
  )
}
