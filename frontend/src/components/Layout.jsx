import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquareText,
  FileText,
  Activity,
  Pill,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Logo } from './Logo.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'doctor', 'patient'] },
  { to: '/assistant', label: 'AI Assistant', icon: MessageSquareText, roles: ['admin', 'doctor', 'patient'] },
  { to: '/reports', label: 'Report Analysis', icon: FileText, roles: ['admin', 'doctor', 'patient'] },
  { to: '/risk-check', label: 'Risk Check', icon: Activity, roles: ['admin', 'doctor', 'patient'] },
  { to: '/medications', label: 'Medication Checker', icon: Pill, roles: ['admin', 'doctor', 'patient'] },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['admin', 'doctor'] },
  { to: '/profile', label: 'Profile', icon: UserCircle, roles: ['admin', 'doctor', 'patient'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-paper">
      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-ink px-4 py-3 md:hidden">
        <Logo tone="dark" size={26} textClass="text-lg" />
        <button onClick={() => setMobileOpen((v) => !v)} className="text-paper" aria-label="Toggle menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 transform bg-ink transition-transform md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col px-4 py-6">
          <div className="mb-8 hidden px-2 md:block">
            <Logo tone="dark" />
            <div className="readout-label mt-1 text-paper/50">Clinical Intelligence</div>
          </div>

          <nav className="flex-1 space-y-1 pt-16 md:pt-0">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-pulse text-white'
                      : 'text-paper/70 hover:bg-white/5 hover:text-paper'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 pt-4">
            <div className="px-3 text-xs text-paper/50">Signed in as</div>
            <div className="px-3 text-sm font-medium text-paper">{user.full_name}</div>
            <div className="px-3 text-xs uppercase tracking-wide text-pulse">{user.role}</div>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-paper/70 hover:bg-white/5 hover:text-paper"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="flex-1 overflow-y-auto px-5 py-6 pt-20 md:px-10 md:py-10 md:pt-10">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
