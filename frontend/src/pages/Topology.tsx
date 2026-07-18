import { useCallback, useEffect, useState, useRef } from 'react'
import {
  ReactFlow, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Connection, type Node, type Edge,
  MarkerType, Handle, Position
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { useAuth } from '../context/AuthContext'
import {
  X, Router as RouterIcon, Network as SwitchIcon, Shield as FirewallIcon,
  Server as ServerIcon, Radio as ApIcon, Signal as ModemIcon, Zap as UpsIcon,
  Globe as OltIcon, HelpCircle
} from 'lucide-react'

const nodeTypeColors: Record<string, { bg: string; label: string }> = {
  router: { bg: '#6366f1', label: 'Router' },
  switch: { bg: '#06b6d4', label: 'Switch' },
  firewall: { bg: '#ef4444', label: 'Firewall' },
  server: { bg: '#8b5cf6', label: 'Server' },
  olt: { bg: '#f59e0b', label: 'OLT' },
  ap: { bg: '#10b981', label: 'AP' },
  modem: { bg: '#64748b', label: 'Modem' },
  ups: { bg: '#14b8a6', label: 'UPS' },
}

const deviceTypes = Object.keys(nodeTypeColors)

const deviceIcons: Record<string, any> = {
  router: RouterIcon,
  switch: SwitchIcon,
  firewall: FirewallIcon,
  server: ServerIcon,
  olt: OltIcon,
  ap: ApIcon,
  modem: ModemIcon,
  ups: UpsIcon,
}

function StatusNode({ data }: { data: any }) {
  const statusColor = data.status === 'down'
    ? '#ef4444'
    : data.status === 'warning'
      ? '#f59e0b'
      : data.status === 'maintenance'
        ? '#a855f7'
        : '#22c55e'
  const isDown = data.status === 'down'
  const IconComponent = deviceIcons[data.deviceType] || HelpCircle

  // Soft background tint for status icon container
  const iconBgTint = data.status === 'down'
    ? 'bg-red-500/10 text-red-500 dark:text-red-400'
    : data.status === 'warning'
      ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
      : data.status === 'maintenance'
        ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400'
        : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'

  return (
    <div className="px-4 py-3 rounded-2xl border bg-white dark:bg-zinc-900 shadow-lg text-zinc-800 dark:text-zinc-100 min-w-[160px] cursor-pointer relative transition-all duration-300 hover:shadow-xl"
      style={{
        borderColor: statusColor,
        boxShadow: `0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 10px 1px ${statusColor}1A`
      }}
    >
      {/* Top Handles */}
      <Handle type="target" position={Position.Top} id="t-target" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Top} id="t-source" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />

      {/* Bottom Handles */}
      <Handle type="target" position={Position.Bottom} id="b-target" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} id="b-source" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />

      {/* Left Handles */}
      <Handle type="target" position={Position.Left} id="l-target" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Left} id="l-source" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />

      {/* Right Handles */}
      <Handle type="target" position={Position.Right} id="r-target" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Right} id="r-source" style={{ background: '#cbd5e1', borderRadius: '50%', width: '8px', height: '8px' }} />

      <div className="flex items-center gap-3">
        {/* Styled Icon Container with status pulse if down */}
        <div className={`p-2 rounded-xl shrink-0 relative flex items-center justify-center ${iconBgTint}`}>
          {isDown && (
            <span className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping" />
          )}
          <IconComponent className="w-5 h-5 relative z-10" color={statusColor} />
        </div>

        {/* Labels & Info */}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-xs truncate leading-snug">{data.label}</div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">{data.ipAddress}</div>
        </div>

        {/* Status dot indicator */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${isDown ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: statusColor }}
        />
      </div>
    </div>
  )
}

const nodeTypes = { statusNode: StatusNode }

