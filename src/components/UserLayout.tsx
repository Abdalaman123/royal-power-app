import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Clock, Download, Mail, MapPin, Menu, Phone, ShieldCheck, X } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { useDownload } from '../lib/desktop'
import { Logo } from './ui'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/request/new', label: 'Create Request' },
  { to: '/catalog', label: 'Equipment Catalog' },
  { to: '/sops', label: 'IT SOPs' },
  { to: '/track', label: 'Track My Request' },
  { to: '/about', label: 'About IT Support' },
]

export default function UserLayout() {
  const { settings } = useSettings()
  const { isAdmin } = useAuth()
  const dl = useDownload()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const adminLink = isAdmin ? { to: '/admin', label: 'Admin Dashboard' } : { to: '/admin/login', label: 'Admin Login' }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label={`${settings.site_name} home`}>
            <Logo url={settings.company_logo_url} name={settings.site_name} />
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide">{settings.site_name}</div>
              <div className="hidden text-[11px] font-medium text-ink-soft sm:block">{settings.tagline}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition',
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-soft hover:bg-primary-50/70 hover:text-ink',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {dl && (
              <a href={dl.url} download className="btn-secondary hidden md:inline-flex" title={`Download the ${dl.label} app`}>
                <Download className="h-4 w-4" /> {dl.label} App
              </a>
            )}
            <Link to={adminLink.to} className="btn-primary hidden sm:inline-flex">
              <ShieldCheck className="h-4 w-4" />
              {adminLink.label}
            </Link>
            <button
              className="icon-btn lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="animate-pop-in border-t border-silver-200/60 bg-white/95 px-4 py-3 lg:hidden" aria-label="Mobile">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3 py-3 text-sm font-semibold',
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-soft hover:bg-primary-50/70',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              {dl && (
                <a href={dl.url} download className="btn-secondary mt-2">
                  <Download className="h-4 w-4" /> Download {dl.label} App
                </a>
              )}
              <Link to={adminLink.to} className="btn-primary mt-2">
                <ShieldCheck className="h-4 w-4" />
                {adminLink.label}
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main key={location.pathname} className="page-enter mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="mt-10 border-t border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <Logo url={settings.company_logo_url} name={settings.site_name} size={36} />
              <span className="text-lg font-extrabold tracking-wide">{settings.site_name}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-soft">{settings.tagline}. One place to request equipment, get help and track every ticket.</p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Quick links</h3>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {NAV.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="text-ink-soft transition hover:text-primary-700">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/admin/login" className="text-ink-soft transition hover:text-primary-700">
                  Admin Login
                </Link>
              </li>
              {dl && (
                <li>
                  <a href={dl.url} download className="text-ink-soft transition hover:text-primary-700">
                    Download {dl.label} App
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">IT Support</h3>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary-500" />
                <a href={`mailto:${settings.support_email}`} className="hover:text-primary-700">
                  {settings.support_email}
                </a>
              </li>
              {settings.support_phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary-500" /> {settings.support_phone}
                </li>
              )}
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-500" /> {settings.support_hours}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary-500" /> {settings.support_location}
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-silver-200/60 py-4 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} {settings.site_name}. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
