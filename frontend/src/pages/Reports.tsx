import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Download, CheckCircle, Clock, Server, AlertTriangle, Activity, Globe, Send, MessageSquare, CheckCircle2, AlertCircle, Sparkles, DollarSign } from 'lucide-react'
import SlaBillingCalculator from '../components/SlaBillingCalculator'
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, 
  CartesianGrid, AreaChart, Area 
} from 'recharts'

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'sla' | 'mttr' | 'telegram' | 'slaBilling'>('sla')
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  // Telegram settings state
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [teleStatusMsg, setTeleStatusMsg] = useState('')
  const [teleErrorMsg, setTeleErrorMsg] = useState('')
  const [teleLoading, setTeleLoading] = useState(false)
  const [reportPreview, setReportPreview] = useState('')
  
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
  const [mttrData, setMttrData] = useState<any>(null)

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustCode, setNewCustCode] = useState('')
  const [custLoading, setCustLoading] = useState(false)
  const [custError, setCustError] = useState('')

  const loadCustomers = async () => {
    try {
      const data = await api.customers.list()
      const sorted = data.sort((a: any, b: any) => a.name.localeCompare(b.name))
      setCustomers(sorted)
      if (sorted.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(String(sorted[0].id))
      }
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustName || !newCustCode) return
    setCustLoading(true)
    setCustError('')
    try {
      const newCust = await api.customers.create({ name: newCustName, code: newCustCode })
      setShowAddCustomerModal(false)
      setNewCustName('')
      setNewCustCode('')
      const data = await api.customers.list()
      const sorted = data.sort((a: any, b: any) => a.name.localeCompare(b.name))
      setCustomers(sorted)
      if (newCust && newCust.id) {
        setSelectedCustomerId(String(newCust.id))
      }
    } catch (err: any) {
      setCustError(err.message || 'Failed to add customer')
    } finally {
      setCustLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setError('')
    setReportData(null)
    setMttrData(null)
    try {
      if (activeTab === 'sla') {
        if (!selectedCustomerId) {
          setError('Please select a customer first')
          setLoading(false)
          return
        }
        const res = await api.reports.preview(Number(selectedCustomerId), startDate, endDate)
        setReportData(res)
      } else {
        const res = await api.reports.mttr(startDate, endDate)
        setMttrData(res)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report data')
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

  const mttrPdfUrl = api.reports.mttrPdfUrl(startDate, endDate)
  const mttrXlsxUrl = api.reports.mttrXlsxUrl(startDate, endDate)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b dark:border-zinc-700/50 pb-3 gap-3">
        <h1 className="text-lg font-semibold">NOC SLA & MTTR Analytics</h1>
        
        {/* Tab switcher */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border dark:border-zinc-700">
          <button 
            onClick={() => {
              setActiveTab('sla')
              setReportData(null)
              setMttrData(null)
              setError('')
            }}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'sla' 
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Corporate SLA
          </button>
          <button 
            onClick={() => {
              setActiveTab('mttr')
              setReportData(null)
              setMttrData(null)
              setError('')
            }}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'mttr' 
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            MTTR Response
          </button>
          <button 
            onClick={() => {
              setActiveTab('telegram')
              setError('')
              setTeleStatusMsg('')
              setTeleErrorMsg('')
              // Load telegram settings
              api.notifications.get().then((data: any) => {
                setTelegramEnabled(data.telegramEnabled || false)
                setBotToken(data.telegramBotToken || '')
                setChatId(data.telegramChatId || '')
              }).catch(() => {})
            }}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'telegram' 
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-500" />
            Telegram 8 PM Reporter
          </button>
          <button 
            onClick={() => setActiveTab('slaBilling')}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'slaBilling' 
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            SLA Billing & Penalty Calculator
          </button>
        </div>
      </div>

      {/* Render SLA Billing Calculator */}
      {activeTab === 'slaBilling' ? (
        <SlaBillingCalculator />
      ) : (
        <>
          {/* Control panel card */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeTab === 'sla' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-500 block">Select Corporate Customer</label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold transition-colors"
                >
                  + Add Customer
                </button>
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 font-medium"
              >
                <option value="">Choose a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) {c._count?.nodes ? `— ${c._count.nodes} nodes` : ''}
                  </option>
                ))}
              </select>
              {selectedCustomerId && (
                <a
                  href={`/status/${customers.find(c => String(c.id) === selectedCustomerId)?.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" /> Open Public Status Portal ↗
                </a>
              )}
            </div>
          ) : (
            <div className="flex flex-col justify-center">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-200">MTTR Jaringan Agregat</h3>
              <p className="text-[11px] text-zinc-400 mt-1">Mengukur kecepatan respons tanggap insiden sistem monitoring secara global.</p>
            </div>
          )}
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
            disabled={loading || (activeTab === 'sla' && !selectedCustomerId)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : activeTab === 'sla' ? 'Preview SLA Report' : 'Generate MTTR Report'}
          </button>
          {activeTab === 'sla' && reportData && (
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
          {activeTab === 'mttr' && mttrData && (
            <>
              <a
                href={mttrPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
              <a
                href={mttrXlsxUrl}
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

      {/* SLA Preview Section */}
      {activeTab === 'sla' && reportData && (
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b dark:border-zinc-700/50 pb-3 gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{node.name}</h4>
                    <span className="text-xs text-zinc-400 font-mono">{node.ipAddress}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getSlaBadgeClass(node.availability)}`}>
                    SLA: {node.availability.toFixed(3)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-400 block">Total Downtime</span>
                    <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{formatDowntime(node.downtimeSeconds)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Average Latency</span>
                    <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{node.avgLatencyMs ? `${Math.round(node.avgLatencyMs)}ms` : '-'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Average Packet Loss</span>
                    <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{node.avgPacketLoss ? `${node.avgPacketLoss.toFixed(1)}%` : '0%'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Total Alarms Triggered</span>
                    <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{node.alarms.length} Alarms</strong>
                  </div>
                </div>

                {node.alarms.length > 0 && (
                  <div className="border-t dark:border-zinc-700/50 pt-3">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block mb-2">Outage Logs</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-left">
                        <thead>
                          <tr className="text-zinc-400 border-b">
                            <th className="pb-1.5 font-medium">Start Time</th>
                            <th className="pb-1.5 font-medium">End Time</th>
                            <th className="pb-1.5 font-medium">Duration</th>
                            <th className="pb-1.5 font-medium">Resolution Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-700/30">
                          {node.alarms.map((alarm: any) => (
                            <tr key={alarm.id} className="text-zinc-600 dark:text-zinc-400">
                              <td className="py-2">{new Date(alarm.startTime).toLocaleString('id-ID')}</td>
                              <td className="py-2">{alarm.endTime ? new Date(alarm.endTime).toLocaleString('id-ID') : 'Active'}</td>
                              <td className="py-2 font-medium">{formatDowntime(alarm.duration)}</td>
                              <td className="py-2 italic max-w-[200px] truncate" title={alarm.recoveryNote}>
                                {alarm.recoveryNote || 'No notes'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MTTR Preview Section */}
      {activeTab === 'mttr' && mttrData && (
        <div className="space-y-6 animate-toast">
          {/* MTTR Summary Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-zinc-800 dark:to-zinc-800/80 rounded-xl border border-indigo-100 dark:border-zinc-700 p-5 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Total Incidents Resolved</span>
                <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {mttrData.summary.totalResolved} Incidents
                </span>
                <p className="text-xs text-zinc-500">Resolved within selected date range</p>
              </div>
              <CheckCircle className="w-10 h-10 text-indigo-500/20" />
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-zinc-800 dark:to-zinc-800/80 rounded-xl border border-amber-100 dark:border-zinc-700 p-5 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Mean Time to Resolve (MTTR)</span>
                <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {mttrData.summary.mttrFormatted}
                </span>
                <p className="text-xs text-zinc-500">Average response and fix time</p>
              </div>
              <Clock className="w-10 h-10 text-amber-500/20" />
            </div>
          </div>

          {/* MTTR Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily MTTR Trend Chart */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                <Activity className="w-4 h-4 text-indigo-500" />
                Daily Incident Resolution Trend
              </h3>
              <div className="h-[250px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mttrData.resolutionTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMttr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-700/50" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                    <ChartTooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e4e4e7',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                      }}
                      labelClassName="font-bold text-zinc-800"
                    />
                    <Area type="monotone" dataKey="mttrMinutes" name="MTTR (Minutes)" stroke="#6366f1" fillOpacity={1} fill="url(#colorMttr)" strokeWidth={2} />
                    <Area type="monotone" dataKey="count" name="Resolved Count" stroke="#10b981" fillOpacity={0} strokeWidth={1.5} strokeDasharray="3,3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* MTTR by Device Type Bar Chart */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                <Server className="w-4 h-4 text-emerald-500" />
                MTTR by Device Type (Minutes)
              </h3>
              <div className="h-[250px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={mttrData.mttrByDeviceType.map((d: any) => ({
                      deviceType: d.deviceType.toUpperCase(),
                      mttrMinutes: Math.round(d.mttrSeconds / 60),
                      count: d.count
                    }))} 
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-700/50" />
                    <XAxis dataKey="deviceType" tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                    <ChartTooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e4e4e7',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                      }}
                      labelClassName="font-bold text-zinc-800"
                    />
                    <Bar dataKey="mttrMinutes" name="MTTR (Minutes)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Outages List */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-sm flex flex-col">
            <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Top 5 Longest Outages (Resolved)
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">Outage duration sorted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] text-zinc-400 uppercase tracking-wider border-b sticky top-0 bg-white dark:bg-zinc-800 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5">Node / IP</th>
                    <th className="text-left px-4 py-2.5">Cause / Event Details</th>
                    <th className="text-left px-4 py-2.5">Outage Period</th>
                    <th className="text-right px-4 py-2.5">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {mttrData.topOutages?.map((outage: any) => (
                    <tr key={outage.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-700 dark:text-zinc-200">{outage.nodeName}</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{outage.ipAddress}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-700 dark:text-zinc-300">
                          {outage.cause || 'Unknown Cause'}
                        </div>
                        {outage.recoveryNote && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                            Recovery Note: {outage.recoveryNote}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        <div>Start: {new Date(outage.startTime).toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          End: {outage.endTime ? new Date(outage.endTime).toLocaleString('id-ID') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-700 dark:text-zinc-200">
                        {formatDowntime(outage.duration)}
                      </td>
                    </tr>
                  ))}
                  {(!mttrData.topOutages || mttrData.topOutages.length === 0) && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-zinc-400">
                        No outages resolved in this range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Telegram 8 PM Reporter Tab Content */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b dark:border-zinc-700 pb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <Send className="w-4 h-4 text-blue-500" />
                  Integrasi Bot Telegram & Laporan Harian Jam 8 Malam (20:00 WIB)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Konfigurasikan Bot Token & Chat ID Telegram untuk menerima ringkasan otomatis insiden DOWN setiap jam 20:00 WIB.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Status Integrasi:</span>
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded accent-blue-600 cursor-pointer"
                />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${telegramEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700'}`}>
                  {telegramEnabled ? 'Aktif (20:00 ON)' : 'Non-Aktif'}
                </span>
              </label>
            </div>

            {teleStatusMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                {teleStatusMsg}
              </div>
            )}

            {teleErrorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                {teleErrorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyZ"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono dark:bg-zinc-700 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">Dapatkan dari @BotFather di Telegram</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block mb-1">
                  Telegram Chat ID / Group ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. -100123456789 atau @channel_noc"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono dark:bg-zinc-700 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">ID Grup NOC / Channel / Chat User</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={teleLoading || !botToken || !chatId}
                  onClick={async () => {
                    setTeleLoading(true)
                    setTeleStatusMsg('')
                    setTeleErrorMsg('')
                    try {
                      const res = await (api as any).notifications.testTelegram({ botToken, chatId })
                      setTeleStatusMsg(res.message || 'Koneksi Telegram Bot berhasil!')
                    } catch (err: any) {
                      setTeleErrorMsg(err.message || 'Gagal terhubung ke Telegram Bot')
                    } finally {
                      setTeleLoading(false)
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  🧪 Tes Koneksi Bot
                </button>

                <button
                  type="button"
                  disabled={teleLoading || !botToken || !chatId}
                  onClick={async () => {
                    setTeleLoading(true)
                    setTeleStatusMsg('')
                    setTeleErrorMsg('')
                    try {
                      const res = await (api as any).notifications.testTelegramReport({ botToken, chatId })
                      setTeleStatusMsg('Laporan Harian Jam 8 Malam berhasil dikirim ke Telegram!')
                      if (res.reportPreview) setReportPreview(res.reportPreview)
                    } catch (err: any) {
                      setTeleErrorMsg(err.message || 'Gagal mengirim laporan harian')
                    } finally {
                      setTeleLoading(false)
                    }
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Kirim Laporan 8 Malam Sekarang
                </button>
              </div>

              <button
                type="button"
                disabled={teleLoading}
                onClick={async () => {
                  setTeleLoading(true)
                  setTeleStatusMsg('')
                  setTeleErrorMsg('')
                  try {
                    await (api as any).notifications.update({
                      telegramEnabled,
                      telegramBotToken: botToken,
                      telegramChatId: chatId,
                    })
                    setTeleStatusMsg('Konfigurasi Telegram Bot berhasil disimpan!')
                  } catch (err: any) {
                    setTeleErrorMsg(err.message || 'Gagal menyimpan konfigurasi')
                  } finally {
                    setTeleLoading(false)
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>

          {/* Report Format Sample & Preview Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl text-zinc-100 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Format Laporan Tiket Insiden Harian Telegram (20:00 WIB)
              </h3>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full font-mono font-bold">
                STANDAR TIKET NOC
              </span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-xs leading-relaxed text-emerald-400 overflow-x-auto whitespace-pre-wrap selection:bg-emerald-800">
              {reportPreview || `.PASS24072026001 00:01 - 05:00 (5 jam) : Terdeteksi alarm down untuk link backup DIRGANTARA GBU dengan indikasi Penyambungan Kabel Udara (KU) ke Underground di Jl. Diponegoro & Replace ODC Gasibu = CLOSED`}
            </div>

            <div className="text-[11px] text-zinc-400 leading-snug space-y-1">
              <p>📌 <b>Ketentuan Format Tiket Telegram:</b></p>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
                <li><code className="text-blue-300">.PASS&lt;DDMMYYYY&gt;&lt;SEQ&gt;</code> — Kode Tiket otomatis unik berurutan per hari.</li>
                <li><code className="text-blue-300">Waktu Down & Durasi</code> — Jam mulai hingga jam pulih (contoh: <code>00:01 - 05:00 (5 jam)</code>).</li>
                <li><code className="text-blue-300">Indikasi Penanganan</code> — Mengambil catatan pemulihan/penyebab insiden dari NOC.</li>
                <li><code className="text-blue-300">= CLOSED / = OPEN</code> — Status penutupan tiket insiden otomatis.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-toast">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-md w-full p-6 shadow-2xl border dark:border-zinc-700 space-y-4">
            <div className="flex items-center justify-between border-b dark:border-zinc-700 pb-3">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Add New Corporate Customer</h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              {custError && <div className="text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30">{custError}</div>}

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT Telkom Indonesia Tbk"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block mb-1">Customer Code / ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TELKOM-BDG"
                  value={newCustCode}
                  onChange={(e) => setNewCustCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={custLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {custLoading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )}
</div>
)
}
