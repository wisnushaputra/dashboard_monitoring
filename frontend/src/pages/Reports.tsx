import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Download, CheckCircle } from 'lucide-react'

export default function Reports() {
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  
  // Set default dates to current month (e.g. 1st of month to today)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    api.customers.list()
      .then((data) => {
        setCustomers(data)
        if (data.length > 0) {
          setSelectedCustomerId(String(data[0].id))
        }
      })
      .catch(() => {})
  }, [])

  const handlePreview = async () => {
    if (!selectedCustomerId || !startDate || !endDate) return
    setLoading(true)
    setError('')
    setReportData(null)
    try {
      const res = await api.reports.preview(Number(selectedCustomerId), startDate, endDate)
      setReportData(res)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report preview')
    } finally {
      setLoading(false)
    }
  }

  const getSlaBadgeClass = (val: number) => {
    if (val >= 99) return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
    if (val >= 95) return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30'
    return 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30'
  }

  const formatDowntime = (seconds: number) => {
    if (seconds <= 0) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h > 0 ? `${h}h ` : ''}${m}m`
  }

  const downloadPdfUrl = selectedCustomerId
    ? api.reports.pdfUrl(Number(selectedCustomerId), startDate, endDate)
    : ''

  const downloadXlsxUrl = selectedCustomerId
    ? api.reports.xlsxUrl(Number(selectedCustomerId), startDate, endDate)
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Corporate SLA Reports</h1>
      </div>

      {/* Control panel card */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500 block mb-1">Select Corporate Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
            >
              <option value="">Choose a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
            />
          </div>
        </div>

        {error && <div className="text-xs text-red-500 font-medium">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            onClick={handlePreview}
            disabled={loading || !selectedCustomerId}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Preview SLA Report'}
          </button>
          {reportData && (
            <>
              <a
                href={downloadPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
              <a
                href={downloadXlsxUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Preview Section */}
      {reportData && (
        <div className="space-y-6 animate-toast">
          {/* Summary Box */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-zinc-800 dark:to-zinc-800/80 rounded-xl border border-emerald-100 dark:border-zinc-700 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100">SLA REPORT SUMMARY</h3>
              <p className="text-xs text-zinc-500">
                Customer: <strong className="font-semibold">{reportData.customerName}</strong> ({reportData.customerCode})
              </p>
              <p className="text-xs text-zinc-400">
                Period: {new Date(startDate).toLocaleDateString('id-ID')} to {new Date(endDate).toLocaleDateString('id-ID')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Average SLA Availability</span>
                <span className={`text-2xl font-bold ${
                  reportData.summary.avgAvailability >= 99 ? 'text-emerald-500' :
                  reportData.summary.avgAvailability >= 95 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {reportData.summary.avgAvailability.toFixed(3)}%
                </span>
              </div>
            </div>
          </div>

          {/* SLA Separator Section */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Individual Node SLA breakdowns
            </h2>

            {reportData.nodes.map((node: any) => (
              <div key={node.id} className="bg-white dark:bg-zinc-800 rounded-xl border p-5 shadow-sm space-y-4">
                {/* Node info header bar */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-3 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      {node.name}
                    </h3>
                    <div className="text-[11px] text-zinc-400 mt-0.5 space-x-2">
                      <span>IP: <strong className="font-semibold font-mono">{node.ipAddress}</strong></span>
                      <span>•</span>
                      <span className="capitalize">Type: {node.deviceType}</span>
                      {node.location && (
                        <>
                          <span>•</span>
                          <span>Loc: {node.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSlaBadgeClass(node.availability)}`}>
                      SLA Availability: {node.availability.toFixed(3)}%
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 rounded-lg border">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Total Downtime</span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{formatDowntime(node.downtimeSeconds)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Average Latency</span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{node.avgLatencyMs.toFixed(1)} ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Average Packet Loss</span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{node.avgPacketLoss.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Total Outages</span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{node.alarms.length} events</span>
                  </div>
                </div>

                {/* Outage Log Table */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-500 block">Outage & Recovery History</span>
                  {node.alarms.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-[11px] leading-relaxed">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 uppercase font-semibold border-b">
                          <tr>
                            <th className="text-left px-3 py-2">Start Time</th>
                            <th className="text-left px-3 py-2">End Time</th>
                            <th className="text-left px-3 py-2">Duration</th>
                            <th className="text-left px-3 py-2">Recovery Note / Cause</th>
                          </tr>
                        </thead>
                        <tbody>
                          {node.alarms.map((a: any) => (
                            <tr key={a.id} className="border-b last:border-0 hover:bg-zinc-50/20">
                              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 font-mono">{new Date(a.startTime).toLocaleString('id-ID')}</td>
                              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 font-mono">{a.endTime ? new Date(a.endTime).toLocaleString('id-ID') : 'Active'}</td>
                              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 font-mono">
                                {a.duration ? `${Math.floor(a.duration / 60)}m ${a.duration % 60}s` : 'Active'}
                              </td>
                              <td className="px-3 py-2 text-zinc-500 italic">{a.recoveryNote || a.cause || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs border border-emerald-100 dark:border-emerald-900/20">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Compliant SLA. No downtime events recorded for this device.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {reportData.nodes.length === 0 && (
              <div className="text-center py-8 bg-white dark:bg-zinc-800 rounded-xl border text-zinc-400 text-xs shadow-sm">
                No devices associated with this customer
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
