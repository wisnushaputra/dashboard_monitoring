import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import { generateRcaPdfStream } from '../lib/rcaEngine'

const router = Router()

// Public or Authenticated PDF streaming route (support token query param for PDF download link)
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid RCA ID' })

    const rca = await prisma.rcaReport.findUnique({
      where: { id },
      include: {
        node: {
          include: { customer: { select: { name: true, code: true } } },
        },
        alarm: true,
      },
    })

    if (!rca) {
      return res.status(404).json({ error: 'RCA report not found' })
    }

    let chronology = []
    try { chronology = JSON.parse(rca.chronologyJson || '[]') } catch (_) {}

    let actionItems = []
    try { actionItems = JSON.parse(rca.actionItemsJson || '[]') } catch (_) {}

    const doc = generateRcaPdfStream({
      ticketId: rca.ticketId,
      title: rca.title,
      nodeName: rca.node.name,
      nodeIp: rca.node.ipAddress,
      deviceType: rca.node.deviceType,
      customerName: rca.node.customer?.name,
      incidentStartTime: rca.incidentStartTime,
      incidentEndTime: rca.incidentEndTime,
      durationMinutes: rca.durationMinutes,
      severity: rca.severity,
      rootCauseCategory: rca.rootCauseCategory,
      rootCauseDescription: rca.rootCauseDescription,
      executiveSummary: rca.executiveSummary,
      chronology,
      actionItems,
      authorName: rca.authorName,
      createdAt: rca.createdAt,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="RCA-${rca.ticketId}.pdf"`)

    doc.pipe(res)
    doc.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.use(authMiddleware)

// GET /api/rca - List all RCA reports
router.get('/', async (req: Request, res: Response) => {
  try {
    const reports = await prisma.rcaReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        node: { select: { id: true, name: true, ipAddress: true, deviceType: true } },
        alarm: { select: { id: true, cause: true, recoveryNote: true } },
      },
    })
    res.json(reports)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rca - Create RCA report
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alarmId, nodeId, title, rootCauseCategory, rootCauseDescription, executiveSummary, chronology, actionItems, severity } = req.body

    let targetNodeId = nodeId
    let startTime = new Date()
    let endTime: Date | null = null
    let durationMins = 0

    if (alarmId) {
      const alarm = await prisma.alarm.findUnique({ where: { id: alarmId } })
      if (alarm) {
        targetNodeId = alarm.nodeId
        startTime = alarm.startTime
        endTime = alarm.endTime
        if (alarm.duration) {
          durationMins = Math.floor(alarm.duration / 60)
        }
      }
    }

    if (!targetNodeId) {
      return res.status(400).json({ error: 'nodeId or valid alarmId is required' })
    }

    const count = await prisma.rcaReport.count()
    const ticketId = `RCA-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`

    const node = await prisma.node.findUnique({ where: { id: targetNodeId } })

    const rca = await prisma.rcaReport.create({
      data: {
        ticketId,
        title: title || `Incident RCA Report: ${node?.name || 'Node Service Outage'}`,
        nodeId: targetNodeId,
        alarmId: alarmId || null,
        incidentStartTime: startTime,
        incidentEndTime: endTime,
        durationMinutes: durationMins,
        severity: severity || 'major',
        rootCauseCategory: rootCauseCategory || 'fiber_cut',
        rootCauseDescription: rootCauseDescription || 'Penanganan dan perbaikan jaringan sedang dianalisis.',
        executiveSummary: executiveSummary || `Terjadi insiden gangguan jaringan pada ${node?.name}. Pemulihan telah dilakukan oleh tim NOC.`,
        chronologyJson: JSON.stringify(chronology || [
          { timestamp: startTime.toLocaleTimeString('id-ID'), description: `Terdeteksi alarm DOWN pada perangkat ${node?.name}` },
          { timestamp: (endTime || new Date()).toLocaleTimeString('id-ID'), description: `Koneksi perangkat kembali UP & alarm resolved` },
        ]),
        actionItemsJson: JSON.stringify(actionItems || [
          { action: 'Inspeksi & monitoring berkala pasca-pemulihan', owner: 'NOC Tier-1', dueDate: '1-Day', status: 'Completed' },
        ]),
        authorName: req.user?.username || 'NOC Operations Team',
      },
    })

    res.json(rca)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/rca/:id - Get RCA details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const rca = await prisma.rcaReport.findUnique({
      where: { id },
      include: {
        node: { select: { id: true, name: true, ipAddress: true, deviceType: true, location: true } },
        alarm: true,
      },
    })

    if (!rca) return res.status(404).json({ error: 'RCA report not found' })
    res.json(rca)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/rca/:id - Update RCA report
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { title, severity, rootCauseCategory, rootCauseDescription, executiveSummary, chronology, actionItems } = req.body

    const rca = await prisma.rcaReport.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(severity && { severity }),
        ...(rootCauseCategory && { rootCauseCategory }),
        ...(rootCauseDescription !== undefined && { rootCauseDescription }),
        ...(executiveSummary !== undefined && { executiveSummary }),
        ...(chronology !== undefined && { chronologyJson: JSON.stringify(chronology) }),
        ...(actionItems !== undefined && { actionItemsJson: JSON.stringify(actionItems) }),
      },
    })

    res.json(rca)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
