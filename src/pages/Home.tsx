import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Monitor,
  Smartphone,
  FilePlus2,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
  UserCheck,
} from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useCatalog } from '../lib/hooks'
import { getIcon } from '../lib/icons'
import { Skeleton } from '../components/ui'
import { useDownload } from '../lib/desktop'

const STEPS = [
  { icon: FilePlus2, title: 'Submit a request', text: 'Fill in the request form with the equipment you need and why.' },
  { icon: ClipboardCheck, title: 'IT reviews it', text: 'Your request lands instantly in the IT team’s queue with a unique Ticket ID.' },
  { icon: UserCheck, title: 'Approval & issue', text: 'An authorized IT administrator verifies and issues the equipment.' },
  { icon: CheckCircle2, title: 'Track to completion', text: 'Use your Ticket ID and tracking code to follow every status update.' },
]

export default function Home() {
  const { settings } = useSettings()
  const { categories, items, loading } = useCatalog()
  const dl = useDownload()

  return (
    <div className="space-y-14">
      {/* Welcome */}
      <section className="glass-strong relative overflow-hidden p-6 sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-silver-300/50 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <span className="badge bg-primary-50 text-primary-700 ring-primary-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" /> IT Helpdesk is online
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Welcome to <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">{settings.site_name}</span>
            </h1>
            <p className="mt-2 text-lg font-semibold text-ink-soft">{settings.tagline}</p>
            <p className="mt-4 max-w-xl text-base text-ink-soft">
              Request IT equipment, report what you need and follow your ticket from submission to delivery - all in one secure place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/request/new" className="btn-primary px-6 py-3 text-base">
                <FilePlus2 className="h-5 w-5" /> Create New Request
              </Link>
              <Link to="/track" className="btn-secondary px-6 py-3 text-base">
                <Search className="h-5 w-5" /> Track My Request
              </Link>
            </div>
          </div>
          <div className="hidden lg:col-span-2 lg:block">
            <div className="relative mx-auto h-72 max-w-sm animate-float">
              <div className="absolute inset-0 rotate-3 rounded-3xl bg-gradient-to-br from-primary-300/60 to-primary-600/60 blur-sm" />
              <div className="glass-strong absolute inset-0 -rotate-2 space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">RP-{new Date().getFullYear()}-00001</span>
                  <span className="badge bg-amber-50 text-amber-700 ring-amber-200">Pending</span>
                </div>
                <div className="h-3 w-3/4 rounded-full bg-primary-100" />
                <div className="h-3 w-1/2 rounded-full bg-silver-200" />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl bg-primary-50 p-3 text-xs font-semibold text-primary-700">Laptop × 1</div>
                  <div className="rounded-xl bg-silver-100 p-3 text-xs font-semibold text-ink-soft">Mouse × 2</div>
                </div>
                <div className="flex items-center gap-2 pt-3 text-xs font-medium text-ink-soft">
                  <Send className="h-4 w-4 text-primary-500" /> Submitted just now
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop app */}
      {dl && (
        <section className="glass relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary-300/30 blur-3xl" />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white shadow-md shadow-primary-400/30">
                {dl.target === 'android' ? <Smartphone className="h-7 w-7" /> : <Monitor className="h-7 w-7" />}
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Get the {settings.site_name} {dl.target === 'android' ? 'Android' : 'desktop'} app</h2>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">
                  {dl.target === 'android'
                    ? 'Install the Android app on your phone for quick access to requests and tracking. After downloading, open the file and allow “Install unknown apps” if Android asks.'
                    : 'Install the Windows app for one-click access to requests and tracking. It updates itself automatically.'}
                </p>
              </div>
            </div>
            <a href={dl.url} download className="btn-primary px-6 py-3 text-base">
              <Download className="h-5 w-5" /> Download for {dl.label}
            </a>
          </div>
        </section>
      )}

      {/* Process */}
      <section aria-labelledby="process-h">
        <div className="mb-6 text-center">
          <h2 id="process-h" className="text-2xl font-extrabold sm:text-3xl">How IT support works</h2>
          <p className="mt-1 text-ink-soft">Four simple steps from request to resolution.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="glass glass-hover relative p-6">
              <span className="absolute right-5 top-4 text-4xl font-black text-primary-100">{i + 1}</span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white shadow-md shadow-primary-400/30">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="cat-h">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 id="cat-h" className="text-2xl font-extrabold sm:text-3xl">Available IT equipment</h2>
            <p className="mt-1 text-ink-soft">Browse what you can request. The catalog is always up to date.</p>
          </div>
          <Link to="/catalog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
            View full catalog <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
            : categories.map((c) => {
                const Icon = getIcon(c.icon)
                const count = items.filter((i) => i.category_id === c.id && !i.is_other).length
                return (
                  <Link key={c.id} to="/catalog" state={{ categoryId: c.id }} className="glass glass-hover group flex gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 transition group-hover:bg-gradient-to-br group-hover:from-primary-300 group-hover:to-primary-600 group-hover:text-white">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug">{c.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{c.description}</p>
                      <p className="mt-2 text-xs font-semibold text-primary-600">{count} item{count === 1 ? '' : 's'}</p>
                    </div>
                  </Link>
                )
              })}
        </div>
      </section>

      {/* SOPs + support */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="glass p-6 sm:p-8 lg:col-span-3">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">IT Standard Operating Procedures</h2>
              <p className="text-sm text-ink-soft">Know the rules before you raise a request.</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {settings.sops.slice(0, 6).map((s) => {
              const Icon = getIcon(s.icon)
              return (
                <li key={s.id}>
                  <Link to="/sops" className="flex items-center gap-3 rounded-xl border border-silver-200 bg-white/70 p-3 transition hover:border-primary-300 hover:bg-primary-50">
                    <Icon className="h-5 w-5 shrink-0 text-primary-500" />
                    <span className="text-sm font-semibold">
                      <span className="text-primary-600">{s.code}</span> · {s.title}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link to="/sops" className="btn-secondary mt-5">
            Open the SOP library <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-strong relative overflow-hidden p-6 sm:p-8 lg:col-span-2">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-300/40 blur-2xl" />
          <h2 className="relative text-xl font-extrabold">Need help?</h2>
          <p className="relative mt-1 text-sm text-ink-soft">Our IT support team is here to help.</p>
          <ul className="relative mt-5 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-primary-500" />
              <a href={`mailto:${settings.support_email}`} className="font-semibold hover:text-primary-700">{settings.support_email}</a>
            </li>
            {settings.support_phone && (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-primary-500" />
                <span className="font-semibold">{settings.support_phone}</span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-primary-500" />
              <span className="font-semibold">{settings.support_hours}</span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary-500" />
              <span className="font-semibold">{settings.support_location}</span>
            </li>
          </ul>
          <Link to="/about" className="btn-secondary relative mt-6">
            About IT Support
          </Link>
        </div>
      </section>
    </div>
  )
}
