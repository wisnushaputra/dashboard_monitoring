import PDFDocument from 'pdfkit'

export interface RcaPdfData {
  ticketId: string
  title: string
  nodeName: string
  nodeIp: string
  deviceType: string
  customerName?: string
  incidentStartTime: Date
  incidentEndTime?: Date | null
  durationMinutes: number
  severity: string
  rootCauseCategory: string
  rootCauseDescription: string
  executiveSummary: string
  chronology: Array<{ timestamp: string; description: string }>
  actionItems: Array<{ action: string; owner: string; dueDate: string; status: string }>
  authorName: string
  createdAt: Date
}

export function generateRcaPdfStream(data: RcaPdfData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 40, size: 'A4' })

  // Colors
  const primaryColor = '#1e1b4b' // Dark indigo
  const secondaryColor = '#4f46e5' // Indigo
  const lightBg = '#f8fafc'
  const textDark = '#1e293b'
  const textMuted = '#64748b'

  // Header Banner
  doc.rect(40, 40, 515, 60).fill(primaryColor)

  doc.fillColor('#ffffff')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text('INCIDENT POST-MORTEM & ROOT CAUSE ANALYSIS (RCA)', 55, 52)

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#cbd5e1')
     .text(`PASSNET NETWORK OPERATIONS CENTER • TICKET REF: ${data.ticketId}`, 55, 75)

  // Incident Overview Box
  let y = 115
  doc.rect(40, y, 515, 80).fillAndStroke(lightBg, '#e2e8f0')

  doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold').text(data.title, 55, y + 10)

  doc.fontSize(9).font('Helvetica')
     .fillColor(textMuted)
     .text(`Impacted Node: `, 55, y + 32)
     .font('Helvetica-Bold').fillColor(textDark).text(`${data.nodeName} (${data.nodeIp}) - ${data.deviceType.toUpperCase()}`, 130, y + 32)

  if (data.customerName) {
    doc.font('Helvetica').fillColor(textMuted).text(`Corporate Account: `, 55, y + 46)
       .font('Helvetica-Bold').fillColor(secondaryColor).text(data.customerName, 145, y + 46)
  }

  doc.font('Helvetica').fillColor(textMuted).text(`Incident Duration: `, 55, y + 60)
     .font('Helvetica-Bold').fillColor('#dc2626')
     .text(`${data.incidentStartTime.toLocaleString('id-ID')} - ${data.incidentEndTime ? data.incidentEndTime.toLocaleString('id-ID') : 'ONGOING'} (${data.durationMinutes} Mins Downtime)`, 145, y + 60)

  // Severity Badge
  const sevBg = data.severity === 'critical' ? '#ef4444' : data.severity === 'major' ? '#f59e0b' : '#3b82f6'
  doc.rect(460, y + 12, 80, 20).fill(sevBg)
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(data.severity.toUpperCase(), 465, y + 17, { width: 70, align: 'center' })

  // Section 1: Executive Summary
  y += 95
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('1. EXECUTIVE SUMMARY', 40, y)
  doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

  y += 22
  doc.rect(40, y, 515, 60).fill('#f1f5f9')
  doc.fillColor(textDark).fontSize(9).font('Helvetica').text(data.executiveSummary || 'No executive summary provided.', 50, y + 10, { width: 495 })

  // Section 2: Root Cause Analysis
  y += 75
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('2. ROOT CAUSE ANALYSIS & CATEGORIZATION', 40, y)
  doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

  y += 22
  doc.fillColor(textMuted).fontSize(9).font('Helvetica').text('Root Cause Category: ', 40, y)
  doc.font('Helvetica-Bold').fillColor(secondaryColor).text(data.rootCauseCategory.toUpperCase().replace('_', ' '), 150, y)

  y += 16
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text(data.rootCauseDescription || 'Detailed root cause analysis pending investigation.', 40, y, { width: 515 })

  // Section 3: Chronology Timeline
  y += 70
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('3. INCIDENT CHRONOLOGY TIMELINE', 40, y)
  doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

  y += 22
  // Table Header
  doc.rect(40, y, 515, 20).fill(secondaryColor)
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
     .text('Timestamp (WIB)', 50, y + 5)
     .text('Event Description / Technical Action Taken', 180, y + 5)

  y += 20
  if (data.chronology && data.chronology.length > 0) {
    data.chronology.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      doc.rect(40, y, 515, 22).fillAndStroke(bg, '#f1f5f9')

      doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold').text(item.timestamp, 50, y + 6)
      doc.font('Helvetica').text(item.description, 180, y + 6, { width: 360 })
      y += 22
    })
  } else {
    doc.rect(40, y, 515, 22).fill('#ffffff')
    doc.fillColor(textMuted).fontSize(8).font('Helvetica').text('No chronology timeline entries recorded.', 50, y + 6)
    y += 22
  }

  // Section 4: Corrective Action Items & Preventive Plan
  y += 20
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('4. CORRECTIVE ACTIONS & PREVENTIVE PLAN', 40, y)
  doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#cbd5e1')

  y += 22
  // Table Header
  doc.rect(40, y, 515, 20).fill(primaryColor)
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
     .text('Corrective Action / Preventive Measure', 50, y + 5)
     .text('Owner', 330, y + 5)
     .text('Target Date', 420, y + 5)
     .text('Status', 495, y + 5)

  y += 20
  if (data.actionItems && data.actionItems.length > 0) {
    data.actionItems.forEach((act, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      doc.rect(40, y, 515, 22).fillAndStroke(bg, '#f1f5f9')

      doc.fillColor(textDark).fontSize(8).font('Helvetica').text(act.action, 50, y + 6, { width: 270 })
      doc.text(act.owner || 'NOC Team', 330, y + 6)
      doc.text(act.dueDate || '-', 420, y + 6)

      const statusColor = act.status === 'Completed' ? '#16a34a' : act.status === 'In Progress' ? '#d97706' : '#dc2626'
      doc.font('Helvetica-Bold').fillColor(statusColor).text(act.status || 'Open', 495, y + 6)
      y += 22
    })
  } else {
    doc.rect(40, y, 515, 22).fill('#ffffff')
    doc.fillColor(textMuted).fontSize(8).font('Helvetica').text('No action items assigned.', 50, y + 6)
    y += 22
  }

  // Footer & Signatures
  y = 750
  doc.moveTo(40, y).lineTo(555, y).stroke('#cbd5e1')
  doc.fontSize(8).font('Helvetica').fillColor(textMuted)
     .text(`Author: ${data.authorName} • Passnet NOC Operations`, 40, y + 8)
     .text(`Generated: ${data.createdAt.toLocaleString('id-ID')} • CONFIDENTIAL`, 40, y + 8, { align: 'right' })

  return doc
}
