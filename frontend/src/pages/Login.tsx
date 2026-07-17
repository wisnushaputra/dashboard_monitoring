import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Network } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-zinc-800 rounded-xl shadow-sm border p-6 space-y-4">
        <div className="flex items-center gap-2 justify-center mb-4">
          <Network className="w-6 h-6 text-emerald-500" />
          <span className="font-semibold text-lg">NOC Dashboard</span>
        </div>

        {error && <div className="text-red-500 text-sm text-center">{error}</div>}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:border-zinc-600"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:border-zinc-600"
        />
        <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
          Sign In
        </button>
      </form>
    </div>
  )
}
