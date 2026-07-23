import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import {
  DollarSign, AlertTriangle, CheckCircle2, Download, Settings, Calendar, Building2, TrendingDown
} from 'lucide-react'

export default function SlaBillingCalculator() {
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().substring(0, 7))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Edit Contract Modal
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [slaTargetInput, setSlaTargetInput] = useState('')
  const [monthlyFeeInput, setMonthlyFeeInput] = useState('')
  const [savingContract, setSavingContract] = useState(false)

  const fetchData = (mY: string) => {
    setLoading(true)
    ;(api as any).slaBilling.get(mY).then(setData).catch(() => {})
    .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData(monthYear)
  }, [monthYear])

  const formatRp = (amount: number) => {
    return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
  }

  const handleEditClick = (cust: any) => {
    setEditingCustomer(cust)
    setSlaTargetInput(String(cust.contractedSla))
    setMonthlyFeeInput(String(cust.monthlyFee))
  }

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return
    setSavingContract(true)

    try {
      await (api as any).slaBilling.updateContract(editingCustomer.customerId, {
        slaTarget: parseFloat(slaTargetInput),
        monthlyFee: parseFloat(monthlyFeeInput),
      })
      setEditingCustomer(null)
      fetchData(monthYear)
    } catch (err: any) {
      alert(err.message || 'Failed to update contract SLA')
    } finally {
      setSavingContract(false)
    }
  }

  const totalContractVal = data?.customers?.reduce((acc: number, c: any) => acc + c.monthlyFee, 0) || 0
  const totalPenaltyVal = data?.customers?.reduce((acc: number, c: any) => acc + c.penaltyAmountIdr, 0) || 0
  const totalNetBillVal = data?.customers?.reduce((acc: number, c: any) => acc + c.netBillAmountIdr, 0) || 0
  const penaltyCount = data?.customers?.filter((c: any) => c.penaltyPct > 0).length || 0

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-800 p-5 rounded-2xl border dark:border-zinc-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              Corporate SLA Penalty & Refund Calculator
            </h2>
            <p className="text-xs text-zinc-400">Kalkulasi otomatis penyesuaian tagihan bulanan & denda refund SLA pelanggan korporat</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="px-3 py-1.5 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-bold text-xs"
          />
        </div>
      </div>

      {/* Financial Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Total Nilai Kontrak Bulanan</div>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
            {formatRp(totalContractVal)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">{data?.customers?.length || 0} Corporate Accounts</div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Total Klaim Denda SLA (Refund)</div>
          <div className="text-xl font-black text-red-600 dark:text-red-400 flex items-center gap-1">
            <TrendingDown className="w-5 h-5 text-red-500" />
            {formatRp(totalPenaltyVal)}
          </div>
          <div className="text-[10px] text-red-500 font-semibold mt-1">{penaltyCount} Pelanggan Terkena Denda</div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Net Tagihan Setelah Denda</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatRp(totalNetBillVal)}
          </div>
          <div className="text-[10px] text-emerald-500 font-semibold mt-1">Estimasi Pendapatan Net</div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border dark:border-zinc-700 shadow-sm">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Status Kepatuhan SLA</div>
          <div className="text-xl font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {(data?.customers?.length || 0) - penaltyCount} / {data?.customers?.length || 0}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">Pelanggan Memenuhi Target SLA</div>
        </div>
      </div>

      {/* Customer SLA Penalty Calculation Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border dark:border-zinc-700 shadow-sm overflow-hidden text-xs">
        <div className="p-4 border-b dark:border-zinc-700 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" />
            Tabel Rekapitulasi Denda & Penyesuaian Tagihan Pelanggan ({monthYear})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                <th className="p-3">Pelanggan Korporat</th>
                <th className="p-3">Biaya Langganan / Bln</th>
                <th className="p-3 text-center">Target vs Actual SLA</th>
                <th className="p-3 text-center">Downtime Mins</th>
                <th className="p-3 text-center">Denda Refund (%)</th>
                <th className="p-3 text-right">Potongan Denda (Rp)</th>
                <th className="p-3 text-right">Tagihan Net (Rp)</th>
                <th className="p-3 text-center">Status SLA</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-zinc-400">Menghitung kalkulasi billing SLA...</td>
                </tr>
              ) : !data?.customers || data.customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-zinc-400">Tidak ada data pelanggan korporat</td>
                </tr>
              ) : (
                data.customers.map((cust: any) => (
                  <tr key={cust.customerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-zinc-800 dark:text-zinc-100">{cust.customerName}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{cust.customerCode} • {cust.nodesCount} Nodes</div>
                    </td>
                    <td className="p-3 font-bold text-zinc-700 dark:text-zinc-300">
                      {formatRp(cust.monthlyFee)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="font-extrabold text-zinc-800 dark:text-zinc-100">
                        {cust.actualUptimePct}%
                      </div>
                      <div className="text-[10px] text-zinc-400">Target: {cust.contractedSla}%</div>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{cust.totalDowntimeMins}m</span>
                      {cust.excessDowntimeMins > 0 && (
                        <div className="text-[10px] font-bold text-red-500">+{cust.excessDowntimeMins}m excess</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {cust.penaltyPct > 0 ? (
                        <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/30">
                          -{cust.penaltyPct}%
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">0%</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                      {cust.penaltyAmountIdr > 0 ? `- ${formatRp(cust.penaltyAmountIdr)}` : 'Rp 0'}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {formatRp(cust.netBillAmountIdr)}
                    </td>
                    <td className="p-3 text-center">
                      {cust.penaltyPct > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                          <AlertTriangle className="w-3 h-3 text-red-500" /> PENALTY
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> COMPLIANT
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(cust)}
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors"
                          title="Edit Contract SLA & Monthly Fee"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={(api as any).slaBilling.pdfUrl(cust.customerId, monthYear)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Invoice PDF ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Contract Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-toast">
          <form onSubmit={handleSaveContract} className="bg-white dark:bg-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 border dark:border-zinc-700 shadow-2xl text-xs">
            <div className="border-b pb-3 dark:border-zinc-700 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100">
                Edit Kontrak SLA Pelanggan
              </h3>
              <span className="text-xs font-bold text-indigo-600">{editingCustomer.customerName}</span>
            </div>

            <div>
              <label className="font-semibold block mb-1">Target SLA Kontrak (%)</label>
              <select
                value={slaTargetInput}
                onChange={(e) => setSlaTargetInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-bold"
              >
                <option value="99.9">99.9% Target Uptime (Tier 1 Premium)</option>
                <option value="99.5">99.5% Target Uptime (Standard Corporate)</option>
                <option value="99.0">99.0% Target Uptime (Basic Enterprise)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Biaya Langganan Bulanan (IDR Rupiah)</label>
              <input
                type="number"
                required
                value={monthlyFeeInput}
                onChange={(e) => setMonthlyFeeInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-zinc-700 dark:border-zinc-600 font-bold text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 border rounded-xl font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingContract}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {savingContract ? 'Saving...' : 'Simpan Kontrak'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
