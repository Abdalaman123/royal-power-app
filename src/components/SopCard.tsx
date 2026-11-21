import { useId, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import type { Sop } from '../lib/types'
import { getIcon } from '../lib/icons'
import { cn } from '../lib/utils'

export default function SopCard({ sop, defaultOpen = false }: { sop: Sop; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const Icon = getIcon(sop.icon)

  return (
    <div className={cn('glass overflow-hidden transition duration-300', open && 'shadow-lift')}>
      <button
        type="button"
        className="flex w-full items-center gap-4 p-5 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white shadow-md shadow-primary-400/30">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-primary-600">{sop.code}</div>
          <h3 className="text-base font-bold leading-snug sm:text-lg">{sop.title}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{sop.summary}</p>
        </div>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-soft transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-silver-200/70 bg-white/50 px-5 py-4">
        <ul className="space-y-2.5">
          {sop.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
