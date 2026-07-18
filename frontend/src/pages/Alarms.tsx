import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { useAuth } from '../context/AuthContext'
import { Search, Download } from 'lucide-react'

const deviceTypes = ['router', 'switch', 'firewall', 'server', 'olt', 'ap', 'modem', 'ups']

export default function Alarms() {
  const { user } = useAuth()
  const [alarms, setAlarms] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [filter, setFilter] = useState({ status: '', deviceType: '', customerId: '', startDate: '', endDate: '' })
  const [resolveNote, setResolveNote] = useState('')
  const [resolveId, setResolveId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNoteText, setEditNoteText] = useState('')
  const limit = 25

  useEffect(() => { api.customers.list().then(setCustomers).catch(() => {}) }, [])

  const load = async () => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) }
    if (search) params.search = search
    if (filter.status) params.status = filter.status
    if (filter.deviceType) params.deviceType = filter.deviceType
    if (filter.customerId) params.customerId = filter.customerId
    if (filter.startDate) params.startDate = filter.startDate
    if (filter.endDate) params.endDate = filter.endDate
    const res = await api.alarms.list(params)
    setAlarms(res.alarms)
    setTotal(res.total)
  }

  useEffect(() => { load() }, [page, filter])

  useEffect(() => {
    socket.on('alarm:created', load)
    socket.on('alarm:resolved', load)
    return () => { socket.off('alarm:created', load); socket.off('alarm:resolved', load) }
  }, [])

  const handleResolve = async () => {
    if (resolveId === null) return
    await api.alarms.resolve(resolveId, { recoveryNote: resolveNote })
    setResolveId(null)
    setResolveNote('')
    load()
  }

  const handleSaveNote = async () => {
    if (editId === null) return
    await api.alarms.updateNote(editId, { recoveryNote: editNoteText })
    setEditId(null)
    setEditNoteText('')
    load()
  }

  const totalPages = Math.ceil(total / limit)

  const exportUrl = (fmt: string) => {
    const p: Record<string, string> = {}
    if (filter.status) p.status = filter.status
    if (filter.startDate) p.startDate = filter.startDate
    if (filter.endDate) p.endDate = filter.endDate
    return (api.export as any)[`alarms${fmt}`](p)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Alarm & Event Log</h1>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" placeholder="Search node..." value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <select className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={filter.status}
          onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1) }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
        </select>
        <select className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={filter.deviceType}
          onChange={(e) => { setFilter({ ...filter, deviceType: e.target.value }); setPage(1) }}>
          <option value="">All Types</option>
          {deviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={filter.customerId}
          onChange={(e) => { setFilter({ ...filter, customerId: e.target.value }); setPage(1) }}>
          <option value="">All Customers</option>
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={filter.startDate}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} />
        <input type="date" className="px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={filter.endDate}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} />
        <div className="flex gap-1">
          {['Xlsx', 'Csv', 'Pdf'].map((fmt) => (
            <a key={fmt} href={exportUrl(fmt)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-2 border rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <Download className="w-3 h-3" />{fmt}
            </a>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase border-b">
            <tr>
              <th className="text-left px-4 py-2">Node</th>
              <th className="text-left px-4 py-2">IP</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Start</th>
              <th className="text-left px-4 py-2">Duration</th>
              <th className="text-left px-4 py-2">Cause</th>
              <th className="text-left px-4 py-2">Note</th>
              {user?.role !== 'viewer' && <th className="text-left px-4 py-2">Action</th>}
            </tr>
          </thead>
          <tbody>
            {alarms.map((a: any) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{a.node?.name}</td>
                <td className="px-4 py-2 text-zinc-500">{a.node?.ipAddress}</td>
                <td className="px-4 py-2 text-zinc-500">{a.node?.deviceType}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    a.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{a.status}</span>
                </td>
                <td className="px-4 py-2 text-zinc-400">{new Date(a.startTime).toLocaleString('id-ID')}</td>
                <td className="px-4 py-2 text-zinc-500">{a.duration ? `${a.duration}s` : '-'}</td>
                <td className="px-4 py-2 text-zinc-500 max-w-[200px] truncate" title={a.cause || 'Primary Outage'}>
                  {a.cause ? (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 font-medium">
                      {a.cause}
                    </span>
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border dark:border-zinc-700 font-medium">
                      Primary Outage
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-400 max-w-[200px] truncate">{a.recoveryNote || '-'}</td>
                {user?.role !== 'viewer' && (
                  <td className="px-4 py-2">
                    {a.status === 'active' ? (
                      <button onClick={() => setResolveId(a.id)}
                        className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                        Resolve
                      </button>
                    ) : (
                      <button onClick={() => { setEditId(a.id); setEditNoteText(a.recoveryNote || '') }}
                        className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-semibold transition-colors">
                        Edit Note
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {alarms.length === 0 && <tr><td colSpan={user?.role !== 'viewer' ? 9 : 8} className="text-center py-6 text-zinc-400">No alarms</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>{total} total</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-30">Prev</button>
          <span className="px-2 py-1">{page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-30">Next</button>
        </div>
      </div>

      {resolveId !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-toast" onClick={() => setResolveId(null)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-lg p-5 w-full max-w-sm m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-4">Resolve Alarm</h2>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" rows={3} placeholder="Recovery note..." value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setResolveId(null)} className="px-3 py-1.5 text-xs rounded-lg border">Cancel</button>
              <button onClick={handleResolve} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">Resolve</button>
            </div>
          </div>
        </div>
      )}

      {editId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-toast" onClick={() => setEditId(null)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl p-5 w-full max-w-sm m-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="border-b pb-2">
              <h2 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Edit Outage/Recovery Note</h2>
            </div>
            <textarea 
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100" 
              rows={3} 
              placeholder="Enter details of the issue / resolution..." 
              value={editNoteText} 
              onChange={(e) => setEditNoteText(e.target.value)} 
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs rounded-lg border font-semibold">Cancel</button>
              <button onClick={handleSaveNote} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
