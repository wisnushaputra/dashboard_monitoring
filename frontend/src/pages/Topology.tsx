import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Connection, type Edge, type Node,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '../lib/api'
import socket from '../lib/socket'
import { useAuth } from '../context/AuthContext'

const nodeTypeColors: Record<string, string> = {
  router: '#6366f1', switch: '#06b6d4', firewall: '#ef4444',
  server: '#8b5cf6', olt: '#f59e0b', ap: '#10b981',
}

const defaultIcon = '●'

function StatusNode({ data }: { data: any }) {
  const statusColor = data.status === 'down' ? '#ef4444' : data.status === 'warning' ? '#f59e0b' : '#22c55e'
  const isDown = data.status === 'down'
  return (
    <div className="px-3 py-2 rounded-xl border-2 text-white text-xs font-medium shadow-sm"
      style={{ backgroundColor: data.color || nodeTypeColors[data.deviceType] || '#64748b', borderColor: statusColor }}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isDown ? 'animate-ping' : ''}`} style={{ backgroundColor: statusColor }} />
        <span className="font-semibold">{data.label}</span>
      </div>
      <div className="text-[10px] opacity-80">{data.ipAddress}</div>
    </div>
  )
}

const nodeTypes = { statusNode: StatusNode }

export default function Topology() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [editNode, setEditNode] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)

  const loadNodes = useCallback(async () => {
    try {
      const data = await api.nodes.list()
      const flowNodes: Node[] = data.map((n: any) => ({
        id: String(n.id),
        type: 'statusNode',
        position: { x: n.x || Math.random() * 400, y: n.y || Math.random() * 300 },
        data: { label: n.name, ipAddress: n.ipAddress, deviceType: n.deviceType, status: n.status || 'unknown', color: n.color },
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
    await api.nodes.update(id, { x: editNode.position.x, y: editNode.position.y, ...editNode.data })
    setShowModal(false)
    loadNodes()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-400">Loading topology...</div>

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Topology Editor</h1>
        <button onClick={loadNodes} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200">
          Refresh
        </button>
      </div>

      <div className="h-[calc(100vh-12rem)] bg-white dark:bg-zinc-800 rounded-xl border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Edit Modal */}
      {showModal && editNode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-lg p-5 w-full max-w-sm m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-4">Edit Node</h2>
            <div className="space-y-3 text-sm">
              <input className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-700" value={editNode.data.label}
                onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, label: e.target.value } })} placeholder="Name" />
              <input className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-700" value={editNode.data.ipAddress}
                onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, ipAddress: e.target.value } })} placeholder="IP Address" />
              <select className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-700" value={editNode.data.deviceType}
                onChange={(e) => setEditNode({ ...editNode, data: { ...editNode.data, deviceType: e.target.value } })}>
                {Object.keys(nodeTypeColors).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs rounded-lg border">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
