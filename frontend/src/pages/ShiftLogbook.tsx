import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  BookOpen, Clock, CheckCircle2, ShieldAlert, Download, Plus, FileText, Send, UserCheck, Wrench
} from 'lucide-react'

export default function ShiftLogbook() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [showForm, setShowForm] = useState(false)
  const [shiftName, setShiftName] = useState('morning')
  const [incomingOperatorName, setIncomingOperatorName] = useState('')
  const [handoverSummary, setHandoverSummary] = useState('')
  const [pendingActionItems, setPendingActionItems] = useState('')
  const [maintenanceNotes, setMaintenanceNotes] = useState('')

  const fetchSummary = () => {
    ;(api as any).shifts.summary().then(setSummary).catch(() => {})
  }

  const fetchLogs = (p = 1) => {
    setLoading(true)
    ;(api as any).shifts.list(p).then((res: any) => {
      setLogs(res.items || [])
      setTotalPages(res.totalPages || 1)
      setPage(res.page || 1)
    }).catch(() => {})
    .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSummary()
    fetchLogs(page)
  }, [page])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incomingOperatorName || !handoverSummary) return
    setSubmitting(true)

    try {
      await (api as any).shifts.create({
        shiftName,
        incomingOperatorName,
        handoverSummary,
        pendingActionItems,
        maintenanceNotes,
      })
      setShowForm(false)
      setHandoverSummary('')
      setPendingActionItems('')
      setMaintenanceNotes('')
      setIncomingOperatorName('')
      fetchLogs(1)
      fetchSummary()
    } catch (err: any) {
      alert(err.message || 'Failed to submit shift logbook')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcknowledge = async (id: number) => {
    try {
      await (api as any).shifts.acknowledge(id)
      fetchLogs(page)
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge shift handover')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-zinc-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              NOC Duty Shift Handover Logbook
            </h1>
            <p className="text-xs text-zinc-300">Buku saku serah terima tugas operasional & serah terima insiden shift NOC</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs"
        >
          {showForm ? 'Close Form' : <><Plus className="w-4 h-4" /> Serah Terima Shift Baru</>}
        </button>
      </div>

      {/* Live Shift Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase">Aktif Saat Ini</div>
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[170px]">
              {summary?.currentShift || 'Morning Shift'}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-600 dark:text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase">Insiden Open</div>
            <div className="text-xl font-black text-red-600 dark:text-red-400">
              {summary?.activeAlarms ?? 0} <span className="text-xs font-medium text-zinc-400">Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase">Pemulihan Hari Ini</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {summary?.resolvedToday ?? 0} <span className="text-xs font-medium text-zinc-400">Resolved</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase">Maintenance Aktif</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {summary?.openMaintenance ?? 0} <span className="text-xs font-medium text-zinc-400">Windows</span>
            </div>
          </div>
        </div>
      </div>

      {/* Handover Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border dark:border-zinc-700 shadow-lg space-y-4 text-xs animate-toast">
          <div className="border-b pb-3 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-500" />
              Formulir Serah Terima Shift NOC
            </h2>
            <span className="text-[11px] text-zinc-400">Petugas Outgoing: <strong className="text-indigo-600">{user?.username}</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold block mb-1">Rotasi Shift</label>
              <select
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-semibold"
              >
                <option value="morning">🌅 Shift Pagi (08:00 - 16:00 WIB)</option>
                <option value="afternoon">🌆 Shift Sore (16:00 - 24:00 WIB)</option>
                <option value="night">🌃 Shift Malam (00:00 - 08:00 WIB)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Nama Petugas Shift Berikutnya (Incoming)</label>
              <input
                type="text"
                required
                placeholder="Contoh: Budi Prasetyo (NOC Tier-1)"
                value={incomingOperatorName}
                onChange={(e) => setIncomingOperatorName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">Ringkasan Operasional & Highlight Insiden</label>
            <textarea
              rows={3}
              required
              placeholder="Tuliskan ringkasan insiden utama, progres pemulihan, dan kondisi jaringan selama shift..."
              value={handoverSummary}
              onChange={(e) => setHandoverSummary(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold block mb-1">Tugas / Action Items Pending untuk Shift Berikutnya</label>
              <textarea
                rows={2}
                placeholder="Misal: Follow up perbaikan kabel FO Gasibu dengan tim splicer..."
                value={pendingActionItems}
                onChange={(e) => setPendingActionItems(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Catatan Work Order / Maintenance</label>
              <textarea
                rows={2}
                placeholder="Misal: Perawatan genset POP Cimahi terjadwal pukul 10:00 WIB..."
                value={maintenanceNotes}
                onChange={(e) => setMaintenanceNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-xl font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Serah Terima Shift'}
            </button>
          </div>
        </form>
      )}

      {/* Logbook Timeline Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border dark:border-zinc-700 shadow-sm overflow-hidden text-xs">
        <div className="p-4 border-b dark:border-zinc-700 flex items-center justify-between">
          <h2 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Riwayat Logbook Serah Terima Shift
          </h2>
          <span className="text-[11px] text-zinc-400 font-medium">{logs.length} Log Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                <th className="p-3">Tanggal & Shift</th>
                <th className="p-3">Petugas Outgoing</th>
                <th className="p-3">Petugas Incoming</th>
                <th className="p-3">Ringkasan Operasional</th>
                <th className="p-3 text-center">Open / Resolved</th>
                <th className="p-3 text-center">Status Sign-off</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-400">Loading shift logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-400">Belum ada riwayat serah terima shift</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                    <td className="p-3 font-semibold">
                      <div className="text-zinc-800 dark:text-zinc-100 font-bold">
                        {new Date(log.shiftDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">
                        {log.shiftName} SHIFT
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-zinc-800 dark:text-zinc-200">{log.outgoingUser?.username}</div>
                      <div className="text-[10px] text-zinc-400">{log.outgoingUser?.role}</div>
                    </td>
                    <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {log.incomingOperatorName}
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="line-clamp-2 text-zinc-600 dark:text-zinc-300 font-medium" title={log.handoverSummary}>
                        {log.handoverSummary}
                      </div>
                      {log.pendingActionItems && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate mt-0.5">
                          Pending: {log.pendingActionItems}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span className="text-red-500">{log.openIncidentsCount}</span> / <span className="text-emerald-500">{log.resolvedIncidentsCount}</span>
                    </td>
                    <td className="p-3 text-center">
                      {log.status === 'acknowledged' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> ACKNOWLEDGED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          <Clock className="w-3 h-3 text-amber-500" /> SUBMITTED
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {log.status !== 'acknowledged' && (
                          <button
                            onClick={() => handleAcknowledge(log.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <UserCheck className="w-3 h-3" /> Sign-off
                          </button>
                        )}
                        <a
                          href={(api as any).shifts.pdfUrl(log.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> PDF ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t dark:border-zinc-700 flex items-center justify-between text-xs text-zinc-500">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
