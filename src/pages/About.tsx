import { Link } from 'react-router-dom'
import { Clock, Headphones, Mail, MapPin, Phone, ShieldCheck, Wrench, Zap } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { PageHeader } from '../components/ui'

const SERVICES = [
  { icon: Wrench, title: 'Hardware & peripherals', text: 'Issue, repair and replacement of computers, displays, printers and accessories.' },
  { icon: Zap, title: 'Network & power', text: 'Cabling, switches, access points, UPS and electrical accessories for IT equipment.' },
  { icon: ShieldCheck, title: 'Asset management', text: 'Every issued asset is documented and tracked so nothing gets lost.' },
  { icon: Headphones, title: 'Helpdesk support', text: 'A single point of contact for all IT equipment and support requests.' },
]

const FAQ = [
  { q: 'How long does a request take?', a: 'Critical requests are reviewed first. Everything else is handled in priority order; you can follow progress any time using Track My Request.' },
  { q: 'Who approves my request?', a: 'Requests are approved by the authorized IT administrator and equipment is issued only after verification (see SOP 01).' },
  { q: 'I lost my tracking code. What now?', a: 'The tracking code is shown once, at submission. Contact the IT helpdesk with your Ticket ID and employee ID and they will assist you.' },
  { q: 'Can I request something that is not in the catalog?', a: 'Yes. Choose “Other (specify)” in the equipment list and describe what you need.' },
]

export default function About() {
  const { settings } = useSettings()
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader title="About IT Support" subtitle={`How the ${settings.site_name} IT team helps you every day.`} />

      <div className="grid gap-5 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <div key={s.title} className="glass glass-hover flex gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white">
              <s.icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="glass-strong p-6 sm:p-8">
        <h2 className="text-xl font-extrabold">Contact the IT team</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-primary-500" /><div><div className="text-xs font-bold uppercase text-ink-soft">Email</div><a className="text-sm font-semibold hover:text-primary-700" href={`mailto:${settings.support_email}`}>{settings.support_email}</a></div></div>
          {settings.support_phone && <div className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-primary-500" /><div><div className="text-xs font-bold uppercase text-ink-soft">Phone</div><div className="text-sm font-semibold">{settings.support_phone}</div></div></div>}
          <div className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 text-primary-500" /><div><div className="text-xs font-bold uppercase text-ink-soft">Hours</div><div className="text-sm font-semibold">{settings.support_hours}</div></div></div>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-primary-500" /><div><div className="text-xs font-bold uppercase text-ink-soft">Location</div><div className="text-sm font-semibold">{settings.support_location}</div></div></div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-extrabold">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="glass group p-5 open:shadow-lift">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">{f.q}</summary>
              <p className="mt-2 text-sm text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="text-center">
        <Link to="/request/new" className="btn-primary px-8 py-3 text-base">Create New Request</Link>
      </div>
    </div>
  )
}
