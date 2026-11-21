import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CheckCircle2, Circle, Loader2, LockKeyhole, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { TrackResult, TicketStatus } from '../lib/types'
import { STATUS_META, cn, errMsg, formatDateTime } from '../lib/utils'
import { Field, PageHeader, PriorityBadge, StatusBadge } from '../components/ui'

interface Creds {
  ticket_no: string
  email: string
  code: string
}

const FLOW: TicketStatus[] = ['pending', 'in_progress', 'resolved']

export default function TrackRequest() {
  const { register, handleSubmit, formState } = useForm<Creds>({ defaultValues: { ticket_no: '', email: '', code: '' } })
  const { errors } = formState
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TrackResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const creds = useRef<Creds | null>(null)

  const lookup = useCallback(async (c: Creds, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase.rpc('track_ticket', { p_ticket_no: c.ticket_no, p_email: c.email, p_code: c.code })
      if (error) throw error
      const r = data as TrackResult
      if (r.ok) {
        setResult(r)
        setFailure(null)
        creds.current = c
      } else if (!silent) {
        setResult(null)
        setFailure(r.message ?? 'We could not verify those details.')
        creds.current = null
      }
    } catch (e) {
      if (!silent) {
        setResult(null)
        setFailure(errMsg(e))
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // keep the status fresh while the tracked ticket is on screen (credentials live only in memory)
  useEffect(() => {
    if (!result) return
    const t = setInterval(() => creds.current && void lookup(creds.current, true), 30000)
    return () => clearInterval(t)
  }, [result, lookup])

  const onSubmit = handleSubmit((v) => lookup({ ticket_no: v.ticket_no.trim(), email: v.email.trim(), code: v.code.trim() }))

  const t = result?.ticket
  const stepIndex = t ? FLOW.indexOf(t.status) : -1

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Track My Request" subtitle="Check the live status of your own request." />

      <form onSubmit={onSubmit} className="glass p-5 sm:p-7" noValidate>
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-primary-50/80 p-3 text-sm text-primary-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <p>For your privacy, enter the three details you received when you submitted: Ticket ID, the email you used and your private tracking code.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ticket ID" required htmlFor="ticket_no" error={errors.ticket_no?.message}>
            <input id="ticket_no" className={cn('input uppercase', errors.ticket_no && 'input-error')} placeholder="RP-2026-00001" autoComplete="off"
              {...register('ticket_no', { required: 'Enter your Ticket ID' })} />
          </Field>
          <Field label="Tracking Code" required htmlFor="code" error={errors.code?.message}>
            <input id="code" className={cn('input uppercase tracking-widest', errors.code && 'input-error')} placeholder="XXXX-XXXX" autoComplete="off"
              {...register('code', { required: 'Enter your tracking code' })} />
          </Field>
          <Field label="Email used in the request" required htmlFor="email" error={errors.email?.message} className="sm:col-span-2">
            <input id="email" type="email" className={cn('input', errors.email && 'input-error')} placeholder="you@company.com"
              {...register('email', { required: 'Enter your email', pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Enter a valid email' } })} />
          </Field>
        </div>
        {failure && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {failure}
          </div>
        )}
        <button type="submit" className="btn-primary mt-5 w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Checking…' : 'Track request'}
        </button>
      </form>

      {t && result && (
        <div className="mt-8 space-y-5 animate-fade-up">
          <div className="glass-strong p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary-700">Ticket</div>
                <div className="text-2xl font-black tracking-wide">{t.ticket_no}</div>
                <div className="mt-1 text-sm text-ink-soft">Submitted {formatDateTime(t.created_at)}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
              </div>
            </div>

            {t.status === 'cancelled' ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <XCircle className="h-5 w-5 shrink-0 text-slate-500" /> This request was cancelled on {formatDateTime(t.status_updated_at)}.
              </div>
            ) : (
              <ol className="mt-7 grid grid-cols-3 gap-2" aria-label="Progress">
                {FLOW.map((s, i) => {
                  const done = i <= stepIndex
                  return (
                    <li key={s} className="flex flex-col items-center text-center">
                      <div className="relative flex w-full items-center justify-center">
                        <div className={cn('absolute left-0 right-1/2 top-1/2 h-1 -translate-y-1/2', i === 0 ? 'hidden' : i <= stepIndex ? 'bg-primary-400' : 'bg-silver-200')} />
                        <div className={cn('absolute left-1/2 right-0 top-1/2 h-1 -translate-y-1/2', i === FLOW.length - 1 ? 'hidden' : i < stepIndex ? 'bg-primary-400' : 'bg-silver-200')} />
                        <div className={cn('relative flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-gradient-to-br from-primary-300 to-primary-600 text-white' : 'bg-silver-200 text-silver-400')}>
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </div>
                      </div>
                      <span className={cn('mt-2 text-xs font-bold', done ? 'text-ink' : 'text-ink-faint')}>{STATUS_META[s].label}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            <dl className="mt-7 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-ink-soft">Requested by</dt><dd className="font-semibold">{t.full_name}</dd></div>
              <div><dt className="font-semibold text-ink-soft">Department</dt><dd className="font-semibold">{t.department_name}</dd></div>
              <div><dt className="font-semibold text-ink-soft">Last updated</dt><dd className="font-semibold">{formatDateTime(t.status_updated_at)}</dd></div>
              <div><dt className="font-semibold text-ink-soft">Assigned IT staff</dt><dd className="font-semibold">{t.assigned_to || 'Not assigned yet'}</dd></div>
            </dl>

            {t.resolution_notes && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <div className="mb-1 flex items-center gap-2 font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" /> Message from IT</div>
                <p className="whitespace-pre-wrap text-emerald-900">{t.resolution_notes}</p>
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="glass p-5">
              <h2 className="mb-3 font-bold">Requested equipment</h2>
              <ul className="divide-y divide-silver-200/70 text-sm">
                {(result.items ?? []).map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{i.item_name}</span>
                      {i.category_name && <span className="block text-xs text-ink-soft">{i.category_name}</span>}
                    </span>
                    <span className="font-semibold text-ink-soft">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Activity</h2>
                <button className="icon-btn h-8 w-8" aria-label="Refresh status" onClick={() => creds.current && void lookup(creds.current)}>
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <ol className="relative space-y-4 border-l-2 border-primary-100 pl-5">
                {[...(result.history ?? [])].reverse().map((h, idx) => (
                  <li key={idx} className="relative">
                    <span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full bg-primary-400 ring-4 ring-white" />
                    <div className="text-sm font-semibold">{h.message}</div>
                    <div className="text-xs text-ink-soft">{formatDateTime(h.created_at)}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
