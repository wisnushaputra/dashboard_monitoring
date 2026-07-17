import { useCallback, useEffect, useState, useRef } from 'react'
import {
  ReactFlow, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Connection, type Node, type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { useAuth } from '../context/AuthContext'

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

const deviceIcons: Record<string, string> = {
  router: '▢', switch: '◈', firewall: '⬡', server: '⊞', olt: '◉', ap: '◆', modem: '⬟', ups: '⚡',
}

function StatusNode({ data }: { data: any }) {
  const statusColor = data.status === 'down' ? '#ef4444' : data.status === 'warning' ? '#f59e0b' : '#22c55e'
  const isDown = data.status === 'down'
  return (
    <div className="px-3 py-2 rounded-xl border-2 text-white text-xs font-medium shadow-sm min-w-[120px] cursor-pointer"
      style={{ backgroundColor: data.color || nodeTypeColors[data.deviceType]?.bg || '#64748b', borderColor: statusColor }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{deviceIcons[data.deviceType] || '●'}</span>
        <span className={`w-2 h-2 rounded-full ${isDown ? 'animate-ping' : ''}`} style={{ backgroundColor: statusColor }} />
        <span className="font-semibold truncate">{data.label}</span>
      </div>
      <div className="text-[10px] opacity-80 truncate">{data.ipAddress}</div>
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
          <span style={{ color: nodeTypeColors[t].bg }}>{deviceIcons[t]}</span>
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

  const loadNodes = useCallback(async () => {
    try {
      const data = await api.nodes.list()
      const flowNodes: Node[] = data.map((n: any) => ({
        id: String(n.id),
        type: 'statusNode',
        position: { x: n.x || Math.random() * 500, y: n.y || Math.random() * 400 },
        data: {
          label: n.name, ipAddress: n.ipAddress, deviceType: n.deviceType,
          status: n.status || 'unknown', color: n.color,
          location: n.location, description: n.description,
          monitoringInterval: n.monitoringInterval, customerId: n.customerId,
        },
        draggable: isAdmin,
      }))
      setNodes(flowNodes)
    } catch { } finally { setLoading(false) }
  }, [isAdmin])

  useEffect(() => { loadNodes() }, [loadNodes])

  useEffect(() => {
    const handler = (data: any) => {
      setNodes((nds) => nds.map((n) =>
        n.id === String(data.nodeId) ? { ...n, data: { ...n.data, status: data.status } } : n
      ))
    }
    socket.on('node:status', handler)
    return () => { socket.off('node:status', handler) }
  }, [])

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds))
  }, [])

  const onNodeDoubleClick = (_: any, node: Node) => {
    if (!isAdmin) return
    setEditNode(node)
    setShowModal(true)
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-400">Loading topology...</div>

  return (
    <div className="h-full space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Topology Editor</h1>
        <button onClick={loadNodes} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200">Refresh</button>
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
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={isAdmin ? 'Delete' : undefined}
          onNodesDelete={(nds) => nds.forEach((n) => handleDeleteNode(parseInt(n.id)))}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {showModal && editNode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-lg p-5 w-full max-w-sm m-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Edit Node</h2>
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
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" rows={2}
              value={editNode.data.description || ''}
              onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, description: e.target.value } })}
              placeholder="Description" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs rounded-lg border">Cancel</button>
              <button onClick={() => { handleDeleteNode(parseInt(editNode.id)); setShowModal(false) }}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700">Delete</button>
              <button onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
