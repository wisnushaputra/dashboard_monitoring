import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const router = Router()

router.use(authMiddleware)

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID')
}

router.get('/alarms/xlsx', async (req: Request, res: Response) => {
  const { startDate, endDate, status } = req.query
  const where: any = {}
  if (status) where.status = status
  if (startDate || endDate) {
    where.startTime = {}
    if (startDate) where.startTime.gte = new Date(startDate as string)
    if (endDate) where.startTime.lte = new Date(endDate as string)
  }

  const alarms = await prisma.alarm.findMany({
    where,
    include: { node: { select: { name: true, ipAddress: true, deviceType: true, customer: { select: { name: true } } } } },
    orderBy: { startTime: 'desc' },
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Alarms')

  ws.columns = [
    { header: 'Customer', key: 'customer', width: 20 },
    { header: 'Node', key: 'node', width: 20 },
    { header: 'IP Address', key: 'ip', width: 16 },
    { header: 'Device Type', key: 'deviceType', width: 14 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Start Time', key: 'startTime', width: 22 },
    { header: 'End Time', key: 'endTime', width: 22 },
    { header: 'Duration (s)', key: 'duration', width: 12 },
    { header: 'Cause', key: 'cause', width: 20 },
    { header: 'Recovery Note', key: 'recoveryNote', width: 20 },
  ]

  alarms.forEach((a) => {
    ws.addRow({
      customer: a.node.customer?.name || '-',
      node: a.node.name,
      ip: a.node.ipAddress,
      deviceType: a.node.deviceType,
      status: a.status,
      startTime: formatDate(a.startTime),
      endTime: formatDate(a.endTime),
      duration: a.duration || 0,
      cause: a.cause || '-',
      recoveryNote: a.recoveryNote || '-',
    })
  })

  ws.getRow(1).font = { bold: true }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=alarms.xlsx')
  await wb.xlsx.write(res)
  res.end()
})

router.get('/alarms/csv', async (req: Request, res: Response) => {
  const { startDate, endDate, status } = req.query
  const where: any = {}
  if (status) where.status = status
  if (startDate || endDate) {
    where.startTime = {}
    if (startDate) where.startTime.gte = new Date(startDate as string)
    if (endDate) where.startTime.lte = new Date(endDate as string)
  }

  const alarms = await prisma.alarm.findMany({
    where,
    include: { node: { select: { name: true, ipAddress: true, deviceType: true, customer: { select: { name: true } } } } },
    orderBy: { startTime: 'desc' },
  })

  const header = 'Customer,Node,IP Address,Device Type,Status,Start Time,End Time,Duration (s),Cause,Recovery Note\n'
  const rows = alarms.map((a) =>
    `"${a.node.customer?.name || '-'}","${a.node.name}","${a.node.ipAddress}","${a.node.deviceType}","${a.status}","${formatDate(a.startTime)}","${formatDate(a.endTime)}","${a.duration || 0}","${a.cause || ''}","${a.recoveryNote || ''}"`
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=alarms.csv')
  res.send(header + rows)
})

router.get('/alarms/pdf', async (req: Request, res: Response) => {
  const { startDate, endDate, status } = req.query
  const where: any = {}
  if (status) where.status = status
  if (startDate || endDate) {
    where.startTime = {}
    if (startDate) where.startTime.gte = new Date(startDate as string)
    if (endDate) where.startTime.lte = new Date(endDate as string)
  }

  const alarms = await prisma.alarm.findMany({
    where,
    include: { node: { select: { name: true, ipAddress: true, deviceType: true, customer: { select: { name: true } } } } },
    orderBy: { startTime: 'desc' },
  })

  const doc = new PDFDocument({ margin: 30, size: 'A4' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename=alarms.pdf')
  doc.pipe(res)

  doc.fontSize(16).text('Alarm Report', { align: 'center' })
  doc.moveDown()
  doc.fontSize(8)

  const tableTop = doc.y
  const colWidths = [40, 50, 55, 40, 35, 60, 60, 40]
  const headers = ['Customer', 'Node', 'IP', 'Type', 'Status', 'Start', 'End', 'Dur(s)']

  let y = tableTop
  headers.forEach((h, i) => {
    doc.text(h, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] })
  })
  y += 12

  alarms.forEach((a) => {
    if (y > 750) {
      doc.addPage()
      y = 30
    }
    const vals = [
      a.node.customer?.name || '-', a.node.name, a.node.ipAddress,
      a.node.deviceType, a.status, formatDate(a.startTime),
      formatDate(a.endTime), String(a.duration || 0),
    ]
    vals.forEach((v, i) => {
      doc.text(v, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] })
    })
    y += 10
  })

  doc.end()
})

export default router
