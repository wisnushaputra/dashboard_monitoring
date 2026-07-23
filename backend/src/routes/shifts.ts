import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import PDFDocument from 'pdfkit'

const router = Router()

// Public or Authenticated PDF streaming route
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid Shift Log ID' })

    const shift = await prisma.shiftLog.findUnique({
      where: { id },
      include: {
        outgoingUser: { select: { username: true, role: true } },
      },
    })

    if (!shift) {
      return res.status(404).json({ error: 'Shift logbook entry not found' })
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    const primaryColor = '#0f172a' // Slate dark
    const secondaryColor = '#2563eb' // Blue
    const lightBg = '#f8fafc'
    const textDark = '#1e293b'
    const textMuted = '#64748b'

    // Header Banner
    doc.rect(40, 40, 515, 60).fill(primaryColor)
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('NOC DUTY SHIFT HANDOVER LOGBOOK', 55, 52)
    doc.fontSize(9).font('Helvetica').fillColor('#cbd5e1').text(`PASSNET NETWORK OPERATIONS CENTER • SHIFT REF: SHIFT-#${shift.id}`, 55, 75)

    // Shift Meta Grid
    let y = 115
    doc.rect(40, y, 515, 80).fillAndStroke(lightBg, '#e2e8f0')

    const shiftDisplay = shift.shiftName.toUpperCase() + ' SHIFT'
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold').text(shiftDisplay, 55, y + 10)

    doc.fontSize(9).font('Helvetica').fillColor(textMuted).text('Date: ', 55, y + 32)
       .font('Helvetica-Bold').fillColor(textDark).text(new Date(shift.shiftDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 90, y + 32)

    doc.font('Helvetica').fillColor(textMuted).text('Outgoing Operator: ', 55, y + 46)
       .font('Helvetica-Bold').fillColor(secondaryColor).text(`${shift.outgoingUser.username} (${shift.outgoingUser.role.toUpperCase()})`, 160, y + 46)

    doc.font('Helvetica').fillColor(textMuted).text('Incoming Operator: ', 55, y + 60)
       .font('Helvetica-Bold').fillColor('#16a34a').text(shift.incomingOperatorName, 160, y + 60)

    // Incident Stats Badges
    doc.rect(380, y + 15, 75, 45).fill('#fee2e2')
    doc.fillColor('#dc2626').fontSize(16).font('Helvetica-Bold').text(String(shift.openIncidentsCount), 380, y + 22, { width: 75, align: 'center' })
    doc.fontSize(7).font('Helvetica').text('OPEN ALARMS', 380, y + 42, { width: 75, align: 'center' })

    doc.rect(465, y + 15, 75, 45).fill('#dcfce7')
    doc.fillColor('#16a34a').fontSize(16).font('Helvetica-Bold').text(String(shift.resolvedIncidentsCount), 465, y + 22, { width: 75, align: 'center' })
    doc.fontSize(7).font('Helvetica').text('RESOLVED', 465, y + 42, { width: 75, align: 'center' })

    // Section 1: Handover Summary
    y += 95
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('1. SHIFT OPERATIONAL SUMMARY & HIGHLIGHTS', 40, y)
    doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

    y += 22
    doc.rect(40, y, 515, 90).fill('#ffffff').stroke('#e2e8f0')
    doc.fillColor(textDark).fontSize(9).font('Helvetica').text(shift.handoverSummary || 'No summary notes recorded.', 50, y + 10, { width: 495 })

    // Section 2: Pending Action Items
    y += 105
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('2. PENDING ACTION ITEMS FOR INCOMING SHIFT', 40, y)
    doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

    y += 22
    doc.rect(40, y, 515, 75).fill('#fffbeb').stroke('#fef3c7')
    doc.fillColor('#92400e').fontSize(9).font('Helvetica').text(shift.pendingActionItems || 'No pending tasks.', 50, y + 10, { width: 495 })

    // Section 3: Maintenance Notes
    y += 90
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('3. SCHEDULED MAINTENANCE & WORK ORDERS', 40, y)
    doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

    y += 22
    doc.rect(40, y, 515, 65).fill('#f1f5f9').stroke('#e2e8f0')
    doc.fillColor(textDark).fontSize(9).font('Helvetica').text(shift.maintenanceNotes || 'No ongoing maintenance windows.', 50, y + 10, { width: 495 })

    // Section 4: Sign-off Signatures
    y += 85
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('4. OPERATOR SIGN-OFF & ACKNOWLEDGEMENT', 40, y)
    doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

    y += 25
    doc.rect(40, y, 240, 70).stroke('#cbd5e1')
    doc.fillColor(textMuted).fontSize(8).font('Helvetica').text('Outgoing Operator Sign-off:', 48, y + 8)
    doc.fillColor(textDark).font('Helvetica-Bold').text(shift.outgoingUser.username, 48, y + 45)
    doc.font('Helvetica').fontSize(7).fillColor(textMuted).text(`Submitted: ${new Date(shift.createdAt).toLocaleString('id-ID')}`, 48, y + 56)

    doc.rect(315, y, 240, 70).stroke('#cbd5e1')
    doc.fillColor(textMuted).fontSize(8).font('Helvetica').text('Incoming Operator Sign-off:', 323, y + 8)
    doc.fillColor(shift.status === 'acknowledged' ? '#16a34a' : '#d97706').font('Helvetica-Bold').text(shift.incomingOperatorName, 323, y + 45)
    doc.font('Helvetica').fontSize(7).fillColor(textMuted).text(shift.status === 'acknowledged' ? `Acknowledged: ${shift.acknowledgedAt ? new Date(shift.acknowledgedAt).toLocaleString('id-ID') : 'Done'}` : 'Status: PENDING ACKNOWLEDGEMENT', 323, y + 56)

    // Footer
    y = 755
    doc.moveTo(40, y).lineTo(555, y).stroke('#cbd5e1')
    doc.fontSize(8).font('Helvetica').fillColor(textMuted)
       .text(`Passnet NOC Shift Management System`, 40, y + 8)
       .text(`Generated: ${new Date().toLocaleString('id-ID')} • OFFICIAL SHIFT LOG`, 40, y + 8, { align: 'right' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ShiftLog-${shift.id}.pdf"`)
    doc.pipe(res)
    doc.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.use(authMiddleware)

// GET /api/shifts/summary - Live shift metrics
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const activeAlarms = await prisma.alarm.count({ where: { status: 'active' } })
    const resolvedToday = await prisma.alarm.count({
      where: {
        status: 'resolved',
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    })
    const openMaintenance = await prisma.maintenanceWindow.count({
      where: { endTime: { gte: new Date() } },
    })

    const hour = new Date().getHours()
    let currentShift = 'Night Shift (00:00 - 08:00)'
    if (hour >= 8 && hour < 16) currentShift = 'Morning Shift (08:00 - 16:00)'
    else if (hour >= 16 && hour < 24) currentShift = 'Afternoon Shift (16:00 - 24:00)'

    res.json({
      activeAlarms,
      resolvedToday,
      openMaintenance,
      currentShift,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/shifts - List shift logs
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.shiftLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          outgoingUser: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.shiftLog.count(),
    ])

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/shifts - Submit new shift handover
router.post('/', async (req: Request, res: Response) => {
  try {
    const { shiftName, incomingOperatorName, handoverSummary, pendingActionItems, maintenanceNotes } = req.body

    if (!shiftName || !incomingOperatorName || !handoverSummary) {
      return res.status(400).json({ error: 'shiftName, incomingOperatorName, and handoverSummary are required' })
    }

    const openAlarms = await prisma.alarm.count({ where: { status: 'active' } })
    const resolvedAlarms = await prisma.alarm.count({
      where: {
        status: 'resolved',
        createdAt: { gte: new Date(Date.now() - 8 * 3600 * 1000) },
      },
    })

    const shift = await prisma.shiftLog.create({
      data: {
        shiftName,
        shiftDate: new Date(),
        outgoingUserId: req.user!.userId,
        incomingOperatorName,
        openIncidentsCount: openAlarms,
        resolvedIncidentsCount: resolvedAlarms,
        handoverSummary,
        pendingActionItems: pendingActionItems || null,
        maintenanceNotes: maintenanceNotes || null,
        status: 'submitted',
      },
    })

    res.json(shift)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/shifts/:id/acknowledge - Sign off shift handover
router.put('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const shift = await prisma.shiftLog.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedBy: req.user!.username,
        acknowledgedAt: new Date(),
      },
    })

    res.json(shift)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
