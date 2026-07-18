import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

const router = Router()

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID')
}

function formatDowntime(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h > 0 ? `${h}h ` : ''}${m}m`
}

async function computeSlaStats(customerId: number, startDateStr: string, endDateStr: string) {
  const start = new Date(startDateStr)
  start.setUTCHours(0, 0, 0, 0)
  
  const end = new Date(endDateStr)
  end.setUTCHours(23, 59, 59, 999)
  
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { nodes: true },
  })

  if (!customer) return null

  const periodStart = start.getTime()
  const periodEnd = end.getTime()
  const totalPeriodSeconds = Math.max(1, (periodEnd - periodStart) / 1000)

  const nodesStats = await Promise.all(
    customer.nodes.map(async (node) => {
      // Query overlapping alarms
      const alarms = await prisma.alarm.findMany({
        where: {
          nodeId: node.id,
          OR: [
            { startTime: { lte: end }, endTime: { gte: start } },
            { startTime: { lte: end }, endTime: null },
          ],
        },
        orderBy: { startTime: 'desc' },
      })

      let downtimeSeconds = 0
      alarms.forEach((alarm) => {
        const alarmStart = Math.max(alarm.startTime.getTime(), periodStart)
        const alarmEnd = Math.min((alarm.endTime || new Date()).getTime(), periodEnd)
        const overlap = (alarmEnd - alarmStart) / 1000
        if (overlap > 0) {
          downtimeSeconds += overlap
        }
      })

      const availability = Math.max(0, Math.min(100, ((totalPeriodSeconds - downtimeSeconds) / totalPeriodSeconds) * 100))

      // Aggregate event logs for average latency & packet loss
      const logs = await prisma.eventLog.aggregate({
        where: {
          nodeId: node.id,
          timestamp: { gte: start, lte: end },
        },
        _avg: {
          latencyMs: true,
          packetLoss: true,
        },
      })

      return {
        id: node.id,
        name: node.name,
        ipAddress: node.ipAddress,
        deviceType: node.deviceType,
        location: node.location,
        description: node.description,
        downtimeSeconds,
        availability,
        avgLatencyMs: logs._avg.latencyMs || 0,
        avgPacketLoss: logs._avg.packetLoss || 0,
        alarms: alarms.map(a => {
          const duration = a.duration || (a.endTime
            ? Math.floor((a.endTime.getTime() - a.startTime.getTime()) / 1000)
            : Math.floor((new Date().getTime() - a.startTime.getTime()) / 1000))
          return {
            id: a.id,
            startTime: a.startTime,
            endTime: a.endTime,
            duration,
            recoveryNote: a.recoveryNote,
            cause: a.cause,
          }
        })
      }
    })
  )

  const totalNodes = nodesStats.length
  const avgAvailability = totalNodes > 0
    ? nodesStats.reduce((sum, n) => sum + n.availability, 0) / totalNodes
    : 100

  return {
    customer,
    period: { start, end, totalPeriodSeconds },
    nodesStats,
    summary: {
      totalNodes,
      avgAvailability,
    }
  }
}

// Preview SLA Report data
router.get('/sla/preview', authMiddleware, async (req: Request, res: Response) => {
  const customerId = parseInt(req.query.customerId as string)
  const { startDate, endDate } = req.query

  if (isNaN(customerId) || !startDate || !endDate) {
    res.status(400).json({ error: 'customerId, startDate, and endDate are required' })
    return
  }

  try {
    const stats = await computeSlaStats(customerId, startDate as string, endDate as string)
    if (!stats) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }
    res.json({
      customerName: stats.customer.name,
      customerCode: stats.customer.code,
      summary: stats.summary,
      nodes: stats.nodesStats,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get MTTR Analytics Report
router.get('/mttr', authMiddleware, async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' })
    return
  }

  try {
    const start = new Date(startDate as string)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(endDate as string)
    end.setUTCHours(23, 59, 59, 999)

    // 1. Fetch resolved alarms within range
    const resolvedAlarms = await prisma.alarm.findMany({
      where: {
        status: 'resolved',
        endTime: { gte: start, lte: end }
      },
      include: {
        node: {
          select: {
            name: true,
            ipAddress: true,
            deviceType: true
          }
        }
      },
      orderBy: { endTime: 'desc' }
    })

    // 2. Compute MTTR (mean duration in seconds)
    const totalResolved = resolvedAlarms.length
    let totalDurationSeconds = 0
    let mttrSeconds = 0

    resolvedAlarms.forEach(alarm => {
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)
      totalDurationSeconds += duration
    })

    if (totalResolved > 0) {
      mttrSeconds = Math.round(totalDurationSeconds / totalResolved)
    }

    // 3. Compute MTTR grouped by device type
    const durationByDeviceType: Record<string, { totalDuration: number; count: number }> = {}
    resolvedAlarms.forEach(alarm => {
      const deviceType = alarm.node?.deviceType || 'unknown'
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)

      if (!durationByDeviceType[deviceType]) {
        durationByDeviceType[deviceType] = { totalDuration: 0, count: 0 }
      }
      durationByDeviceType[deviceType].totalDuration += duration
      durationByDeviceType[deviceType].count += 1
    })

    const mttrByDeviceType = Object.entries(durationByDeviceType).map(([type, stats]) => ({
      deviceType: type,
      mttrSeconds: Math.round(stats.totalDuration / stats.count),
      count: stats.count
    }))

    // 4. Incident resolution trend: group by day of endTime
    const dailyStats: Record<string, { totalDuration: number; count: number }> = {}
    // Pre-populate all days in range to avoid gaps
    const temp = new Date(start)
    while (temp <= end) {
      const dayKey = temp.toISOString().split('T')[0]
      dailyStats[dayKey] = { totalDuration: 0, count: 0 }
      temp.setDate(temp.getDate() + 1)
    }

    resolvedAlarms.forEach(alarm => {
      if (alarm.endTime) {
        const dayKey = new Date(alarm.endTime).toISOString().split('T')[0]
        const duration = alarm.duration || Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        if (dailyStats[dayKey]) {
          dailyStats[dayKey].totalDuration += duration
          dailyStats[dayKey].count += 1
        }
      }
    })

    const resolutionTrend = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      count: stats.count,
      mttrMinutes: stats.count > 0 ? Math.round((stats.totalDuration / stats.count) / 60) : 0
    })).sort((a, b) => a.date.localeCompare(b.date))

    // 5. Top 5 longest outages resolved
    const topOutages = [...resolvedAlarms]
      .map(alarm => {
        const duration = alarm.duration || (alarm.endTime 
          ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
          : 0)
        return {
          id: alarm.id,
          nodeName: alarm.node?.name || 'N/A',
          ipAddress: alarm.node?.ipAddress || 'N/A',
          startTime: alarm.startTime,
          endTime: alarm.endTime,
          duration,
          recoveryNote: alarm.recoveryNote,
          cause: alarm.cause
        }
      })
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)

    res.json({
      summary: {
        totalResolved,
        mttrSeconds,
        mttrFormatted: formatDowntime(mttrSeconds),
      },
      mttrByDeviceType,
      resolutionTrend,
      topOutages
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stream SLA PDF Report (Cleaner, with separate page breakdown per node!)
router.get('/sla/pdf', authMiddleware, async (req: Request, res: Response) => {
  const customerId = parseInt(req.query.customerId as string)
  const { startDate, endDate } = req.query

  if (isNaN(customerId) || !startDate || !endDate) {
    res.status(400).json({ error: 'customerId, startDate, and endDate are required' })
    return
  }

  try {
    const stats = await computeSlaStats(customerId, startDate as string, endDate as string)
    if (!stats) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=sla_report_${stats.customer.code}.pdf`)
    doc.pipe(res)

    // NOC Colors Palette
    const primaryColor = '#0f172a' // slate-900
    const accentColor = '#059669' // emerald-600
    const lightBg = '#f8fafc' // slate-50
    const borderCol = '#cbd5e1' // slate-300
    const textDark = '#1e293b' // slate-800
    const textMuted = '#64748b' // slate-500

    // --- PAGE 1: EXECUTIVE SUMMARY ---
    doc.rect(0, 0, 595.28, 12).fill(accentColor)

    // Title Block
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('NOC SERVICE LEVEL AGREEMENT (SLA) REPORT', 40, 45)
    doc.fillColor(textMuted).fontSize(8.5).font('Helvetica').text('CONFIDENTIAL CUSTOMER AVAILABILITY REPORT', 40, 68)
    
    doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, 85).lineTo(555.28, 85).stroke()

    // Customer & Reporting details
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('Customer Profile:', 40, 105)
    doc.font('Helvetica').text(`Name: ${stats.customer.name}`, 40, 120)
    doc.text(`Code: ${stats.customer.code}`, 40, 135)

    doc.font('Helvetica-Bold').text('Reporting Period:', 300, 105)
    doc.font('Helvetica').text(`Start: ${new Date(startDate as string).toLocaleString('id-ID')}`, 300, 120)
    doc.text(`End: ${new Date(endDate as string).toLocaleString('id-ID')}`, 300, 135)

    // Summary Card
    const boxY = 170
    doc.rect(40, boxY, 515.28, 65).fill(lightBg)
    doc.strokeColor(borderCol).lineWidth(0.5).rect(40, boxY, 515.28, 65).stroke()

    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('EXECUTIVE PERFORMANCE SUMMARY', 55, boxY + 12)
    doc.font('Helvetica').fontSize(9.5).text(`Monitored Nodes: ${stats.summary.totalNodes} devices`, 55, boxY + 32)
    
    const overallSlaColor = stats.summary.avgAvailability >= 99 ? '#059669' : stats.summary.avgAvailability >= 95 ? '#d97706' : '#dc2626'
    doc.fillColor(primaryColor).text('Average Availability KPI: ', 300, boxY + 22)
    doc.fillColor(overallSlaColor).font('Helvetica-Bold').fontSize(16).text(`${stats.summary.avgAvailability.toFixed(3)}%`, 415, boxY + 18)

    // Overview Table Header
    const tableTop = 260
    doc.fillColor(primaryColor).rect(40, tableTop, 515.28, 20).fill()
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
    doc.text('Device Name', 50, tableTop + 6, { width: 150 })
    doc.text('IP Address', 210, tableTop + 6, { width: 100 })
    doc.text('Device Type', 320, tableTop + 6, { width: 100 })
    doc.text('Availability SLA', 440, tableTop + 6, { width: 105, align: 'right' })

    let currentY = tableTop + 20
    doc.fontSize(8.5).font('Helvetica')

    stats.nodesStats.forEach((node, idx) => {
      if (idx % 2 === 0) {
        doc.fillColor('#f8fafc').rect(40, currentY, 515.28, 18).fill()
      }
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, currentY + 18).lineTo(555.28, currentY + 18).stroke()

      const nodeSlaColor = node.availability >= 99 ? '#059669' : node.availability >= 95 ? '#d97706' : '#dc2626'

      doc.fillColor(primaryColor)
      doc.text(node.name, 50, currentY + 5, { width: 150, lineBreak: false })
      doc.text(node.ipAddress, 210, currentY + 5, { width: 100, lineBreak: false })
      doc.text(node.deviceType.toUpperCase(), 320, currentY + 5, { width: 100, lineBreak: false })
      
      doc.fillColor(nodeSlaColor).font('Helvetica-Bold')
      doc.text(`${node.availability.toFixed(3)}%`, 440, currentY + 5, { width: 105, align: 'right', lineBreak: false })
      doc.font('Helvetica')

      currentY += 18
    })

    // Footer signature overview page
    currentY = Math.max(currentY + 40, 680)
    doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, currentY).lineTo(555.28, currentY).stroke()
    doc.fillColor(textMuted).fontSize(7.5).font('Helvetica-Oblique').text('SLA Executive Overview. Individual breakdowns follow on subsequent pages.', 40, currentY + 10)

    // --- DETAILED PAGES: ONE PAGE PER NODE ---
    stats.nodesStats.forEach((node) => {
      doc.addPage()

      // Header top bar
      doc.rect(0, 0, 595.28, 12).fill(accentColor)

      // Node details header
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text(`SLA BREAKDOWN: ${node.name.toUpperCase()}`, 40, 35)
      doc.fillColor(textMuted).fontSize(8.5).font('Helvetica').text(`METRICS & EVENT LOG DETAILS FOR DEVICE`, 40, 52)
      doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, 65).lineTo(555.28, 65).stroke()

      // Specifications Grid
      doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text('Device Details:', 40, 80)
      doc.font('Helvetica').fontSize(9)
      doc.text(`IP Address: ${node.ipAddress}`, 40, 95)
      doc.text(`Device Type: ${node.deviceType.toUpperCase()}`, 40, 110)
      doc.text(`Location: ${node.location || 'N/A'}`, 40, 125)
      if (node.description) {
        doc.text(`Description: ${node.description}`, 40, 140, { width: 230 })
      }

      // Performance stats box
      const nBoxY = 80
      const nBoxX = 300
      doc.rect(nBoxX, nBoxY, 255.28, 70).fill(lightBg)
      doc.strokeColor(borderCol).lineWidth(0.5).rect(nBoxX, nBoxY, 255.28, 70).stroke()

      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('PERFORMANCE TARGETS', nBoxX + 10, nBoxY + 8)
      doc.font('Helvetica').fontSize(8.5)
      doc.text(`Avg Latency: ${node.avgLatencyMs.toFixed(1)} ms`, nBoxX + 10, nBoxY + 24)
      doc.text(`Packet Loss: ${node.avgPacketLoss.toFixed(2)}%`, nBoxX + 10, nBoxY + 38)
      doc.text(`Total Downtime: ${formatDowntime(node.downtimeSeconds)}`, nBoxX + 10, nBoxY + 52)

      const nodeSlaColor = node.availability >= 99 ? '#059669' : node.availability >= 95 ? '#d97706' : '#dc2626'
      doc.fillColor(nodeSlaColor).fontSize(14).font('Helvetica-Bold').text(`${node.availability.toFixed(3)}%`, nBoxX + 160, nBoxY + 28, { width: 85, align: 'right' })
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica').text('Node SLA Uptime', nBoxX + 160, nBoxY + 46, { width: 85, align: 'right' })

      // Outages list
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`Outage & Recovery Logs (${node.alarms.length})`, 40, 175)

      const subTableTop = 195
      const colWidths = [120, 120, 80, 195.28]
      const colPositions = [40, 160, 280, 360]
      const headers = ['Start Time', 'End Time', 'Duration', 'Recovery Cause/Note']

      // Draw table header
      doc.fillColor(primaryColor).rect(40, subTableTop, 515.28, 16).fill()
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
      headers.forEach((h, i) => {
        doc.text(h, colPositions[i] + 5, subTableTop + 4, { width: colWidths[i] - 10 })
      })

      let y = subTableTop + 16
      doc.fillColor(textDark).fontSize(7.5).font('Helvetica')

      node.alarms.forEach((alarm, idx) => {
        if (idx % 2 === 0) {
          doc.fillColor('#f8fafc').rect(40, y, 515.28, 16).fill()
        }
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, y + 16).lineTo(555.28, y + 16).stroke()

        const startStr = formatDate(alarm.startTime)
        const endStr = formatDate(alarm.endTime)
        const durationStr = alarm.duration ? `${Math.floor(alarm.duration / 60)}m ${alarm.duration % 60}s` : 'Active'
        const noteStr = alarm.recoveryNote || alarm.cause || '-'

        doc.fillColor(primaryColor)
        doc.text(startStr, colPositions[0] + 5, y + 4, { width: colWidths[0] - 10 })
        doc.text(endStr, colPositions[1] + 5, y + 4, { width: colWidths[1] - 10 })
        doc.text(durationStr, colPositions[2] + 5, y + 4, { width: colWidths[2] - 10 })
        doc.text(noteStr, colPositions[3] + 5, y + 4, { width: colWidths[3] - 10 })

        y += 16

        // Page break inside node alarms list if long
        if (y > 700) {
          doc.addPage()
          // Top bar
          doc.rect(0, 0, 595.28, 12).fill(accentColor)
          y = 40
          doc.fillColor(primaryColor).rect(40, y, 515.28, 16).fill()
          doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
          headers.forEach((h, i) => {
            doc.text(h, colPositions[i] + 5, y + 4, { width: colWidths[i] - 10 })
          })
          y += 16
          doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
        }
      })

      if (node.alarms.length === 0) {
        doc.fillColor('#ecfdf5').rect(40, y, 515.28, 30).fill()
        doc.strokeColor('#a7f3d0').lineWidth(0.5).rect(40, y, 515.28, 30).stroke()
        doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold').text('SLA COMPLIANT: No downtime recorded for this node during this period.', 55, y + 10)
        y += 30
      }

      // Page signature footer
      y = Math.max(y + 40, 680)
      doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, y).lineTo(555.28, y).stroke()
      y += 10
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica').text(`Device SLA Report — ${node.name} (${node.ipAddress})`, 40, y)
      doc.text('Prepared by NOC Operations', 430, y, { align: 'right', width: 125 })
    })

    doc.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stream SLA Excel Report (Separate worksheets/tables per node!)
