import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, ArrowRight, CheckCircle2, Clock, Loader2, Ticket, Ticket as TicketIcon, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useRealtime } from '../../lib/hooks'
import type { Analytics, TicketRow } from '../../lib/types'
import { errMsg, formatDateTime, timeAgo } from '../../lib/utils'
import { EmptyState, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from '../../components/ui'
import { DepartmentBar, MonthlyTrend, StatusDonut, TopItemsBar } from '../../components/charts'
import TicketDetailModal from '../../components/TicketDetailModal'

const CARDS = [
  { key: 'total', label: 'Total Tickets', icon: Ticket, gradient: 'from-sky-400 to-blue-600', to: '/admin/tickets' },
  { key: 'pending', label: 'Pending', icon: Clock, gradient: 'from-amber-400 to-orange-500', to: '/admin/tickets/pending' },
  { key: 'in_progress', label: 'In Progress', icon: Loader2, gradient: 'from-cyan-400 to-sky-600', to: '/admin/tickets/in-progress' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2, gradient: 'from-emerald-400 to-green-600', to: '/admin/tickets/resolved' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, gradient: 'from-slate-400 to-slate-600', to: '/admin/tickets/cancelled' },
  { key: 'critical', label: 'Critical Priority', icon: AlertOctagon, gradient: 'from-rose-400 to-red-600', to: '/admin/tickets?priority=critical' },
] as const

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null)
  const [recent, setRecent] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        supabase.rpc('admin_analytics'),
        supabase.from('tickets').select('*, ticket_items(item_name, quantity)').order('created_at', { ascending: false }).limit(6),
      ])
      if (a.error) throw a.error
      if (r.error) throw r.error
      setData(a.data as Analytics)
      setRecent((r.data ?? []) as TicketRow[])
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime(['tickets', 'ticket_items'], load)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of all IT support activity." />

      {error ? (
        <div className="glass"><ErrorState message={error} onRetry={load} /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {CARDS.map((c) => (
              <Link key={c.key} to={c.to} className="glass glass-hover group relative overflow-hidden p-5">
                <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${c.gradient} opacity-15 transition group-hover:scale-125`} />
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.gradient} text-white shadow-md`}>
                  <c.icon className="h-5 w-5" />
                </div>
                {loading || !data ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="text-3xl font-extrabold tracking-tight">{data.totals[c.key]}</div>
                )}
                <div className="mt-0.5 text-sm font-semibold text-ink-soft">{c.label}</div>
              </Link>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {loading || !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96" />)
            ) : (
              <>
                <StatusDonut data={data.by_status} />
                <DepartmentBar data={data.by_department} />
                <TopItemsBar data={data.top_items} />
                <MonthlyTrend data={data.monthly} />
              </>
            )}
          </div>

          <div className="glass mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-silver-200/70 px-5 py-4">
              <h2 className="font-bold">Recent tickets</h2>
              <Link to="/admin/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : recent.length === 0 ? (
              <EmptyState icon={TicketIcon} title="No tickets yet" message="New requests from the user portal will appear here instantly." />
            ) : (
              <ul className="divide-y divide-silver-200/70">
                {recent.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setOpenId(t.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition hover:bg-primary-50/60">
                      <span className="w-32 text-sm font-bold text-primary-700">{t.ticket_no}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <b>{t.full_name}</b> <span className="text-ink-soft">· {t.department_name}</span>
                      </span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <span className="w-24 text-right text-xs text-ink-soft" title={formatDateTime(t.created_at)}>{timeAgo(t.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <TicketDetailModal ticketId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  )
}
