import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Search, RefreshCw, ShieldAlert } from 'lucide-react'

const actionTypes = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'USER_CREATE', label: 'User Creation' },
  { value: 'USER_UPDATE', label: 'User Modification' },
  { value: 'USER_DELETE', label: 'User Deletion' },
  { value: 'NODE_CREATE', label: 'Node Creation' },
  { value: 'NODE_UPDATE', label: 'Node Modification' },
  { value: 'NODE_DELETE', label: 'Node Deletion' },
  { value: 'NODE_IMPORT', label: 'Bulk Node Import' },
  { value: 'NODE_MAINTENANCE_TOGGLE', label: 'Maintenance Toggle' },
  { value: 'MAINTENANCE_SCHEDULE', label: 'Maintenance Schedule' },
  { value: 'MAINTENANCE_DELETE', label: 'Maintenance Delete' },
  { value: 'ALARM_RESOLVE', label: 'Alarm Resolution' },
  { value: 'ALARM_NOTE_UPDATE', label: 'Incident Note Edit' },
]

export default function AuditLogs() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const limit = 25

  const loadLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit)
      }
      if (search) params.search = search
      if (actionFilter) params.action = actionFilter
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const res = await api.audit.list(params)
      setLogs(res.logs)
      setTotal(res.total)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, actionFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadLogs()
  }

  const handleResetFilters = () => {
    setSearch('')
    setActionFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    // Small timeout to let state clear
    setTimeout(loadLogs, 50)
  }

  const getActionBadgeClass = (action: string) => {
    if (action === 'LOGIN') {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
    }
    if (action.includes('DELETE') || action.includes('REMOVE')) {
      return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-900/30'
    }
    if (action.includes('CREATE') || action.includes('ADD') || action.includes('IMPORT')) {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/30'
    }
    if (action.includes('MAINTENANCE') || action.includes('SCHEDULE')) {
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200 dark:border-purple-900/30'
    }
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' // updates etc
  }

  const totalPages = Math.ceil(total / limit)

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-white dark:bg-zinc-800 border rounded-xl shadow-sm">
        <ShieldAlert className="w-12 h-12 text-red-500 animate-bounce" />
        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Access Denied</h2>
        <p className="text-xs text-zinc-400 max-w-sm">You do not have the required administrative permissions to view user activity audit logs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-500" />
          <span>User Activity Audit Logs</span>
        </h1>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-400 animate-pulse">Fetching logs...</span>}
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1.5 border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Filters Form Panel */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-zinc-800 border rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="User, target, details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Filter Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-xs dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
            >
              {actionTypes.map((act) => (
                <option key={act.value} value={act.value}>{act.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-xs dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-xs dark:bg-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t dark:border-zinc-700">
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-1.5 text-xs border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors font-medium text-zinc-600 dark:text-zinc-300"
          >
            Reset Filters
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold shadow-sm"
          >
            Apply Search
          </button>
        </div>
      </form>

      {/* Audit Log Table container */}
      <div className="bg-white dark:bg-zinc-800 border rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs">
          <thead className="text-[10px] text-zinc-400 uppercase tracking-wider border-b dark:border-zinc-700">
            <tr>
              <th className="text-left px-4 py-3">Timestamp</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Action Type</th>
              <th className="text-left px-4 py-3">Target Scope</th>
              <th className="text-left px-4 py-3">Details / Context</th>
              <th className="text-left px-4 py-3">Client IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                <td className="px-4 py-3 text-zinc-400 font-medium">
                  {new Date(log.createdAt).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                  {log.username}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadgeClass(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-300">
                  {log.target || '-'}
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[280px] truncate" title={log.details || ''}>
                  {log.details || '-'}
                </td>
                <td className="px-4 py-3 text-zinc-400 font-mono">
                  {log.ipAddress || 'Unknown'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-zinc-400">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Showing {logs.length} of {total} entries</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Previous
          </button>
          <span className="px-2 py-1">
            {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