router.get('/sla/xlsx', authMiddleware, async (req: Request, res: Response) => {
  const customerId = parseInt(req.query.customerId as string)
  const { startDate, endDate } = req.query

  if (isNaN(customerId) || !startDate || !endDate) {
    res.status(400).json({ error: 'customerId, startDate, and endDate are required' })
    return
  }

  try {
    const stats = await computeSlaStats(customerId, startDate as string, endDate as string)
    if (!stats) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }

    const wb = new ExcelJS.Workbook()
    
    // WORKSHEET 1: Executive Overview
    const wsOverview = wb.addWorksheet('SLA Overview')
    
    // Style title
    wsOverview.mergeCells('A1:D1')
    const titleCell = wsOverview.getCell('A1')
    titleCell.value = 'NOC SERVICE LEVEL AGREEMENT (SLA) OVERVIEW'
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    wsOverview.getRow(1).height = 30

    wsOverview.addRow([])
    wsOverview.addRow(['Customer Name:', stats.customer.name])
    wsOverview.addRow(['Customer Code:', stats.customer.code])
    wsOverview.addRow(['Start Date:', formatDate(startDate as string)])
    wsOverview.addRow(['End Date:', formatDate(endDate as string)])
    wsOverview.addRow(['Average SLA Availability:', `${stats.summary.avgAvailability.toFixed(3)}%`])
    wsOverview.addRow([])

    wsOverview.addRow(['Node Name', 'IP Address', 'Device Type', 'Availability SLA'])
    const headerRow = wsOverview.getRow(9)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } }

    stats.nodesStats.forEach((node) => {
      wsOverview.addRow([
        node.name,
        node.ipAddress,
        node.deviceType,
        `${node.availability.toFixed(3)}%`
      ])
    })

    // Auto-fit columns
    wsOverview.columns.forEach(column => {
      let maxLen = 0
      column.eachCell!({ includeEmpty: true }, cell => {
        const valStr = cell.value ? cell.value.toString() : ''
        if (valStr.length > maxLen) maxLen = valStr.length
      })
      column.width = Math.max(maxLen + 2, 15)
    })

    // WORKSHEETS 2+: One Worksheet Per Node for Detailed SLA Outage log!
    stats.nodesStats.forEach((node) => {
      // Clean sheet name (Excel sheets cannot exceed 31 chars)
      const sheetName = `${node.name.slice(0, 20)} SLA`
      const wsNode = wb.addWorksheet(sheetName)

      // Title Card
      wsNode.mergeCells('A1:E1')
      const nodeTitle = wsNode.getCell('A1')
      nodeTitle.value = `SLA DETAILS: ${node.name.toUpperCase()}`
      nodeTitle.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      nodeTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } } // Emerald
      nodeTitle.alignment = { vertical: 'middle', horizontal: 'left' }
      wsNode.getRow(1).height = 25

      wsNode.addRow([])
      wsNode.addRow(['IP Address:', node.ipAddress])
      wsNode.addRow(['Device Type:', node.deviceType.toUpperCase()])
      wsNode.addRow(['Location:', node.location || '-'])
      wsNode.addRow(['Total Downtime:', formatDowntime(node.downtimeSeconds)])
      wsNode.addRow(['Availability SLA:', `${node.availability.toFixed(3)}%`])
      wsNode.addRow(['Average Latency:', `${node.avgLatencyMs.toFixed(1)} ms`])
      wsNode.addRow(['Average Packet Loss:', `${node.avgPacketLoss.toFixed(2)}%`])
      wsNode.addRow([])

      // Outages Subtable
      wsNode.addRow(['DOWNTIME LOGS & OUTAGES'])
      wsNode.getRow(11).font = { bold: true, size: 10 }
      
      wsNode.addRow(['Alarm ID', 'Start Time', 'End Time', 'Duration (s)', 'Recovery Cause/Note'])
      const tblHeader = wsNode.getRow(12)
      tblHeader.font = { bold: true }
      tblHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } }

      node.alarms.forEach((alarm) => {
        wsNode.addRow([
          alarm.id,
          formatDate(alarm.startTime),
          formatDate(alarm.endTime),
          alarm.duration || 'Active',
          alarm.recoveryNote || alarm.cause || '-'
        ])
      })

      if (node.alarms.length === 0) {
        wsNode.addRow(['No downtime events recorded. Node was compliant at 100.00% uptime.'])
      }

      wsNode.columns.forEach(column => {
        let maxLen = 0
        column.eachCell!({ includeEmpty: true }, cell => {
          const valStr = cell.value ? cell.value.toString() : ''
          if (valStr.length > maxLen) maxLen = valStr.length
        })
        column.width = Math.max(maxLen + 2, 15)
      })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=sla_report_${stats.customer.code}.xlsx`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stream MTTR PDF Report
router.get('/mttr/pdf', authMiddleware, async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' })
    return
  }

  try {
    const start = new Date(startDate as string)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(endDate as string)
    end.setUTCHours(23, 59, 59, 999)

    // 1. Fetch resolved alarms within range
    const resolvedAlarms = await prisma.alarm.findMany({
      where: {
        status: 'resolved',
        endTime: { gte: start, lte: end }
      },
      include: {
        node: {
          select: {
            name: true,
            ipAddress: true,
            deviceType: true
          }
        }
      },
      orderBy: { endTime: 'desc' }
    })

    const totalResolved = resolvedAlarms.length
    let totalDurationSeconds = 0
    let mttrSeconds = 0

    resolvedAlarms.forEach(alarm => {
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)
      totalDurationSeconds += duration
    })

    if (totalResolved > 0) {
      mttrSeconds = Math.round(totalDurationSeconds / totalResolved)
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=mttr_report_${startDate}_to_${endDate}.pdf`)
    doc.pipe(res)

    const primaryColor = '#0f172a' // slate-900
    const accentColor = '#6366f1' // indigo-500
    const borderCol = '#cbd5e1'
    const textMuted = '#64748b'

    doc.rect(0, 0, 595.28, 12).fill(accentColor)

    // Title
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('NOC INCIDENT RESPONSE (MTTR) REPORT', 40, 45)
    doc.fillColor(textMuted).fontSize(8.5).font('Helvetica').text('INCIDENT RESPONSE SPEED & OUTAGE ANALYTICS', 40, 68)
    
    doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, 85).lineTo(555.28, 85).stroke()

    // Period Details
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('Analysis Period:', 40, 105)
    doc.font('Helvetica').text(`Start Date: ${new Date(startDate as string).toLocaleDateString('id-ID')}`, 40, 120)
    doc.text(`End Date: ${new Date(endDate as string).toLocaleDateString('id-ID')}`, 40, 135)

    doc.font('Helvetica-Bold').text('Metrics Summary:', 300, 105)
    doc.font('Helvetica').text(`Total Incidents Resolved: ${totalResolved}`, 300, 120)
    doc.text(`Mean Time to Resolve (MTTR): ${formatDowntime(mttrSeconds)}`, 300, 135)

    // Divider
    doc.strokeColor(borderCol).lineWidth(0.5).moveTo(40, 160).lineTo(555.28, 160).stroke()

    // Table Header
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('Top 10 Longest Resolved Outages', 40, 180)
    
    let tableY = 205
    doc.rect(40, tableY, 515.28, 20).fill('#f1f5f9')
    doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
    doc.text('NODE / IP', 45, tableY + 6)
    doc.text('OUTAGE CAUSE', 180, tableY + 6)
    doc.text('OUTAGE PERIOD', 350, tableY + 6)
    doc.text('DURATION', 500, tableY + 6)

    tableY += 20
    const topAlarms = [...resolvedAlarms]
      .sort((a, b) => {
        const da = a.duration || 0
        const db = b.duration || 0
        return db - da
      })
      .slice(0, 10)

    doc.font('Helvetica').fontSize(7.5)
    topAlarms.forEach((alarm) => {
      if (tableY > 750) {
        doc.addPage()
        doc.rect(0, 0, 595.28, 12).fill(accentColor)
        tableY = 40
      }
      
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)
      
      doc.fillColor(primaryColor)
      doc.text(alarm.node?.name || 'N/A', 45, tableY + 6)
      doc.fillColor(textMuted)
      doc.text(alarm.node?.ipAddress || 'N/A', 45, tableY + 15)

      doc.fillColor(primaryColor)
      doc.text(alarm.cause || 'Unknown Outage', 180, tableY + 6, { width: 160 })
      if (alarm.recoveryNote) {
        doc.fillColor('#10b981')
        doc.text(`Note: ${alarm.recoveryNote}`, 180, tableY + 18, { width: 160 })
      }

      doc.fillColor(primaryColor)
      doc.text(`Start: ${formatDate(alarm.startTime)}`, 350, tableY + 6)
      doc.text(`End: ${formatDate(alarm.endTime)}`, 350, tableY + 15)

      doc.font('Helvetica-Bold').text(formatDowntime(duration), 500, tableY + 6)
      doc.font('Helvetica')

      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, tableY + 28).lineTo(555.28, tableY + 28).stroke()
      tableY += 30
    })

    if (topAlarms.length === 0) {
      doc.text('No outages recorded in this period.', 45, tableY + 10)
    }

    doc.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stream MTTR Excel Report
