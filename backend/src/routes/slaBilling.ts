import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import PDFDocument from 'pdfkit'

const router = Router()

// Public or Authenticated PDF streaming route for SLA Penalty Refund Invoice PDF
router.get('/pdf/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId)
    const monthYear = (req.query.monthYear as string) || new Date().toISOString().substring(0, 7)

    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid Customer ID' })

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { nodes: { select: { id: true, name: true, ipAddress: true, deviceType: true } } },
    })

    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    // Calculate month metrics
    const totalMonthMins = 30 * 24 * 60 // 43,200 mins
    const contractedSla = customer.slaTarget || 99.5
    const monthlyFee = customer.monthlyFee || 15000000

    const customerNodeIds = customer.nodes.map((n) => n.id)

    // Calculate total downtime for customer's nodes
    const alarms = await prisma.alarm.findMany({
      where: {
        nodeId: { in: customerNodeIds },
        createdAt: { gte: new Date(`${monthYear}-01T00:00:00.000Z`) },
      },
    })

    let totalDowntimeSecs = 0
    alarms.forEach((a) => {
      if (a.duration) totalDowntimeSecs += a.duration
      else if (a.status === 'active') {
        totalDowntimeSecs += Math.floor((Date.now() - new Date(a.startTime).getTime()) / 1000)
      }
    })

    const totalDowntimeMins = Math.round((totalDowntimeSecs / 60) * 10) / 10
    const allowedDowntimeMins = Math.round(totalMonthMins * (1 - contractedSla / 100) * 10) / 10
    const excessDowntimeMins = Math.max(0, Math.round((totalDowntimeMins - allowedDowntimeMins) * 10) / 10)

    const actualUptimePct = Math.min(100, Math.max(0, Math.round(((totalMonthMins - totalDowntimeMins) / totalMonthMins) * 10000) / 100))

    let penaltyPct = 0
    const gap = Math.round((contractedSla - actualUptimePct) * 100) / 100
    if (gap > 0) {
      if (gap <= 0.5) penaltyPct = 5.0
      else if (gap <= 1.0) penaltyPct = 15.0
      else penaltyPct = 30.0
    }

    const penaltyAmountIdr = Math.round(monthlyFee * (penaltyPct / 100))
    const netBillAmountIdr = monthlyFee - penaltyAmountIdr

    // Format Rupiah IDR
    const formatRp = (num: number) => `Rp ${Math.round(num).toLocaleString('id-ID')}`

    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    const primaryColor = '#1e1b4b' // Dark Indigo
    const accentColor = penaltyPct > 0 ? '#dc2626' : '#16a34a'

    // Header Banner
    doc.rect(40, 40, 515, 65).fill(primaryColor)
    doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text('CORPORATE SLA PENALTY & REFUND INVOICE ADJUSTMENT', 55, 50)
    doc.fontSize(8).font('Helvetica').fillColor('#cbd5e1').text(`PASSNET BILLING & NOC OPERATIONS • PERIOD: ${monthYear} • CLIENT CODE: ${customer.code}`, 55, 75)

    // Customer Meta Card
    let y = 120
    doc.rect(40, y, 515, 80).fillAndStroke('#f8fafc', '#e2e8f0')

    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text(customer.name, 55, y + 10)

    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Contracted Monthly Service Fee: ', 55, y + 30)
       .font('Helvetica-Bold').fillColor('#1e293b').text(formatRp(monthlyFee), 195, y + 30)

    doc.font('Helvetica').fillColor('#64748b').text('Contracted SLA Target: ', 55, y + 44)
       .font('Helvetica-Bold').fillColor('#2563eb').text(`${contractedSla}% Target Uptime`, 195, y + 44)

    doc.font('Helvetica').fillColor('#64748b').text('Monitored Sites / Nodes: ', 55, y + 58)
       .font('Helvetica-Bold').fillColor('#1e293b').text(`${customer.nodes.length} Nodes Monitored`, 195, y + 58)

    // Status Badge
    doc.rect(430, y + 12, 110, 22).fill(accentColor)
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text(penaltyPct > 0 ? 'PENALTY APPLIED' : 'SLA COMPLIANT', 435, y + 18, { width: 100, align: 'center' })

    // SLA Metrics Breakdown Section
    y += 95
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('1. MONTHLY SLA UPTIME & DOWNTIME METRICS', 40, y)
    doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke('#cbd5e1')

    y += 20
    const colW = 120
    doc.rect(40, y, colW, 45).fill('#f1f5f9')
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('ACTUAL UPTIME', 40, y + 8, { width: colW, align: 'center' })
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold').text(`${actualUptimePct}%`, 40, y + 20, { width: colW, align: 'center' })

    doc.rect(170, y, colW, 45).fill('#f1f5f9')
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('TOTAL DOWNTIME', 170, y + 8, { width: colW, align: 'center' })
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(`${totalDowntimeMins} Mins`, 170, y + 20, { width: colW, align: 'center' })

    doc.rect(300, y, colW, 45).fill('#f1f5f9')
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('ALLOWED DOWNTIME', 300, y + 8, { width: colW, align: 'center' })
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(`${allowedDowntimeMins} Mins`, 300, y + 20, { width: colW, align: 'center' })

    doc.rect(430, y, colW, 45).fill('#f1f5f9')
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('EXCESS DOWNTIME', 430, y + 8, { width: colW, align: 'center' })
    doc.fillColor(excessDowntimeMins > 0 ? '#dc2626' : '#16a34a').fontSize(14).font('Helvetica-Bold').text(`${excessDowntimeMins} Mins`, 430, y + 20, { width: colW, align: 'center' })

    // Financial Calculation Table
    y += 60
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('2. BILLING ADJUSTMENT & SLA REFUND CALCULATION', 40, y)
    doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke('#cbd5e1')

    y += 20
    doc.rect(40, y, 515, 18).fill('#2563eb')
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
       .text('Billing Item Description', 50, y + 4)
       .text('Rate / Percentage', 350, y + 4)
       .text('Amount (IDR)', 470, y + 4)

    y += 18
    doc.rect(40, y, 515, 20).fill('#ffffff').stroke('#f1f5f9')
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica').text('Contracted Base Monthly Subscription Fee', 50, y + 5)
    doc.text('100.0%', 350, y + 5)
    doc.font('Helvetica-Bold').text(formatRp(monthlyFee), 460, y + 5)

    y += 20
    doc.rect(40, y, 515, 20).fill(penaltyPct > 0 ? '#fef2f2' : '#ffffff').stroke('#f1f5f9')
    doc.fillColor(penaltyPct > 0 ? '#dc2626' : '#16a34a').fontSize(8).font('Helvetica-Bold')
       .text(`SLA Breach Penalty Refund (${penaltyPct}% Discount)`, 50, y + 5)
       .text(`-${penaltyPct}%`, 350, y + 5)
       .text(`- ${formatRp(penaltyAmountIdr)}`, 460, y + 5)

    y += 20
    doc.rect(40, y, 515, 24).fill('#f8fafc').stroke('#cbd5e1')
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
       .text('NET ADJUSTED MONTHLY INVOICE TO CLIENT', 50, y + 6)
       .text(`${100 - penaltyPct}%`, 350, y + 6)
       .text(formatRp(netBillAmountIdr), 460, y + 6)

    // Incidents Audit Log Table
    y += 35
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`3. INCIDENT AUDIT LOG FOR PERIOD (${alarms.length} Outages)`, 40, y)
    doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke('#cbd5e1')

    y += 20
    doc.rect(40, y, 515, 18).fill('#1e1b4b')
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
       .text('Incident Start Time (WIB)', 50, y + 4)
       .text('Downtime Duration', 220, y + 4)
       .text('Outage Cause / Recovery Note', 340, y + 4)

    y += 18
    if (alarms.length > 0) {
      alarms.slice(0, 6).forEach((a, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        doc.rect(40, y, 515, 20).fillAndStroke(bg, '#f1f5f9')
        doc.fillColor('#1e293b').fontSize(7).font('Helvetica').text(new Date(a.startTime).toLocaleString('id-ID'), 50, y + 5)
        doc.text(`${a.duration ? Math.floor(a.duration / 60) : '-'} Mins`, 220, y + 5)
        doc.text(a.recoveryNote || a.cause || 'Network Link Outage', 340, y + 5, { width: 210 })
        y += 20
      })
    } else {
      doc.rect(40, y, 515, 20).fill('#ffffff')
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No outage alarms recorded during this monthly billing period.', 50, y + 5)
      y += 20
    }

    // Signatures
    y = 750
    doc.moveTo(40, y).lineTo(555, y).stroke('#cbd5e1')
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
       .text(`Billing Manager: Passnet Corporate Finance`, 40, y + 8)
       .text(`Generated: ${new Date().toLocaleString('id-ID')} • OFFICIAL SLA ADJUSTMENT`, 40, y + 8, { align: 'right' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="SLA-Invoice-${customer.code}-${monthYear}.pdf"`)
    doc.pipe(res)
    doc.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.use(authMiddleware)

// GET /api/sla-billing - Calculate monthly SLA billing for all corporate customers
router.get('/', async (req: Request, res: Response) => {
  try {
    const monthYear = (req.query.monthYear as string) || new Date().toISOString().substring(0, 7)
    const totalMonthMins = 30 * 24 * 60 // 43,200 mins

    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        nodes: { select: { id: true, name: true, ipAddress: true, deviceType: true } },
      },
    })

    const results = await Promise.all(
      customers.map(async (cust) => {
        const contractedSla = cust.slaTarget || 99.5
        const monthlyFee = cust.monthlyFee || 15000000

        const customerNodeIds = cust.nodes.map((n) => n.id)

        const alarms = await prisma.alarm.findMany({
          where: {
            nodeId: { in: customerNodeIds },
            createdAt: { gte: new Date(`${monthYear}-01T00:00:00.000Z`) },
          },
        })

        let totalDowntimeSecs = 0
        alarms.forEach((a) => {
          if (a.duration) totalDowntimeSecs += a.duration
          else if (a.status === 'active') {
            totalDowntimeSecs += Math.floor((Date.now() - new Date(a.startTime).getTime()) / 1000)
          }
        })

        const totalDowntimeMins = Math.round((totalDowntimeSecs / 60) * 10) / 10
        const allowedDowntimeMins = Math.round(totalMonthMins * (1 - contractedSla / 100) * 10) / 10
        const excessDowntimeMins = Math.max(0, Math.round((totalDowntimeMins - allowedDowntimeMins) * 10) / 10)

        const actualUptimePct = Math.min(100, Math.max(0, Math.round(((totalMonthMins - totalDowntimeMins) / totalMonthMins) * 10000) / 100))

        let penaltyPct = 0
        const gap = Math.round((contractedSla - actualUptimePct) * 100) / 100
        if (gap > 0) {
          if (gap <= 0.5) penaltyPct = 5.0
          else if (gap <= 1.0) penaltyPct = 15.0
          else penaltyPct = 30.0
        }

        const penaltyAmountIdr = Math.round(monthlyFee * (penaltyPct / 100))
        const netBillAmountIdr = monthlyFee - penaltyAmountIdr

        return {
          customerId: cust.id,
          customerName: cust.name,
          customerCode: cust.code,
          nodesCount: cust.nodes.length,
          contractedSla,
          monthlyFee,
          actualUptimePct,
          totalDowntimeMins,
          allowedDowntimeMins,
          excessDowntimeMins,
          penaltyPct,
          penaltyAmountIdr,
          netBillAmountIdr,
          status: penaltyPct > 0 ? 'penalty_applied' : 'compliant',
        }
      })
    )

    res.json({
      monthYear,
      customers: results,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/sla-billing/customer/:customerId/contract - Update contract SLA & Fee
router.put('/customer/:customerId/contract', async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId)
    const { slaTarget, monthlyFee } = req.body

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(slaTarget !== undefined && { slaTarget: parseFloat(slaTarget) }),
        ...(monthlyFee !== undefined && { monthlyFee: parseFloat(monthlyFee) }),
      },
    })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
