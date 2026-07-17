import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Network, Bell, History, LogOut, Menu, X, Moon, Sun, Volume2, VolumeX, Users
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/topology', icon: Network, label: 'Topology' },
  { to: '/alarms', icon: Bell, label: 'Alarms' },
  { to: '/history', icon: History, label: 'History' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [alarmSound, setAlarmSound] = useState(true)

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
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
    </div>
  )
}
