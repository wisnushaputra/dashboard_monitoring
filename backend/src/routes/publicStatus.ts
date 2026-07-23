import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/public/status/:customerCode - Public unauthenticated status endpoint
router.get('/status/:customerCode', async (req: Request, res: Response) => {
  try {
    const { customerCode } = req.params
    if (!customerCode) {
      return res.status(400).json({ error: 'Customer code is required' })
    }

    // Find customer by code (case-insensitive)
    const customer = await prisma.customer.findFirst({
      where: { code: { equals: customerCode, mode: 'insensitive' } },
      select: { id: true, name: true, code: true, createdAt: true },
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Get nodes belonging to this customer
    const nodes = await prisma.node.findMany({
      where: { customerId: customer.id, enabled: true },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        deviceType: true,
        location: true,
        status: true,
        latencyMs: true,
        jitterMs: true,
        packetLoss: true,
        lastChecked: true,
        isMaintenance: true,
      },
      orderBy: { name: 'asc' },
    })

    const nodeIds = nodes.map(n => n.id)

    // Get active/upcoming maintenance windows for these nodes
    const now = new Date()
    const maintenanceWindows = await prisma.maintenanceWindow.findMany({
      where: {
        nodeId: { in: nodeIds },
        endTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
    })

    // Get recent alarms (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentAlarms = await prisma.alarm.findMany({
      where: {
        nodeId: { in: nodeIds },
        startTime: { gte: sevenDaysAgo },
      },
      include: {
        node: { select: { name: true, deviceType: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 10,
    })

    // Calculate 30-Day SLA percentage & daily status bars
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const totalSecs = (now.getTime() - thirtyDaysAgo.getTime()) / 1000
    
    // Sum alarm downtime duration over last 30 days
    const monthAlarms = await prisma.alarm.findMany({
      where: {
        nodeId: { in: nodeIds },
        startTime: { gte: thirtyDaysAgo },
      },
    })

    let totalDowntimeSecs = 0
    for (const a of monthAlarms) {
      const end = a.endTime || now
      const start = a.startTime < thirtyDaysAgo ? thirtyDaysAgo : a.startTime
      totalDowntimeSecs += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
    }

    const totalNodeSecs = totalSecs * Math.max(1, nodes.length)
    const slaPercent = Math.max(0, Math.min(100, ((totalNodeSecs - totalDowntimeSecs) / totalNodeSecs) * 100))

    // Build 30 daily status blocks
    const dailyHistory: Array<{ date: string; status: 'operational' | 'degraded' | 'outage'; sla: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().substring(0, 10)

      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)

      let dayDowntime = 0
      for (const a of monthAlarms) {
        if (a.startTime <= dayEnd && (a.endTime || now) >= dayStart) {
          const s = a.startTime < dayStart ? dayStart : a.startTime
          const e = (a.endTime || now) > dayEnd ? dayEnd : (a.endTime || now)
          dayDowntime += Math.max(0, (e.getTime() - s.getTime()) / 1000)
        }
      }

      const dayTotalNodeSecs = 86400 * Math.max(1, nodes.length)
      const daySla = Math.max(0, Math.min(100, ((dayTotalNodeSecs - dayDowntime) / dayTotalNodeSecs) * 100))
      const dayStatus = daySla >= 99.5 ? 'operational' : daySla >= 95 ? 'degraded' : 'outage'

      dailyHistory.push({ date: dateStr, status: dayStatus, sla: parseFloat(daySla.toFixed(2)) })
    }

    // Determine overall customer health status
    let overallStatus: 'operational' | 'degraded' | 'outage' | 'maintenance' = 'operational'
    const hasDown = nodes.some(n => n.status === 'down')
    const hasWarning = nodes.some(n => n.status === 'warning' || n.status === 'flapping')
    const hasMaint = nodes.some(n => n.status === 'maintenance' || n.isMaintenance)

    if (hasDown) overallStatus = 'outage'
    else if (hasWarning) overallStatus = 'degraded'
    else if (hasMaint && nodes.every(n => n.status === 'maintenance' || n.status === 'up')) overallStatus = 'maintenance'

    res.json({
      customer: {
        name: customer.name,
        code: customer.code,
      },
      overallStatus,
      sla30Days: parseFloat(slaPercent.toFixed(2)),
      dailyHistory,
      nodes,
      maintenanceWindows,
      recentIncidents: recentAlarms.map(a => ({
        id: a.id,
        nodeName: a.node.name,
        deviceType: a.node.deviceType,
        status: a.status,
        startTime: a.startTime,
        endTime: a.endTime,
        duration: a.duration,
        cause: a.cause,
        recoveryNote: a.recoveryNote,
      })),
      updatedAt: new Date(),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
