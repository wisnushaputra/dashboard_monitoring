import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, roleMiddleware } from '../middleware/auth'
import { spawn } from 'child_process'
import eventEmitter from '../lib/eventEmitter'
import { logAudit } from '../lib/audit'

const router = Router()

router.use(authMiddleware)

router.get('/topology/export', roleMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    const [nodes, connections] = await Promise.all([
      prisma.node.findMany(),
      prisma.connection.findMany(),
    ])
    res.json({ nodes, connections })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export topology' })
  }
})

router.post('/topology/import', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { nodes, connections } = req.body
  if (!Array.isArray(nodes) || !Array.isArray(connections)) {
    res.status(400).json({ error: 'Invalid topology format' })
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all connections and nodes
      await tx.connection.deleteMany()
      await tx.node.deleteMany()

      // 2. Insert nodes one by one to map old IDs to new IDs
      const oldToNewIdMap: Record<number, number> = {}
      for (const n of nodes) {
        const created = await tx.node.create({
          data: {
            name: n.name,
            ipAddress: n.ipAddress,
            deviceType: n.deviceType,
            location: n.location,
            description: n.description,
            monitoringInterval: n.monitoringInterval,
            monitorType: n.monitorType,
            monitorConfig: n.monitorConfig,
            status: n.status || 'unknown',
            enabled: n.enabled !== undefined ? n.enabled : true,
            x: n.x,
            y: n.y,
            customerId: n.customerId || 1,
            siteId: n.siteId,
          }
        })
        oldToNewIdMap[n.id] = created.id
      }

      // 3. Update parentId for all nodes
      for (const n of nodes) {
        if (n.parentId) {
          const newParentId = oldToNewIdMap[n.parentId]
          const newNodeId = oldToNewIdMap[n.id]
          if (newParentId && newNodeId) {
            await tx.node.update({
              where: { id: newNodeId },
              data: { parentId: newParentId }
            })
          }
        }
      }

      // 4. Insert connections mapping old IDs to new IDs
      for (const c of connections) {
        const newFrom = oldToNewIdMap[c.fromNodeId]
        const newTo = oldToNewIdMap[c.toNodeId]
        if (newFrom && newTo) {
          await tx.connection.create({
            data: {
              fromNodeId: newFrom,
              toNodeId: newTo,
              sourceHandle: c.sourceHandle,
              targetHandle: c.targetHandle,
            }
          })
        }
      }
    })

    logAudit({
      userId: (req as any).user.id,
      username: (req as any).user.username,
      action: 'TOPOLOGY_IMPORT',
      target: 'Topology',
      details: `Imported topology containing ${nodes.length} nodes and ${connections.length} connections`,
      ipAddress: req.ip,
    })

    res.json({ success: true })
  } catch (err: any) {
    console.error('Failed to import topology:', err)
    res.status(500).json({ error: err.message || 'Failed to import topology' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  const { customerId, siteId, status, deviceType, search, parentId } = req.query

  const where: any = {}
  if (customerId) where.customerId = parseInt(customerId as string)
  if (siteId) where.siteId = parseInt(siteId as string)
  if (status) where.status = status
  if (deviceType) where.deviceType = deviceType
  if (parentId !== undefined) {
    where.parentId = parentId === 'null' || parentId === '' ? null : parseInt(parentId as string)
  }
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { ipAddress: { contains: search as string, mode: 'insensitive' } },
    ]
  }

  const nodes = await prisma.node.findMany({
    where,
    include: { customer: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(nodes)
})
router.get('/maintenance-windows/all', async (req: Request, res: Response) => {
  try {
    const windows = await prisma.maintenanceWindow.findMany({
      include: {
        node: {
          select: {
            name: true,
            ipAddress: true,
            deviceType: true,
            status: true,
          }
        }
      },
      orderBy: { startTime: 'desc' },
    })
    res.json(windows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Connection endpoints
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const connections = await prisma.connection.findMany()
    res.json(connections)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/connections', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { fromNodeId, toNodeId, sourceHandle, targetHandle } = req.body
  if (!fromNodeId || !toNodeId) {
    res.status(400).json({ error: 'fromNodeId and toNodeId required' })
    return
  }
  try {
    const fromId = parseInt(fromNodeId)
    const toId = parseInt(toNodeId)
    const exists = await prisma.connection.findFirst({
      where: {
        fromNodeId: fromId,
        toNodeId: toId,
        sourceHandle: sourceHandle || null,
        targetHandle: targetHandle || null,
      }
    })
    if (exists) {
      res.status(200).json(exists)
      return
    }

    const connection = await prisma.connection.create({
      data: {
        fromNodeId: fromId,
        toNodeId: toId,
        sourceHandle: sourceHandle || null,
        targetHandle: targetHandle || null,
      }
    })
    res.status(201).json(connection)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/connections/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    await prisma.connection.delete({ where: { id } })
    res.json({ message: 'Connection deleted' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/diagnostic', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const type = req.query.type as string
  
  if (!type || (type !== 'ping' && type !== 'traceroute')) {
    res.status(400).json({ error: 'Valid type (ping or traceroute) is required' })
    return
  }

  const node = await prisma.node.findUnique({ where: { id } })
  if (!node) {
    res.status(404).json({ error: 'Node not found' })
    return
  }

  const ip = node.ipAddress

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let child: any

  if (type === 'ping') {
    child = spawn('ping', ['-c', '5', ip])
  } else {
    child = spawn('traceroute', [ip])
  }

  const streamOutput = (data: Buffer) => {
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify({ text: line })}\n\n`)
      }
    })
  }

  child.stdout.on('data', streamOutput)
  child.stderr.on('data', streamOutput)

  child.on('error', (err: any) => {
    let msg = `Error: ${err.message}\n`
    if (type === 'traceroute' && err.code === 'ENOENT') {
      msg = `Error: traceroute is not installed on this server. Please install it or use ping diagnostic.\n`
    }
    res.write(`data: ${JSON.stringify({ text: msg, error: true })}\n\n`)
    res.end()
  })

  child.on('close', (code: number) => {
    res.write(`data: ${JSON.stringify({ text: `Process exited with code ${code}`, done: true })}\n\n`)
    res.end()
  })

  req.on('close', () => {
    if (child) {
      child.kill()
    }
  })
})

router.put('/:id/maintenance', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { isMaintenance } = req.body
  try {
    const node = await prisma.node.update({
      where: { id },
      data: {
        isMaintenance,
        ...(isMaintenance && { status: 'maintenance' }),
      },
    })
    
    if (isMaintenance) {
      eventEmitter.emit('node:status', {
        nodeId: id,
        status: 'maintenance',
        lastChecked: new Date(),
      })
    }

    logAudit({
      userId: req.user?.userId,
      username: req.user?.username || 'System',
      action: 'NODE_MAINTENANCE_TOGGLE',
      target: node.name,
      details: `Manual Maintenance Mode: ${isMaintenance ? 'ENABLED' : 'DISABLED'}`,
      ipAddress: req.ip
    }).catch(console.error)
    
    res.json(node)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/maintenance-windows', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    const windows = await prisma.maintenanceWindow.findMany({
      where: { nodeId: id },
      orderBy: { startTime: 'asc' },
    })
    res.json(windows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/maintenance-windows', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { startTime, endTime, description } = req.body
  try {
    const mw = await prisma.maintenanceWindow.create({
      data: {
        nodeId: id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        description,
      },
      include: { node: true }
    })

    logAudit({
      userId: req.user?.userId,
      username: req.user?.username || 'System',
      action: 'MAINTENANCE_SCHEDULE',
      target: mw.node.name,
      details: `Scheduled window: ${new Date(startTime).toLocaleString('id-ID')} to ${new Date(endTime).toLocaleString('id-ID')}. Reason: ${description || '-'}`,
      ipAddress: req.ip
    }).catch(console.error)

    res.status(201).json(mw)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/maintenance-windows/:windowId', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const windowId = parseInt(req.params.windowId)
  try {
    const mw = await prisma.maintenanceWindow.findUnique({
      where: { id: windowId },
      include: { node: true }
    })
    if (!mw) {
      res.status(404).json({ error: 'Maintenance window not found' })
      return
    }

    await prisma.maintenanceWindow.delete({ where: { id: windowId } })

    logAudit({
      userId: req.user?.userId,
      username: req.user?.username || 'System',
      action: 'MAINTENANCE_DELETE',
      target: mw.node.name,
      details: `Deleted scheduled window (${new Date(mw.startTime).toLocaleString('id-ID')} - ${new Date(mw.endTime).toLocaleString('id-ID')})`,
      ipAddress: req.ip
    }).catch(console.error)

    res.json({ message: 'Maintenance window deleted' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid Node ID' })
    return
  }
  const node = await prisma.node.findUnique({
    where: { id },
    include: { customer: true, site: true, alarms: true, eventLogs: { take: 20, orderBy: { timestamp: 'desc' } } },
  })
  if (!node) { res.status(404).json({ error: 'Node not found' }); return }
  res.json(node)
})

router.post('/', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { name, ipAddress, deviceType, location, description, monitoringInterval, monitorType, monitorConfig, customerId, siteId, x, y, parentId } = req.body
  if (!name || !ipAddress || !customerId) {
    res.status(400).json({ error: 'Name, IP address, and customer ID required' })
    return
  }

  const node = await prisma.node.create({
    data: { 
      name, 
      ipAddress, 
      deviceType, 
      location, 
      description, 
      monitoringInterval, 
      monitorType, 
      monitorConfig, 
      customerId, 
      siteId: siteId || null, 
      x, 
      y,
      parentId: parentId ? parseInt(parentId) : null
    },
  })

  logAudit({
    userId: req.user?.userId,
    username: req.user?.username || 'System',
    action: 'NODE_CREATE',
    target: node.name,
    details: `IP: ${node.ipAddress}, Type: ${node.deviceType}`,
    ipAddress: req.ip
  }).catch(console.error)

  res.status(201).json(node)
})

router.put('/positions', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { positions } = req.body
  if (!Array.isArray(positions)) {
    res.status(400).json({ error: 'Positions list required' })
    return
  }
  try {
    await prisma.$transaction(
      positions.map((p: any) =>
        prisma.node.update({
          where: { id: parseInt(p.id) },
          data: { x: p.x, y: p.y },
        })
      )
    )
    res.json({ message: 'Positions updated successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/toggle-freeze', roleMiddleware('admin', 'operator'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { enabled } = req.body

  if (enabled === undefined) {
    res.status(400).json({ error: 'enabled state required' })
    return
  }

  try {
    const existingNode = await prisma.node.findUnique({ where: { id } })
    if (!existingNode) {
      res.status(404).json({ error: 'Node not found' })
      return
    }

    const newStatus = enabled ? 'unknown' : 'disabled'

    // If disabling (freezing), resolve active alarms for this node
    if (!enabled) {
      const activeAlarm = await prisma.alarm.findFirst({
        where: { nodeId: id, status: 'active' }
      })
      if (activeAlarm) {
        const endTime = new Date()
        const duration = Math.floor((endTime.getTime() - activeAlarm.startTime.getTime()) / 1000)
        const resolvedAlarm = await prisma.alarm.update({
          where: { id: activeAlarm.id },
          data: {
            status: 'resolved',
            endTime,
            duration,
            recoveryNote: 'Node frozen / disabled temporarily by operator',
          }
        })
        eventEmitter.emit('alarm:resolved', resolvedAlarm)
      }
    }

    const node = await prisma.node.update({
      where: { id },
      data: {
        enabled,
        status: newStatus,
      }
    })

    eventEmitter.emit('node:status', {
      nodeId: id,
      status: newStatus,
      enabled,
      lastChecked: new Date(),
    })

    logAudit({
      userId: req.user?.userId,
      username: req.user?.username || 'System',
      action: enabled ? 'NODE_UNFREEZE' : 'NODE_FREEZE',
      target: node.name,
      details: enabled ? 'Node unfrozen / monitoring reactivated' : 'Node frozen / monitoring temporarily disabled',
      ipAddress: req.ip
    }).catch(console.error)

    res.json(node)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const { name, ipAddress, deviceType, location, description, monitoringInterval, monitorType, monitorConfig, customerId, siteId, x, y, enabled, parentId } = req.body

  const data: any = {}
  if (name !== undefined) data.name = name
  if (ipAddress !== undefined) data.ipAddress = ipAddress
  if (deviceType !== undefined) data.deviceType = deviceType
  if (location !== undefined) data.location = location
  if (description !== undefined) data.description = description
  if (monitoringInterval !== undefined) data.monitoringInterval = monitoringInterval
  if (monitorType !== undefined) data.monitorType = monitorType
  if (monitorConfig !== undefined) data.monitorConfig = monitorConfig
  if (customerId !== undefined) data.customerId = customerId
  if (siteId !== undefined) data.siteId = siteId
  if (x !== undefined) data.x = x
  if (y !== undefined) data.y = y
  if (enabled !== undefined) {
    data.enabled = enabled
    if (!enabled) data.status = 'disabled'
  }
  if (parentId !== undefined) data.parentId = parentId ? parseInt(parentId) : null

  const node = await prisma.node.update({ where: { id }, data })

  if (enabled !== undefined) {
    eventEmitter.emit('node:status', {
      nodeId: id,
      status: node.status,
      enabled: node.enabled,
      lastChecked: new Date(),
    })
  }

  logAudit({
    userId: req.user?.userId,
    username: req.user?.username || 'System',
    action: 'NODE_UPDATE',
    target: node.name,
    details: `Updated fields. IP: ${node.ipAddress}`,
    ipAddress: req.ip
  }).catch(console.error)

  res.json(node)
})

router.delete('/:id', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const targetNode = await prisma.node.findUnique({ where: { id } })
  if (!targetNode) {
    res.status(404).json({ error: 'Node not found' })
    return
  }
  await prisma.node.delete({ where: { id } })

  logAudit({
    userId: req.user?.userId,
    username: req.user?.username || 'System',
    action: 'NODE_DELETE',
    target: targetNode.name,
    details: `Deleted node with IP: ${targetNode.ipAddress}`,
    ipAddress: req.ip
  }).catch(console.error)

  res.json({ message: 'Node deleted' })
})

// Bulk import nodes from JSON body
router.post('/import', roleMiddleware('admin'), async (req: Request, res: Response) => {
  const { nodes } = req.body
  if (!Array.isArray(nodes) || nodes.length === 0) {
    res.status(400).json({ error: 'Provide a nodes array' })
    return
  }

  const created = await prisma.node.createMany({ data: nodes.map((n: any) => ({
    name: n.name || n.Nama_Node,
    ipAddress: n.ipAddress || n.IP_Address,
    deviceType: n.deviceType || n.Tipe_Perangkat || 'router',
    location: n.location || n.Lokasi,
    description: n.description || n.Deskripsi,
    monitoringInterval: n.monitoringInterval || n.Interval_Detik || 30,
    customerId: n.customerId || 1,
  })) })

  logAudit({
    userId: req.user?.userId,
    username: req.user?.username || 'System',
    action: 'NODE_IMPORT',
    target: `${created.count} devices`,
    details: `Bulk imported nodes`,
    ipAddress: req.ip
  }).catch(console.error)

  res.status(201).json({ count: created.count })
})

// Export nodes
router.get('/export/json', async (req: Request, res: Response) => {
  const nodes = await prisma.node.findMany({ include: { customer: { select: { name: true } }, site: { select: { name: true } } } })
  res.json(nodes)
})

export default router
