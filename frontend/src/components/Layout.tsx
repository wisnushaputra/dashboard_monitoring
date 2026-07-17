import { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Network, Bell, History, LogOut, Menu, Moon, Sun, Volume2, VolumeX, Users, X, AlertTriangle, Settings, Upload, Play, FileBarChart
} from 'lucide-react'
import socket from '../lib/socket'
import { api } from '../lib/api'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/topology', icon: Network, label: 'Topology' },
  { to: '/alarms', icon: Bell, label: 'Alarms' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
]

function playAlarmSound() {
  try {
    const audio = new Audio(`/api/notifications/alarm-sound?t=${Date.now()}`)
    audio.volume = 0.4
    audio.play().catch((err) => {
      console.error('Failed to play custom alarm sound:', err)
    })
  } catch (error) {
    console.error('Failed to initialize Audio object:', error)
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [alarmSound, setAlarmSound] = useState(true)
  const [alerts, setAlerts] = useState<{ id: string; nodeName: string; ipAddress: string }[]>([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const alarmSoundRef = useRef(alarmSound)

  useEffect(() => {
    alarmSoundRef.current = alarmSound
  }, [alarmSound])

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.wav')) {
      setUploadStatus('Only .wav files are allowed')
      return
    }

    setUploading(true)
    setUploadStatus('')

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const fileData = reader.result as string
        await api.notifications.uploadAlarmSound(fileData)
        setUploadStatus('Upload successful!')
      } catch (err: any) {
        setUploadStatus('Upload failed: ' + (err.message || 'Error'))
      } finally {
        setUploading(false)
      }
    }
    reader.onerror = () => {
      setUploadStatus('Failed to read file')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  useEffect(() => {
    const handleAlarmCreated = async (alarm: any) => {
      if (alarmSoundRef.current) {
        playAlarmSound()
      }
      try {
        const node = await api.nodes.get(alarm.nodeId)
        const id = `${alarm.id}-${Date.now()}`
        setAlerts((prev) => [...prev, { id, nodeName: node.name, ipAddress: node.ipAddress }])
        setTimeout(() => {
          removeAlert(id)
        }, 8000)
      } catch (err) {
        console.error('Failed to load node details for alarm:', err)
      }
    }

    socket.on('alarm:created', handleAlarmCreated)
    return () => {
      socket.off('alarm:created', handleAlarmCreated)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <div className={`flex h-screen ${dark ? 'dark bg-zinc-900 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col
        ${dark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}
        border-r transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
          <Network className="w-6 h-6 text-emerald-500" />
          <span className="font-semibold text-sm tracking-tight">NOC Dashboard</span>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? dark ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-900'
                    : dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? dark ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-900'
                    : dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`
              }
            >
              <Users className="w-4 h-4" />
              Users
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t text-xs text-zinc-400">
          {user?.username} ({user?.role})
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className={`flex items-center justify-between h-14 px-4 border-b shrink-0 ${
          dark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'
        }`}>
          <button className="lg:hidden p-1 rounded hover:bg-zinc-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setAlarmSound(!alarmSound)} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700" title="Toggle alarm sound">
              {alarmSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700" title="Settings">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={toggleDark} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Floating Toast Alerts Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-4 rounded-xl border bg-white/95 dark:bg-zinc-800/95 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-md border-red-200 dark:border-red-900/50 animate-toast pointer-events-auto"
          >
            <div className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Node Down Alert!</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
                Node <strong className="font-semibold">{alert.nodeName}</strong> ({alert.ipAddress}) has gone offline.
              </p>
            </div>
            <button
              onClick={() => removeAlert(alert.id)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border shadow-xl p-5 w-full max-w-sm m-4 space-y-4 relative animate-toast" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-sm">Notification Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Alarm Sound Alert</span>
                <button
                  onClick={() => setAlarmSound(!alarmSound)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alarmSound ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alarmSound ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="border-t pt-3 space-y-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Custom Alarm Sound (.wav)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium bg-zinc-50 dark:bg-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input type="file" accept=".wav" onChange={handleSoundUpload} className="hidden" />
                  </label>
                  <button
                    onClick={playAlarmSound}
                    className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Test Sound</span>
                  </button>
                </div>
                {uploading && <div className="text-[10px] text-zinc-400">Uploading...</div>}
                {uploadStatus && (
                  <div className={`text-[10px] ${uploadStatus.includes('successful') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {uploadStatus}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
