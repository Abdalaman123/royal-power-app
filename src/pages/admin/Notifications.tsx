import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertOctagon, Bell, BellRing, CheckCheck, RefreshCw, Trash2, Ticket, XCircle, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useRealtime } from '../../lib/hooks'
import type { NotificationRow } from '../../lib/types'
import { cn, errMsg, formatDateTime, timeAgo } from '../../lib/utils'
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, TableSkeleton } from '../../components/ui'
import TicketDetailModal from '../../components/TicketDetailModal'

const TYPE_META: Record<NotificationRow['type'], { icon: LucideIcon; tone: string; label: string }> = {
  new_ticket: { icon: Ticket, tone: 'from-sky-400 to-blue-600', label: 'New ticket' },
  critical_ticket: { icon: AlertOctagon, tone: 'from-rose-400 to-red-600', label: 'Critical' },
  ticket_updated: { icon: BellRing, tone: 'from-cyan-400 to-sky-600', label: 'Updated' },
  ticket_cancelled: { icon: XCircle, tone: 'from-slate-400 to-slate-600', label: 'Cancelled' },
}

type Filter = 'all' | 'unread'

export default function Notifications() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openTicket, setOpenTicket] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (err) setError(errMsg(err))
    else {
      setRows((data ?? []) as NotificationRow[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime(['notifications'], load)

  const unread = rows.filter((r) => !r.is_read).length
  const shown = filter === 'unread' ? rows.filter((r) => !r.is_read) : rows

  const markRead = async (ids: string[]) => {
    if (!ids.length) return
    const { error: err } = await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    if (err) toast.error(errMsg(err))
    else setRows((r) => r.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)))
  }

  const markAll = async () => {
    await markRead(rows.filter((r) => !r.is_read).map((r) => r.id))
    toast.success('All notifications marked as read')
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('notifications').delete().eq('id', id)
    if (err) toast.error(errMsg(err))
    else setRows((r) => r.filter((n) => n.id !== id))
  }

  const clearAll = async () => {
    setBusy(true)
    const { error: err } = await supabase.from('notifications').delete().in('id', rows.map((r) => r.id))
    setBusy(false)
    if (err) return void toast.error(errMsg(err))
    setRows([])
    setConfirmClear(false)
    toast.success('Notifications cleared')
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up.'}
        actions={
          <>
            <button className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</button>
            <button className="btn-secondary" disabled={!unread} onClick={() => void markAll()}><CheckCheck className="h-4 w-4" /> Mark all read</button>
            <button className="btn-danger" disabled={!rows.length} onClick={() => setConfirmClear(true)}><Trash2 className="h-4 w-4" /> Clear all</button>
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-silver-200 bg-white/70 p-1" role="tablist" aria-label="Filter notifications">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition', filter === f ? 'bg-primary-500 text-white shadow' : 'text-ink-soft hover:text-ink')}
          >
            {f}{f === 'unread' && unread > 0 ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton rows={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} message="New tickets, critical requests, updates and cancellations show up here instantly." />
        ) : (
          <ul className="divide-y divide-silver-200/70">
            {shown.map((n) => {
              const m = TYPE_META[n.type] ?? TYPE_META.ticket_updated
              return (
                <li key={n.id} className={cn('flex items-start gap-4 px-5 py-4 transition hover:bg-primary-50/40', !n.is_read && 'bg-primary-50/60')}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${m.tone} text-white shadow-md`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      void markRead([n.id])
                      if (n.ticket_id) setOpenTicket(n.ticket_id)
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{n.title}</span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary-500" aria-label="Unread" />}
                      <span className="badge bg-white/70 text-ink-soft ring-silver-200">{m.label}</span>
                    </div>
                    {n.message && <p className="mt-0.5 text-sm text-ink-soft">{n.message}</p>}
                    <p className="mt-1 text-xs text-ink-faint" title={formatDateTime(n.created_at)}>{timeAgo(n.created_at)}</p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {!n.is_read && (
                      <button className="icon-btn" onClick={() => void markRead([n.id])} aria-label="Mark as read"><CheckCheck className="h-[18px] w-[18px]" /></button>
                    )}
                    <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" onClick={() => void remove(n.id)} aria-label="Delete notification"><Trash2 className="h-[18px] w-[18px]" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <TicketDetailModal ticketId={openTicket} onClose={() => setOpenTicket(null)} onChanged={load} />

      <ConfirmDialog
        open={confirmClear}
        danger
        loading={busy}
        title="Clear all notifications?"
        confirmLabel="Clear all"
        message="This removes every notification in your inbox. Tickets and their history are not affected."
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void clearAll()}
      />
    </div>
  )
}