router.get('/mttr/xlsx', authMiddleware, async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' })
    return
  }

  try {
    const start = new Date(startDate as string)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(endDate as string)
    end.setUTCHours(23, 59, 59, 999)

    // 1. Fetch resolved alarms within range
    const resolvedAlarms = await prisma.alarm.findMany({
      where: {
        status: 'resolved',
        endTime: { gte: start, lte: end }
      },
      include: {
        node: {
          select: {
            name: true,
            ipAddress: true,
            deviceType: true
          }
        }
      },
      orderBy: { endTime: 'desc' }
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('MTTR Summary')

    ws.mergeCells('A1:E1')
    ws.getCell('A1').value = 'NOC MONITORING - INCIDENT RESOLUTION (MTTR) REPORT'
    ws.getCell('A1').font = { bold: true, size: 14 }
    
    ws.addRow(['Start Date', startDate])
    ws.addRow(['End Date', endDate])
    ws.addRow(['Export Date', new Date().toLocaleDateString('id-ID')])
    ws.addRow([])

    ws.addRow(['Summary Metrics'])
    const metricsHeader = ws.getRow(6)
    metricsHeader.font = { bold: true }

    ws.addRow(['Total Incidents Resolved', resolvedAlarms.length])
    
    let totalDurationSeconds = 0
    let mttrSeconds = 0
    resolvedAlarms.forEach(alarm => {
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)
      totalDurationSeconds += duration
    })
    if (resolvedAlarms.length > 0) {
      mttrSeconds = Math.round(totalDurationSeconds / resolvedAlarms.length)
    }

    ws.addRow(['Mean Time to Resolve (MTTR)', formatDowntime(mttrSeconds)])
    ws.addRow([])

    ws.addRow(['Resolved Outage Details'])
    const tblHeader = ws.getRow(11)
    tblHeader.font = { bold: true }
    tblHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } }

    ws.addRow(['Alarm ID', 'Node Name', 'IP Address', 'Device Type', 'Start Time', 'End Time', 'Duration (s)', 'Outage Cause', 'Recovery Note'])
    
    resolvedAlarms.forEach(alarm => {
      const duration = alarm.duration || (alarm.endTime 
        ? Math.floor((alarm.endTime.getTime() - alarm.startTime.getTime()) / 1000)
        : 0)
      ws.addRow([
        alarm.id,
        alarm.node?.name || 'N/A',
        alarm.node?.ipAddress || 'N/A',
        alarm.node?.deviceType || 'N/A',
        formatDate(alarm.startTime),
        formatDate(alarm.endTime),
        duration,
        alarm.cause || 'Primary Outage',
        alarm.recoveryNote || '-'
      ])
    })

    ws.columns.forEach(column => {
      let maxLen = 0
      column.eachCell!({ includeEmpty: true }, cell => {
        const valStr = cell.value ? cell.value.toString() : ''
        if (valStr.length > maxLen) maxLen = valStr.length
      })
      column.width = Math.max(maxLen + 2, 15)
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=mttr_report_${startDate}_to_${endDate}.xlsx`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
