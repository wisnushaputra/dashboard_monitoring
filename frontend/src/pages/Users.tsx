import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'viewer' })
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = () => {
    fetch('/api/auth', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then((r) => r.json()).then(setUsers).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      await fetch(`/api/auth/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ username: '', password: '', role: 'viewer' })
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return
    await fetch(`/api/auth/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    load()
  }

  if (user?.role !== 'admin') return <div className="text-center py-8 text-zinc-400">Access denied</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ username: '', password: '', role: 'viewer' }) }}
          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase border-b">
            <tr>
              <th className="text-left px-4 py-2">Username</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Created</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700">{u.role}</span>
                </td>
                <td className="px-4 py-2 text-zinc-400">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(u.id); setForm({ username: u.username, password: '', role: u.role }); setShowForm(true) }}
                      className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-700">Edit</button>
                    <button onClick={() => handleDelete(u.id)}
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 rounded-xl border shadow-lg p-5 w-full max-w-sm m-4 space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">{editingId ? 'Edit User' : 'Add User'}</h2>
            <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" placeholder="Username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <input className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" type="password" placeholder={editingId ? 'New password (leave empty)' : 'Password'} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
            <select className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-zinc-700" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs rounded-lg border">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
