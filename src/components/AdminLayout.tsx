import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { isSoundOn, playNotificationSound, setSoundOn, soundForType, unlockAudio } from '../lib/sound'
import {
  BarChart3,
  Boxes,
  Users,
  Volume2,
  VolumeX,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Settings,
  Ticket,
  XCircle,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../lib/hooks'
import { cn } from '../lib/utils'
import type { NotificationRow } from '../lib/types'
import { Logo } from './ui'

const GROUPS = [
  {
    title: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Tickets',
    links: [
      { to: '/admin/tickets', label: 'All Tickets', icon: Ticket, end: true },
      { to: '/admin/tickets/pending', label: 'Pending Tickets', icon: Clock },
      { to: '/admin/tickets/in-progress', label: 'In Progress', icon: Loader2 },
      { to: '/admin/tickets/resolved', label: 'Resolved', icon: CheckCircle2 },
      { to: '/admin/tickets/cancelled', label: 'Cancelled', icon: XCircle },
    ],
  },
  {
    title: 'Assets',
    links: [
      { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
      { to: '/admin/users', label: 'Office Users', icon: Users },
    ],
  },
  {
    title: 'Catalog',
    links: [
      { to: '/admin/equipment', label: 'Equipment Management', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: Layers },
      { to: '/admin/departments', label: 'Department Management', icon: Building2 },
      { to: '/admin/sops', label: 'IT SOP Library', icon: BookOpen },
    ],
  },
  {
    title: 'System',
    links: [
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout() {
  const { profile, user, signOut } = useAuth()
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [soundOn, setSoundState] = useState(isSoundOn)
  const location = useLocation()
  const navigate = useNavigate()
  const uid = user?.id

  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  // browsers need one user gesture before they allow sound
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundState(next)
    if (next) playNotificationSound('new', true)
  }

  const loadUnread = useCallback(async () => {
    if (!uid) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', uid)
      .eq('is_read', false)
    setUnread(count ?? 0)
  }, [uid])

  useEffect(() => {
    void loadUnread()
  }, [loadUnread])
  useRealtime(['notifications'], loadUnread)

  // pop a toast for every new notification addressed to this admin
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`notif-toast-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const n = payload.new as NotificationRow
          playNotificationSound(soundForType(n.type))
          toast(n.title, {
            icon: n.type === 'critical_ticket' ? '🚨' : '🔔',
            duration: 6000,
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [uid])

  const logout = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/admin/login', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-3 px-5 py-5">
        <Logo url={settings.company_logo_url} name={settings.site_name} />
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-wide">{settings.site_name}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">Admin Portal</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{g.title}</div>
            <div className="space-y-0.5">
              {g.links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      isActive
                        ? 'bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-md shadow-primary-400/30'
                        : 'text-ink-soft hover:bg-primary-50 hover:text-ink',
                    )
                  }
                >
                  <l.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{l.label}</span>
                  {l.to === '/admin/notifications' && unread > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-silver-200/70 p-3">
        <button onClick={logout} className="btn-ghost w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="glass-strong absolute inset-y-0 left-0 w-72 animate-pop-in rounded-l-none">
            <button className="icon-btn absolute right-2 top-3" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[17.5rem]">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden text-sm text-ink-soft lg:block">
              Welcome back, <b className="text-ink">{profile?.full_name || 'Admin'}</b>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link to="/" className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">User Portal</span>
              </Link>
              <button
                className="icon-btn"
                onClick={toggleSound}
                aria-label={soundOn ? 'Mute notification sound' : 'Turn on notification sound'}
                title={soundOn ? 'Notification sound: on' : 'Notification sound: off'}
              >
                {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-ink-faint" />}
              </button>
              <Link to="/admin/notifications" className="icon-btn relative" aria-label={`Notifications, ${unread} unread`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2 rounded-xl bg-white/80 py-1 pl-1 pr-3 ring-1 ring-silver-200">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-300 to-primary-600 text-sm font-bold text-white">
                  {(profile?.full_name || profile?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="hidden max-w-[11rem] truncate text-xs font-semibold sm:block">{profile?.email}</div>
              </div>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="page-enter mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
