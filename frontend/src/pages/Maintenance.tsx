import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Calendar, Wrench, Trash2, Clock, AlertTriangle, CheckCircle2, Search, Sliders } from 'lucide-react'

export default function Maintenance() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Form states
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick stats
  const [stats, setStats] = useState({
    active: 0,
    upcoming: 0,
    expired: 0,
    manual: 0
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [nodesList, mWindows] = await Promise.all([
        api.nodes.list(),
        api.nodes.listAllMaintenanceWindows()
      ])
      
      setNodes(nodesList)
      setSchedules(mWindows)
      
      // Calculate stats
      const now = new Date().getTime()
      let activeCount = 0
      let upcomingCount = 0
      let expiredCount = 0
      
      mWindows.forEach((mw: any) => {
        const start = new Date(mw.startTime).getTime()
        const end = new Date(mw.endTime).getTime()
        if (now >= start && now <= end) {
          activeCount++
        } else if (now < start) {
          upcomingCount++
        } else {
          expiredCount++
        }
      })

      const manualCount = nodesList.filter((n: any) => n.isMaintenance).length
      
      setStats({
        active: activeCount,
        upcoming: upcomingCount,
        expired: expiredCount,
        manual: manualCount
      })
    } catch (err: any) {
      setError(err.message || 'Failed to fetch maintenance details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNodeId || !startTime || !endTime) {
      setError('Please select a node, start time, and end time.')
      return
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (end <= start) {
      setError('End time must be after start time.')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await api.nodes.createMaintenanceWindow(Number(selectedNodeId), {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description
      })
      setSuccess('Maintenance schedule created successfully!')
      setSelectedNodeId('')
      setStartTime('')
      setEndTime('')
      setDescription('')
      await loadData()
      
      // Hide success message after 4s
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to create maintenance schedule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this maintenance schedule?')) return
    setError('')
    setSuccess('')
    try {
      await api.nodes.deleteMaintenanceWindow(id)
      setSuccess('Maintenance schedule deleted.')
      await loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete schedule')
    }
  }

  const handleToggleManualNode = async (nodeId: number, currentStatus: boolean) => {
    setError('')
    try {
      await api.nodes.toggleMaintenance(nodeId, !currentStatus)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to toggle node maintenance status')
    }
  }

  const getWindowStatus = (startStr: string, endStr: string) => {
    const now = new Date().getTime()
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()

    if (now >= start && now <= end) {
      return { label: 'Active', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-900/30' }
    } else if (now < start) {
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/30' }
    } else {
      return { label: 'Expired', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/50' }
    }
  }

  const filteredSchedules = schedules.filter((s: any) => {
    const searchLower = searchTerm.toLowerCase()
    const nodeName = s.node?.name?.toLowerCase() || ''
    const nodeIp = s.node?.ipAddress?.toLowerCase() || ''
    const desc = s.description?.toLowerCase() || ''
    return nodeName.includes(searchLower) || nodeIp.includes(searchLower) || desc.includes(searchLower)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-500" />
          <span>Scheduled Maintenance Window</span>
        </h1>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-400 animate-pulse">Loading...</span>}
          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs px-3 py-1.5 border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Quick stats board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Active Schedules</span>
            <span className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{stats.active}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Upcoming Windows</span>
            <span className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{stats.upcoming}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Manual Mode Active</span>
            <span className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{stats.manual}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-700/30 text-zinc-500 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Expired Schedules</span>
            <span className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{stats.expired}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form container - 1 column */}
        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Schedule New Maintenance</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Define times to suppress ping alerts & downtime logging.</p>
          </div>

          {user?.role === 'viewer' ? (
            <div className="text-xs text-zinc-400 text-center py-4 bg-zinc-50 dark:bg-zinc-900/20 rounded-lg">
              You do not have permissions to schedule maintenance.
            </div>
          ) : (
            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Target Node / Device</label>
                <select
                  required
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select device...</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.ipAddress}) - {node.deviceType.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Start Time</label>
                  <input
                    required
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">End Time</label>
                  <input
                    required
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Description / Reason</label>
                <textarea
                  placeholder="e.g., Scheduled OS Patching, Fiber Cut Repair"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-purple-500/10 hover:shadow-purple-500/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating schedule...' : 'Create Schedule Window'}
              </button>
            </form>
          )}

          {/* Quick toggle list for Manual Mode */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wider">Quick Manual Toggle</h4>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {nodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between p-2 border rounded-lg bg-zinc-50 dark:bg-zinc-900/30 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold block truncate text-zinc-700 dark:text-zinc-200">{node.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{node.ipAddress}</span>
                  </div>
                  <button
                    disabled={user?.role === 'viewer'}
                    onClick={() => handleToggleManualNode(node.id, node.isMaintenance)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                      node.isMaintenance
                        ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 hover:bg-purple-200'
                        : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300'
                    } disabled:opacity-40`}
                  >
                    {node.isMaintenance ? 'ON (Maint)' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Schedule List & Table - 2 columns */}
        <div className="bg-white dark:bg-zinc-800 border rounded-xl p-5 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">All Scheduled Windows</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">Check state and durations of existing scheduling entries.</p>
            </div>
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search node, IP or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 bg-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-zinc-400 uppercase tracking-wider border-b">
                <tr>
                  <th className="text-left px-3 py-2">Device / Node</th>
                  <th className="text-left px-3 py-2">Schedules</th>
                  <th className="text-left px-3 py-2">Reason / Details</th>
                  <th className="text-left px-3 py-2">Status</th>
                  {user?.role !== 'viewer' && <th className="text-left px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                {filteredSchedules.map((mw: any) => {
                  const state = getWindowStatus(mw.startTime, mw.endTime)
                  return (
                    <tr key={mw.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-100">{mw.node?.name || 'Unknown Node'}</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{mw.node?.ipAddress}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {new Date(mw.startTime).toLocaleString('id-ID')}
                        </div>
                        <div className="text-zinc-400 text-[10px] mt-0.5">
                          to {new Date(mw.endTime).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400 max-w-[180px] truncate" title={mw.description || '-'}>
                        {mw.description || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${state.color}`}>
                          {state.label}
                        </span>
                      </td>
                      {user?.role !== 'viewer' && (
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDeleteSchedule(mw.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {filteredSchedules.length === 0 && (
                  <tr>
                    <td colSpan={user?.role !== 'viewer' ? 5 : 4} className="text-center py-8 text-zinc-400">
                      No maintenance schedules found.
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