function NodePalette({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {deviceTypes.map((t) => (
        <button key={t} draggable
          onDragStart={(e) => { e.dataTransfer.setData('deviceType', t) }}
          onClick={() => onAdd(t)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          style={{ borderLeft: `3px solid ${nodeTypeColors[t].bg}` }}
          title={`Drag or click to add ${nodeTypeColors[t].label}`}
        >
          {(() => {
            const Icon = deviceIcons[t] || HelpCircle
            return <Icon className="w-3.5 h-3.5" color={nodeTypeColors[t].bg} />
          })()}
          {nodeTypeColors[t].label}
        </button>
      ))}
    </div>
  )
}

export default function Topology() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [editNode, setEditNode] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostics' | 'maintenance'>('info')
  const [diagType, setDiagType] = useState<'ping' | 'traceroute'>('ping')
  const [diagOutput, setDiagOutput] = useState<string[]>([])
  const [diagRunning, setDiagRunning] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const consoleBottomRef = useRef<HTMLDivElement>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)

  const [maintenanceList, setMaintenanceList] = useState<any[]>([])
  const [mwStart, setMwStart] = useState('')
  const [mwEnd, setMwEnd] = useState('')
  const [mwDesc, setMwDesc] = useState('')
  const [mwLoading, setMwLoading] = useState(false)
  const [mwError, setMwError] = useState('')

  const loadMaintenanceWindows = async (nodeId: number) => {
    try {
      const res = await api.nodes.listMaintenanceWindows(nodeId)
      setMaintenanceList(res)
    } catch (err) {
      console.error('Failed to load maintenance windows:', err)
    }
  }

  const handleCreateMaintenanceWindow = async () => {
    if (!editNode || !mwStart || !mwEnd) return
    setMwLoading(true)
    setMwError('')
    try {
      await api.nodes.createMaintenanceWindow(parseInt(editNode.id), {
        startTime: mwStart,
        endTime: mwEnd,
        description: mwDesc,
      })
      setMwStart('')
      setMwEnd('')
      setMwDesc('')
      loadMaintenanceWindows(parseInt(editNode.id))
      loadNodes()
    } catch (err: any) {
      setMwError(err.message || 'Failed to create schedule')
    } finally {
      setMwLoading(false)
    }
  }

  const handleDeleteMaintenanceWindow = async (windowId: number) => {
    if (!confirm('Delete this maintenance schedule?')) return
    try {
      await api.nodes.deleteMaintenanceWindow(windowId)
      if (editNode) {
        loadMaintenanceWindows(parseInt(editNode.id))
      }
      loadNodes()
    } catch (err) {
      console.error('Failed to delete window:', err)
    }
  }

  const handleToggleManualMaintenance = async (isMaint: boolean) => {
    if (!editNode) return
    try {
      await api.nodes.toggleMaintenance(parseInt(editNode.id), isMaint)
      editNode.data.isMaintenance = isMaint
      setEditNode({ ...editNode })
      loadNodes()
    } catch (err) {
      console.error('Failed to toggle manual maintenance:', err)
    }
  }

  const startDiagnostic = () => {
    if (!editNode) return
    stopDiagnostic()
    setDiagOutput([`Starting ${diagType} diagnostic to ${editNode.data.ipAddress}...`])
    setDiagRunning(true)
    const url = (api.nodes as any).diagnosticUrl(parseInt(editNode.id), diagType)
    const ev = new EventSource(url)
    eventSourceRef.current = ev
    ev.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.text) {
          setDiagOutput((prev) => [...prev, data.text])
        }
        if (data.done) {
          setDiagRunning(false)
          ev.close()
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }
    ev.onerror = () => {
      setDiagOutput((prev) => [...prev, 'Connection to server lost or failed.'])
      setDiagRunning(false)
      ev.close()
    }
  }

  const stopDiagnostic = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setDiagRunning(false)
  }

  const closeModal = () => {
    stopDiagnostic()
    setShowModal(false)
    setDiagOutput([])
  }

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [diagOutput])

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const loadNodes = useCallback(async () => {
    try {
      const [nodesData, connectionsData] = await Promise.all([
        api.nodes.list(),
        api.connections.list(),
      ])

      let needsLayout = false
      const flowNodes: Node[] = nodesData.map((n: any) => {
        if (n.x === null || n.y === null) {
          needsLayout = true
        }
        return {
          id: String(n.id),
          type: 'statusNode',
          position: { x: n.x ?? (Math.random() * 200 + 300), y: n.y ?? (Math.random() * 200 + 200) },
          data: {
            label: n.name, ipAddress: n.ipAddress, deviceType: n.deviceType,
            status: n.status || 'unknown', color: n.color,
            location: n.location, description: n.description,
            monitoringInterval: n.monitoringInterval, customerId: n.customerId,
            isMaintenance: n.isMaintenance,
            monitorConfig: n.monitorConfig,
          },
          draggable: isAdmin,
        }
      })
      setNodes(flowNodes)

      const flowEdges: Edge[] = connectionsData.map((c: any) => ({
        id: String(c.id),
        source: String(c.fromNodeId),
        target: String(c.toNodeId),
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
        markerEnd: { type: MarkerType.ArrowClosed },
      }))
      setEdges(flowEdges)

      if (needsLayout && flowNodes.length > 0) {
        // Run automatic force layout to distribute nodes nicely
        setTimeout(() => {
          handleLayout('force', flowNodes, flowEdges)
        }, 100)
      }
    } catch { } finally { setLoading(false) }
  }, [isAdmin])

  const handleLayout = async (type: 'grid' | 'circular' | 'force', nodesToLayout?: Node[], edgesToLayout?: Edge[]) => {
    const currentNodes = nodesToLayout || nodes
    const currentEdges = edgesToLayout || edges
    let updatedNodes: Node[] = []
    
    if (type === 'grid') {
      const typeOrder = ['router', 'firewall', 'switch', 'olt', 'ap', 'modem', 'server', 'ups']
      const sorted = [...currentNodes].sort((a, b) => {
        const orderA = typeOrder.indexOf(a.data.deviceType as string)
        const orderB = typeOrder.indexOf(b.data.deviceType as string)
        return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB)
      })

      const cols = Math.ceil(Math.sqrt(sorted.length))
      const xSpacing = 220
      const ySpacing = 160

      updatedNodes = sorted.map((node, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        return {
          ...node,
          position: {
            x: col * xSpacing + 50,
            y: row * ySpacing + 50,
          }
        }
      })
    } else if (type === 'circular') {
      const center = { x: 400, y: 300 }
      const radius = Math.max(150, currentNodes.length * 35)

      updatedNodes = currentNodes.map((node, index) => {
        const angle = (index / currentNodes.length) * 2 * Math.PI
        return {
          ...node,
          position: {
            x: Math.round(center.x + radius * Math.cos(angle)),
            y: Math.round(center.y + radius * Math.sin(angle)),
          }
        }
      })
    } else if (type === 'force') {
      const k = 200 // Optimal distance
      const iterations = 60
      
      const layoutNodes = currentNodes.map(n => ({
        id: n.id,
        x: n.position.x || Math.random() * 800,
        y: n.position.y || Math.random() * 600,
        fx: 0,
        fy: 0
      }))

      const nodeMap = new Map(layoutNodes.map(n => [n.id, n]))

      for (let i = 0; i < iterations; i++) {
        // 1. Repulsive forces (all pairs)
        for (let u = 0; u < layoutNodes.length; u++) {
          for (let v = u + 1; v < layoutNodes.length; v++) {
            const nodeA = layoutNodes[u]
            const nodeB = layoutNodes[v]
            let dx = nodeA.x - nodeB.x
            let dy = nodeA.y - nodeB.y
            if (dx === 0) dx = 0.1
            const dist = Math.sqrt(dx * dx + dy * dy)
            const force = (k * k) / dist
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            
            nodeA.fx += fx
            nodeA.fy += fy
            nodeB.fx -= fx
            nodeB.fy -= fy
          }
        }

        // 2. Attractive forces (connected pairs)
        currentEdges.forEach(edge => {
          const source = nodeMap.get(edge.source)
          const target = nodeMap.get(edge.target)
          if (source && target) {
            const dx = source.x - target.x
            const dy = source.y - target.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist === 0) return
            const force = (dist * dist) / k
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            source.fx -= fx
            source.fy -= fy
            target.fx += fx
            target.fy += fy
          }
        })

        // 3. Gravity
        const centerX = 400
        const centerY = 300
        layoutNodes.forEach(node => {
          const dx = centerX - node.x
          const dy = centerY - node.y
          const gravity = 0.05
          node.fx += dx * gravity
          node.fy += dy * gravity
        })

        // 4. Update positions with displacement limit
        const temp = 50 / (i + 1)
        layoutNodes.forEach(node => {
          const dist = Math.sqrt(node.fx * node.fx + node.fy * node.fy)
          if (dist === 0) return
          const displacement = Math.min(dist, temp)
          node.x += (node.fx / dist) * displacement
          node.y += (node.fy / dist) * displacement
          node.fx = 0
          node.fy = 0
        })
      }

      updatedNodes = currentNodes.map(node => {
        const layoutNode = nodeMap.get(node.id)
        return {
          ...node,
          position: {
            x: layoutNode ? Math.round(layoutNode.x) : node.position.x,
            y: layoutNode ? Math.round(layoutNode.y) : node.position.y
          }
        }
      })
    }

    if (updatedNodes.length > 0) {
      setNodes(updatedNodes)
      
      // Save updated coordinates in database
      if (isAdmin) {
        try {
          const positions = updatedNodes.map(n => ({
            id: parseInt(n.id),
            x: n.position.x,
            y: n.position.y
          }))
          await (api.nodes as any).updatePositions(positions)
        } catch (err) {
          console.error('Failed to save auto-layout positions:', err)
        }
      }
    }
  }

  useEffect(() => { loadNodes() }, [loadNodes])

  useEffect(() => {
    const handler = (data: any) => {
      setNodes((nds) => nds.map((n) =>
        n.id === String(data.nodeId)
          ? {
              ...n,
              data: {
                ...n.data,
                status: data.status,
                latencyMs: data.latencyMs,
                packetLoss: data.packetLoss,
              },
            }
          : n
      ))
    }
    socket.on('node:status', handler)
    return () => { socket.off('node:status', handler) }
  }, [])

  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      setEdges((eds) => {
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        let changed = false
        const nextEds = eds.map(edge => {
          const sourceNode = nodeMap.get(edge.source)
          const targetNode = nodeMap.get(edge.target)

          if (!sourceNode || !targetNode) return edge

          const sourceStatus = sourceNode.data.status || 'unknown'
          const targetStatus = targetNode.data.status || 'unknown'
          const latency = (targetNode.data.latencyMs as number) || 0
          const loss = (targetNode.data.packetLoss as number) || 0

          let stroke = '#22c55e' // Green (Up)
          let animated = true
          let strokeDasharray = undefined
          let label = ''

          if (sourceStatus === 'down' || targetStatus === 'down') {
            stroke = '#ef4444' // Red (Down)
            animated = false
            strokeDasharray = '5,5'
            label = 'OFFLINE'
          } else if (sourceStatus === 'warning' || targetStatus === 'warning') {
            stroke = '#f59e0b' // Amber (Warning)
            animated = true
            label = `${Math.round(latency)}ms (${Math.round(loss)}% loss)`
          } else if (sourceStatus === 'maintenance' || targetStatus === 'maintenance') {
            stroke = '#a855f7' // Purple (Maintenance)
            animated = true
            strokeDasharray = '3,3'
            label = 'MAINT'
          } else {
            label = `${latency.toFixed(1)} ms`
          }

          if (edge.label !== label || edge.style?.stroke !== stroke || edge.animated !== animated) {
            changed = true
            return {
              ...edge,
              animated,
              label,
              labelStyle: { fill: stroke, fontWeight: 700, fontSize: 9 },
              labelBgStyle: { fill: '#18181b', fillOpacity: 0.85, rx: 6, ry: 6 },
              labelBgPadding: [6, 4] as [number, number],
              style: {
                stroke,
                strokeWidth: 2.5,
                strokeDasharray,
                transition: 'stroke 0.3s, stroke-width 0.3s'
              }
            }
          }
          return edge
        })
        return changed ? nextEds : eds
      })
    }
  }, [nodes])

  const onConnect = useCallback(async (params: Connection) => {
    if (!isAdmin || !params.source || !params.target) return
    try {
      const res = await api.connections.create(
        parseInt(params.source),
        parseInt(params.target),
        params.sourceHandle,
        params.targetHandle
      )
      setEdges((eds) => addEdge({ ...params, id: String(res.id), markerEnd: { type: MarkerType.ArrowClosed } }, eds))
    } catch (err) {
      console.error('Failed to save connection:', err)
    }
  }, [isAdmin])

  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    if (!isAdmin) return
    try {
      await api.nodes.update(parseInt(node.id), {
        x: node.position.x,
        y: node.position.y,
      })
    } catch (err) {
      console.error('Failed to save node position:', err)
    }
  }, [isAdmin])

  const onNodeDoubleClick = (_: any, node: Node) => {
    if (!isAdmin) return
    setEditNode(node)
    setActiveTab('info')
    setDiagOutput([])
    setDiagRunning(false)
    setShowModal(true)
    loadMaintenanceWindows(parseInt(node.id))
  }

  const handleSave = async () => {
    if (!editNode) return
    const id = parseInt(editNode.id)
    const data = {
      name: editNode.data.label,
      ipAddress: editNode.data.ipAddress,
      deviceType: editNode.data.deviceType,
      location: editNode.data.location,
      description: editNode.data.description,
      monitoringInterval: parseInt(editNode.data.monitoringInterval) || 30,
      monitorConfig: editNode.data.monitorConfig || {},
      x: editNode.position.x,
      y: editNode.position.y,
    }
    await api.nodes.update(id, data)
    setShowModal(false)
    loadNodes()
  }

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('deviceType')
    if (!type || !reactFlowInstance || !reactFlowWrapper.current) return
    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const pos = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    addNewNode(type, pos.x, pos.y)
  }, [reactFlowInstance])

  const addNewNode = async (type: string, x: number, y: number) => {
    if (!isAdmin) return
    const name = `New-${nodeTypeColors[type]?.label || type}-${Date.now() % 1000}`
    await api.nodes.create({
      name, ipAddress: '0.0.0.0', deviceType: type,
      customerId: 1, x, y, monitoringInterval: 30,
    })
    loadNodes()
  }

  const handleDeleteNode = async (id: number) => {
    if (!isAdmin || !confirm('Delete this node?')) return
    await api.nodes.delete(id)
    loadNodes()
  }

  const handleDeleteEdge = async (id: number) => {
    if (!isAdmin) return
    try {
      await api.connections.delete(id)
    } catch (err) {
      console.error('Failed to delete connection:', err)
    }
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-400">Loading topology...</div>

  return (
    <div className="h-full space-y-3">
      <div className="flex items-center justify-between relative">
        <h1 className="text-lg font-semibold">Topology Editor</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="relative">
              <button 
                onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 shadow-sm"
              >
                Auto Layout ▾
              </button>
              {layoutMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-zinc-800 border rounded-lg shadow-xl z-50 text-xs py-1 animate-toast">
                  <button 
                    onClick={() => { handleLayout('grid'); setLayoutMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium"
                  >
                    Grid Arrangement
                  </button>
                  <button 
                    onClick={() => { handleLayout('circular'); setLayoutMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium"
                  >
                    Circular Arrangement
                  </button>
                  <button 
                    onClick={() => { handleLayout('force'); setLayoutMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium"
                  >
                    Force Directed Spring
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={loadNodes} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200">Refresh</button>
        </div>
      </div>

      {isAdmin && <NodePalette onAdd={(t) => addNewNode(t, 100 + Math.random() * 300, 100 + Math.random() * 200)} />}

      <div className="h-[calc(100vh-16rem)] bg-white dark:bg-zinc-800 rounded-xl border" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={isAdmin ? 'Delete' : undefined}
          onNodesDelete={(nds) => nds.forEach((n) => handleDeleteNode(parseInt(n.id)))}
          onEdgesDelete={(eds) => eds.forEach((e) => handleDeleteEdge(parseInt(e.id)))}
        >
          <Background />
          <Controls className="!bg-white dark:!bg-zinc-950 !border-zinc-200 dark:!border-zinc-800 !shadow-lg [&_button]:!bg-white [&_button]:dark:!bg-zinc-900 [&_button]:!border-zinc-200 [&_button]:dark:!border-zinc-800 [&_svg]:!fill-zinc-800 [&_svg]:dark:!fill-zinc-200" />
          <MiniMap 
            className="!bg-white dark:!bg-zinc-950 !border-zinc-200 dark:!border-zinc-800 rounded-xl overflow-hidden shadow-lg"
            nodeColor={(node) => {
              if (node.data?.status === 'down') return '#ef4444'
              if (node.data?.status === 'warning') return '#f59e0b'
              if (node.data?.status === 'maintenance') return '#a855f7'
              return '#22c55e'
            }}
            maskColor="rgba(0, 0, 0, 0.15)"
          />
        </ReactFlow>
      </div>

      {showModal && editNode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-xl p-5 w-full max-w-md m-4 space-y-4 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-sm">Edit Node: {editNode.data.label}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b text-xs mb-3">
              <button
                type="button"
                onClick={() => { if (!diagRunning) setActiveTab('info') }}
                className={`flex-1 py-1.5 font-medium border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-emerald-500 text-emerald-600 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                } ${diagRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Edit Info
              </button>
              <button
                type="button"
                onClick={() => { if (!diagRunning) setActiveTab('diagnostics') }}
                className={`flex-1 py-1.5 font-medium border-b-2 transition-colors ${
                  activeTab === 'diagnostics'
                    ? 'border-emerald-500 text-emerald-600 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                } ${diagRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Diagnostics
              </button>
              <button
                type="button"
                onClick={() => { if (!diagRunning) setActiveTab('maintenance') }}
                className={`flex-1 py-1.5 font-medium border-b-2 transition-colors ${
                  activeTab === 'maintenance'
                    ? 'border-emerald-500 text-emerald-600 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                } ${diagRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Maintenance
              </button>
            </div>

            {activeTab === 'maintenance' ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Manual switch */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <span className="text-xs font-semibold block">Manual Maintenance Mode</span>
                    <span className="text-[10px] text-zinc-400">Put node in maintenance immediately.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleManualMaintenance(!editNode.data.isMaintenance)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editNode.data.isMaintenance ? 'bg-purple-600' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editNode.data.isMaintenance ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Schedule window form */}
                <div className="space-y-2 border-b pb-3">
                  <span className="text-xs font-semibold block">Schedule Maintenance Window</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Start Time</label>
                      <input
                        type="datetime-local"
                        value={mwStart}
                        onChange={(e) => setMwStart(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs dark:bg-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">End Time</label>
                      <input
                        type="datetime-local"
                        value={mwEnd}
                        onChange={(e) => setMwEnd(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs dark:bg-zinc-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Description / Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Hardware upgrade"
                      value={mwDesc}
                      onChange={(e) => setMwDesc(e.target.value)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs dark:bg-zinc-700"
                    />
                  </div>
                  {mwError && <div className="text-[10px] text-red-500">{mwError}</div>}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={mwLoading}
                      onClick={handleCreateMaintenanceWindow}
                      className="px-3 py-1.5 text-[10px] font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {mwLoading ? 'Scheduling...' : 'Add Schedule'}
                    </button>
                  </div>
                </div>

                {/* Scheduled windows list */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold block">Active & Upcoming Schedules</span>
                  <div className="space-y-1.5">
                    {maintenanceList.map((mw) => (
                      <div key={mw.id} className="p-2 border rounded-lg bg-zinc-50 dark:bg-zinc-900/40 text-[10px] flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-700 dark:text-zinc-300">
                            {new Date(mw.startTime).toLocaleString('id-ID')} - {new Date(mw.endTime).toLocaleString('id-ID')}
                          </div>
                          {mw.description && (
                            <div className="text-zinc-400 truncate mt-0.5">{mw.description}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaintenanceWindow(mw.id)}
                          className="text-red-500 hover:text-red-700 font-semibold px-1 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {maintenanceList.length === 0 && (
                      <div className="text-center py-4 text-zinc-400 text-[10px]">No maintenance windows scheduled</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-1.5 text-xs rounded-lg border font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : activeTab === 'diagnostics' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-zinc-500 font-medium">Type:</span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="diagType"
                      checked={diagType === 'ping'}
                      onChange={() => setDiagType('ping')}
                      disabled={diagRunning}
                      className="accent-emerald-600"
                    />
                    Ping
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="diagType"
                      checked={diagType === 'traceroute'}
                      onChange={() => setDiagType('traceroute')}
                      disabled={diagRunning}
                      className="accent-emerald-600"
                    />
                    Traceroute
                  </label>
                </div>

                {/* Console card */}
                <div className="h-44 w-full bg-zinc-950 text-zinc-100 rounded-lg p-2.5 font-mono text-[10px] leading-relaxed overflow-y-auto border border-zinc-800 shadow-inner flex flex-col">
                  <div className="flex-1 space-y-1">
                    {diagOutput.map((line, idx) => (
                      <div key={idx} className={line.startsWith('Error') ? 'text-red-400' : 'text-zinc-300'}>
                        {line}
                      </div>
                    ))}
                    <div ref={consoleBottomRef} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  {diagRunning ? (
                    <button
                      type="button"
                      onClick={stopDiagnostic}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startDiagnostic}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors"
                    >
                      Run Diagnostic
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={diagRunning}
                    className="px-3 py-1.5 text-xs rounded-lg border font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
                  value={editNode.data.label}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, label: e.target.value } })}
                  placeholder="Node Name" />
                <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
                  value={editNode.data.ipAddress}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, ipAddress: e.target.value } })}
                  placeholder="IP Address" />
                <select className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
                  value={editNode.data.deviceType}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, deviceType: e.target.value } })}>
                  {deviceTypes.map((t) => <option key={t} value={t}>{nodeTypeColors[t].label}</option>)}
                </select>
                <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
                  value={editNode.data.location || ''}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, location: e.target.value } })}
                  placeholder="Location" />
                <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700"
                  type="number" min={5} max={300}
                  value={editNode.data.monitoringInterval || 30}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, monitoringInterval: e.target.value } })}
                  placeholder="Interval (s)" />

                {/* Adaptive Warning Thresholds */}
                <div className="grid grid-cols-2 gap-2 border-t pt-2.5">
                  <div>
                    <label className="text-[9px] font-semibold text-zinc-400 block mb-0.5">Latency Warning Limit (ms)</label>
                    <input className="w-full px-2.5 py-1.5 border rounded-lg text-xs dark:bg-zinc-700"
                      type="number" min={10} max={2000}
                      value={(editNode.data.monitorConfig as any)?.latencyWarningMs ?? 150}
                      onChange={(e) => setEditNode({
                        ...editNode,
                        data: {
                          ...editNode.data,
                          monitorConfig: {
                            ...((editNode.data.monitorConfig as any) || {}),
                            latencyWarningMs: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      placeholder="e.g. 150" />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-zinc-400 block mb-0.5">Packet Loss Warning Limit (%)</label>
                    <input className="w-full px-2.5 py-1.5 border rounded-lg text-xs dark:bg-zinc-700"
                      type="number" min={1} max={100}
                      value={(editNode.data.monitorConfig as any)?.packetLossWarningPercent ?? 10}
                      onChange={(e) => setEditNode({
                        ...editNode,
                        data: {
                          ...editNode.data,
                          monitorConfig: {
                            ...((editNode.data.monitorConfig as any) || {}),
                            packetLossWarningPercent: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      placeholder="e.g. 10" />
                  </div>
                </div>

                <textarea className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" rows={2}
                  value={editNode.data.description || ''}
                  onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, description: e.target.value } })}
                  placeholder="Description" />
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={closeModal} className="px-3 py-1.5 text-xs rounded-lg border">Cancel</button>
                  <button onClick={() => { handleDeleteNode(parseInt(editNode.id)); closeModal() }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700">Delete</button>
                  <button onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
