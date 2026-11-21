import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, FileText, History, Loader2, Mail, MapPin, Paperclip, Save, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../lib/hooks'
import type { ActivityLog, Ticket, TicketItem, TicketStatus } from '../lib/types'
import { STATUSES, STATUS_META, cn, errMsg, formatBytes, formatDateTime } from '../lib/utils'
import { ConfirmDialog, Modal, PriorityBadge, Skeleton, StatusBadge } from './ui'

interface Props {
  ticketId: string | null
  onClose: () => void
  onChanged?: () => void
}

export default function TicketDetailModal({ ticketId, onClose, onChanged }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [items, setItems] = useState<TicketItem[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [staff, setStaff] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const [status, setStatus] = useState<TicketStatus>('pending')
  const [assigned, setAssigned] = useState('')
  const [remarks, setRemarks] = useState('')
  const [resolution, setResolution] = useState('')

  const load = useCallback(
    async (resetForm: boolean) => {
      if (!ticketId) return
      const [t, i, l, s] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle(),
        supabase.from('ticket_items').select('*').eq('ticket_id', ticketId).order('created_at'),
        supabase.from('ticket_activity_logs').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('full_name,email').eq('role', 'admin'),
      ])
      if (t.error || !t.data) {
        toast.error(t.error ? errMsg(t.error) : 'Ticket not found')
        setLoading(false)
        return
      }
      const row = t.data as Ticket
      setTicket(row)
      setItems((i.data ?? []) as TicketItem[])
      setLogs((l.data ?? []) as ActivityLog[])
      setStaff(((s.data ?? []) as { full_name: string | null; email: string | null }[]).map((p) => p.full_name || p.email || '').filter(Boolean))
      if (resetForm) {
        setStatus(row.status)
        setAssigned(row.assigned_to ?? '')
        setRemarks(row.admin_remarks ?? '')
        setResolution(row.resolution_notes ?? '')
      }
      setLoading(false)
    },
    [ticketId],
  )

  useEffect(() => {
    if (!ticketId) {
      setTicket(null)
      return
    }
    setLoading(true)
    setTicket(null)
    void load(true)
  }, [ticketId, load])

  // keep history / metadata live without clobbering what the admin is typing
  useRealtime(['tickets', 'ticket_activity_logs'], () => {
    if (ticketId) void load(false)
  })

  const dirty =
    !!ticket &&
    (status !== ticket.status ||
      assigned.trim() !== (ticket.assigned_to ?? '') ||
      remarks.trim() !== (ticket.admin_remarks ?? '') ||
      resolution.trim() !== (ticket.resolution_notes ?? ''))

  const save = async () => {
    if (!ticket) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update({
          status,
          assigned_to: assigned.trim() || null,
          admin_remarks: remarks.trim() || null,
          resolution_notes: resolution.trim() || null,
        })
        .eq('id', ticket.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('The update was not applied. Check that you are still signed in as an administrator.')
      toast.success(status !== ticket.status ? `Ticket marked as ${STATUS_META[status].label}` : 'Ticket updated')
      setConfirmCancel(false)
      await load(true)
      onChanged?.()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const onSave = () => {
    if (ticket && status === 'cancelled' && ticket.status !== 'cancelled') setConfirmCancel(true)
    else void save()
  }

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from('ticket-attachments').createSignedUrl(path, 120)
    if (error || !data) {
      toast.error(error ? errMsg(error) : 'Could not open the file')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <Modal
        open={Boolean(ticketId)}
        onClose={onClose}
        size="xl"
        title={ticket ? `Ticket ${ticket.ticket_no}` : 'Ticket details'}
        footer={
          ticket && (
            <>
              <button className="btn-secondary" onClick={onClose}>Close</button>
              <button className="btn-primary" onClick={onSave} disabled={!dirty || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </button>
            </>
          )
        }
      >
        {loading || !ticket ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <Skeleton className="h-80 lg:col-span-3" />
            <Skeleton className="h-80 lg:col-span-2" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* ---------- left: request details ---------- */}
            <div className="space-y-5 lg:col-span-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-ink-soft">Submitted {formatDateTime(ticket.created_at)}</span>
              </div>

              <div className="grid gap-3 rounded-2xl border border-silver-200 bg-white/60 p-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2"><User className="mt-0.5 h-4 w-4 text-primary-500" /><div><div className="font-bold">{ticket.full_name}</div><div className="text-xs text-ink-soft">{ticket.designation}</div></div></div>
                <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-primary-500" /><div><div className="text-xs text-ink-soft">Employee ID</div><div className="font-semibold">{ticket.employee_id}</div></div></div>
                <div className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-primary-500" /><a className="break-all font-semibold hover:text-primary-700" href={`mailto:${ticket.email}`}>{ticket.email}</a></div>
                <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 text-primary-500" /><span className="font-semibold">{ticket.department_name}</span></div>
                <div className="flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 h-4 w-4 text-primary-500" /><span className="font-semibold">{ticket.branch}</span></div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold">Equipment requested</h3>
                <div className="overflow-hidden rounded-2xl border border-silver-200 bg-white/60">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-50/60"><tr><th className="th">Item</th><th className="th">Category</th><th className="th text-right">Qty</th></tr></thead>
                    <tbody className="divide-y divide-silver-200/70">
                      {items.map((i) => (
                        <tr key={i.id}>
                          <td className="td font-semibold">{i.item_name}{i.is_custom && <span className="badge ml-2 bg-violet-50 text-violet-700 ring-violet-200">Custom</span>}</td>
                          <td className="td text-ink-soft">{i.category_name ?? '—'}</td>
                          <td className="td text-right font-semibold">{i.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-sm font-bold">Reason / description</h3>
                <p className="whitespace-pre-wrap rounded-2xl border border-silver-200 bg-white/60 p-4 text-sm">{ticket.reason}</p>
              </div>
              {ticket.notes && (
                <div>
                  <h3 className="mb-1 text-sm font-bold">Additional notes</h3>
                  <p className="whitespace-pre-wrap rounded-2xl border border-silver-200 bg-white/60 p-4 text-sm">{ticket.notes}</p>
                </div>
              )}
              {ticket.attachments?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold">Attachments</h3>
                  <ul className="space-y-2">
                    {ticket.attachments.map((a) => (
                      <li key={a.path}>
                        <button onClick={() => openAttachment(a.path)} className="flex w-full items-center gap-3 rounded-xl border border-silver-200 bg-white/70 px-3 py-2 text-left text-sm transition hover:border-primary-300 hover:bg-primary-50">
                          <Paperclip className="h-4 w-4 text-primary-500" />
                          <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                          <span className="text-xs text-ink-soft">{formatBytes(a.size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ---------- right: management ---------- */}
            <div className="space-y-5 lg:col-span-2">
              <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4">
                <h3 className="mb-3 text-sm font-bold">Update status</h3>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ticket status">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={status === s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition',
                        status === s ? 'border-primary-400 bg-white shadow-md ring-4 ring-primary-100' : 'border-silver-200 bg-white/70 hover:border-primary-300',
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} /> {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-soft">Last status update: {formatDateTime(ticket.status_updated_at)}</p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="label" htmlFor="assigned">Assigned IT staff</label>
                    <input id="assigned" list="staff-list" className="input" value={assigned} onChange={(e) => setAssigned(e.target.value)} placeholder="Name of the technician" maxLength={120} />
                    <datalist id="staff-list">{staff.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div>
                    <label className="label" htmlFor="remarks">Admin remarks <span className="font-normal text-ink-faint">(internal)</span></label>
                    <textarea id="remarks" rows={3} className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={4000} />
                  </div>
                  <div>
                    <label className="label" htmlFor="resolution">Resolution notes <span className="font-normal text-ink-faint">(visible to requester)</span></label>
                    <textarea id="resolution" rows={3} className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={4000} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-primary-500" /> Activity history</h3>
                <ol className="relative space-y-4 border-l-2 border-primary-100 pl-5">
                  {logs.map((l) => (
                    <li key={l.id} className="relative">
                      <span className={cn('absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full ring-4 ring-white', l.is_public ? 'bg-primary-400' : 'bg-silver-400')} />
                      <div className="text-sm font-semibold">{l.message}</div>
                      <div className="text-xs text-ink-soft">
                        {l.actor_name ?? 'System'} · {formatDateTime(l.created_at)}
                        {!l.is_public && <span className="ml-1 rounded bg-silver-100 px-1.5 py-0.5 text-[10px] font-bold uppercase">internal</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmCancel}
        danger
        loading={saving}
        title="Cancel this ticket?"
        confirmLabel="Yes, cancel ticket"
        message={<>Ticket <b>{ticket?.ticket_no}</b> will be marked as <b>Cancelled</b>. The change is recorded in the audit log and the requester will see it when tracking.</>}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => void save()}
      />
    </>
  )
}
