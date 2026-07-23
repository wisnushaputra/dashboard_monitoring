import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import {
  FileText, Download, X, Plus, Trash2, CheckCircle2, Clock, ShieldAlert, Save
} from 'lucide-react'

interface RcaModalProps {
  alarmId?: number
  rcaId?: number
  nodeId?: number
  nodeName?: string
  isOpen: boolean
  onClose: () => void
}

export default function RcaModal({ alarmId, rcaId, nodeId, nodeName, isOpen, onClose }: RcaModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [id, setId] = useState<number | null>(rcaId || null)
  const [ticketId, setTicketId] = useState('')
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('major')
  const [rootCauseCategory, setRootCauseCategory] = useState('fiber_cut')
  const [rootCauseDescription, setRootCauseDescription] = useState('')
  const [executiveSummary, setExecutiveSummary] = useState('')
  const [chronology, setChronology] = useState<Array<{ timestamp: string; description: string }>>([])
  const [actionItems, setActionItems] = useState<Array<{ action: string; owner: string; dueDate: string; status: string }>>([])

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setSuccessMsg('')

    if (rcaId) {
      ;(api as any).rca.get(rcaId).then((rca: any) => {
        setId(rca.id)
        setTicketId(rca.ticketId)
        setTitle(rca.title)
        setSeverity(rca.severity)
        setRootCauseCategory(rca.rootCauseCategory)
        setRootCauseDescription(rca.rootCauseDescription)
        setExecutiveSummary(rca.executiveSummary)
        try { setChronology(JSON.parse(rca.chronologyJson || '[]')) } catch (_) { setChronology([]) }
        try { setActionItems(JSON.parse(rca.actionItemsJson || '[]')) } catch (_) { setActionItems([]) }
      }).catch((err: any) => setError(err.message))
    } else if (alarmId || nodeId) {
      setTitle(`Incident Post-Mortem: ${nodeName || 'Service Outage'}`)
      setExecutiveSummary(`Terjadi gangguan konektivitas pada ${nodeName || 'node'}. Tindakan penanganan dan verifikasi telah dilakukan oleh tim NOC.`)
      setRootCauseDescription(`Penanganan pemulihan kabel/perangkat dilakukan di lokasi insiden.`)
      setChronology([
        { timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), description: `Alarm DOWN terdeteksi pada ${nodeName || 'node'}` },
        { timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), description: `Pemulihan koneksi berhasil & alarm resolved` },
      ])
      setActionItems([
        { action: 'Inspeksi & monitoring stabilitas pasca-pemulihan', owner: 'NOC Tier-1', dueDate: '1 Day', status: 'Completed' },
      ])
    }
  }, [isOpen, rcaId, alarmId, nodeId, nodeName])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccessMsg('')

    const payload = {
      alarmId,
      nodeId,
      title,
      severity,
      rootCauseCategory,
      rootCauseDescription,
      executiveSummary,
      chronology,
      actionItems,
    }

    try {
      let result: any
      if (id) {
        result = await (api as any).rca.update(id, payload)
      } else {
        result = await (api as any).rca.create(payload)
        setId(result.id)
        setTicketId(result.ticketId)
      }
      setSuccessMsg('RCA Report successfully saved!')
    } catch (err: any) {
      setError(err.message || 'Failed to save RCA Report')
    } finally {
      setSaving(false)
    }
  }

  const addChronologyRow = () => {
    setChronology([...chronology, { timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), description: '' }])
  }

  const removeChronologyRow = (idx: number) => {
    setChronology(chronology.filter((_, i) => i !== idx))
  }

  const addActionItemRow = () => {
    setActionItems([...actionItems, { action: '', owner: 'NOC Team', dueDate: '3 Days', status: 'In Progress' }])
  }

  const removeActionItemRow = (idx: number) => {
    setActionItems(actionItems.filter((_, i) => i !== idx))
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-toast">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border dark:border-zinc-700 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-zinc-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                Incident Post-Mortem & RCA Generator
                {ticketId && <span className="text-xs bg-indigo-500/30 border border-indigo-400/40 px-2 py-0.5 rounded font-mono">{ticketId}</span>}
              </h2>
              <p className="text-[11px] text-zinc-300">Generate & export official Root Cause Analysis PDF report</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-zinc-800 dark:text-zinc-200">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-300 rounded-xl font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-xl font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {successMsg}
            </div>
          )}

          {/* Incident Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="font-semibold block mb-1">RCA Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Incident Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-semibold uppercase"
              >
                <option value="critical">🔴 CRITICAL</option>
                <option value="major">🟠 MAJOR</option>
                <option value="minor">🔵 MINOR</option>
              </select>
            </div>
          </div>

          {/* Root Cause Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold block mb-1">Root Cause Category</label>
              <select
                value={rootCauseCategory}
                onChange={(e) => setRootCauseCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              >
                <option value="fiber_cut">✂️ Fiber Optic Cut / Break</option>
                <option value="hardware_failure">⚡ Hardware / Power Failure</option>
                <option value="power_outage">🔌 PLN Mains Power Outage</option>
                <option value="software_bug">🐛 Firmware / OS Routing Bug</option>
                <option value="human_error">⚠️ Configuration Misconfig</option>
                <option value="third_party">🌐 Upstream ISP / 3rd Party</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="font-semibold block mb-1">Root Cause Detailed Description</label>
              <textarea
                rows={2}
                value={rootCauseDescription}
                onChange={(e) => setRootCauseDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
              />
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <label className="font-semibold block mb-1">Executive Summary (Ringkasan Eksekutif)</label>
            <textarea
              rows={3}
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-medium"
            />
          </div>

          {/* Incident Chronology Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                <Clock className="w-4 h-4 text-indigo-500" />
                Incident Chronology Timeline ({chronology.length})
              </span>
              <button
                type="button"
                onClick={addChronologyRow}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold rounded-lg text-[11px] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Event
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {chronology.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border">
                  <input
                    type="text"
                    placeholder="HH:mm"
                    value={item.timestamp}
                    onChange={(e) => {
                      const updated = [...chronology]
                      updated[idx].timestamp = e.target.value
                      setChronology(updated)
                    }}
                    className="w-24 px-2 py-1 border rounded-lg dark:bg-zinc-700 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="Event description / NOC action..."
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...chronology]
                      updated[idx].description = e.target.value
                      setChronology(updated)
                    }}
                    className="flex-1 px-2 py-1 border rounded-lg dark:bg-zinc-700 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeChronologyRow(idx)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Corrective Action Items Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                Corrective Actions & Preventive Matrix ({actionItems.length})
              </span>
              <button
                type="button"
                onClick={addActionItemRow}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold rounded-lg text-[11px] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Action Item
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {actionItems.map((act, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border text-[11px]">
                  <input
                    type="text"
                    placeholder="Action item / measure..."
                    value={act.action}
                    onChange={(e) => {
                      const updated = [...actionItems]
                      updated[idx].action = e.target.value
                      setActionItems(updated)
                    }}
                    className="flex-1 px-2 py-1 border rounded-lg dark:bg-zinc-700"
                  />
                  <input
                    type="text"
                    placeholder="Owner"
                    value={act.owner}
                    onChange={(e) => {
                      const updated = [...actionItems]
                      updated[idx].owner = e.target.value
                      setActionItems(updated)
                    }}
                    className="w-24 px-2 py-1 border rounded-lg dark:bg-zinc-700"
                  />
                  <select
                    value={act.status}
                    onChange={(e) => {
                      const updated = [...actionItems]
                      updated[idx].status = e.target.value
                      setActionItems(updated)
                    }}
                    className="w-28 px-2 py-1 border rounded-lg dark:bg-zinc-700 font-semibold"
                  >
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Open">Open</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeActionItemRow(idx)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t dark:border-zinc-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {id && (
              <a
                href={(api as any).rca.pdfUrl(id)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export Official RCA PDF ↗
              </a>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save RCA Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
