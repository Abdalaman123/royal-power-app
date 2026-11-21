import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Download, Eye, Filter, RotateCcw, Search, Ticket } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCatalog, useRealtime } from '../../lib/hooks'
import type { Priority, TicketRow, TicketStatus } from '../../lib/types'
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, downloadFile, errMsg, formatDate, sanitizeSearch, toCSV } from '../../lib/utils'
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, PriorityBadge, StatusBadge, TableSkeleton } from '../../components/ui'
import TicketDetailModal from '../../components/TicketDetailModal'

interface Filters {
  q: string
  department: string
  priority: '' | Priority
  status: '' | TicketStatus
  from: string
  to: string
}

const EMPTY: Filters = { q: '', department: '', priority: '', status: '', from: '', to: '' }

function buildQuery(f: Filters, fixedStatus?: TicketStatus) {
  let q = supabase.from('tickets').select('*, ticket_items(item_name, quantity)', { count: 'exact' })
  const st = fixedStatus ?? (f.status || undefined)
  if (st) q = q.eq('status', st)
  if (f.department) q = q.eq('department_id', f.department)
  if (f.priority) q = q.eq('priority', f.priority)
  if (f.from) q = q.gte('created_at', new Date(`${f.from}T00:00:00`).toISOString())
  if (f.to) q = q.lt('created_at', new Date(new Date(`${f.to}T00:00:00`).getTime() + 86_400_000).toISOString())
  const s = sanitizeSearch(f.q)
  if (s) q = q.or(`ticket_no.ilike.%${s}%,full_name.ilike.%${s}%,employee_id.ilike.%${s}%`)
  return q.order('created_at', { ascending: false })
}

const equipmentLabel = (t: TicketRow) => (t.ticket_items ?? []).map((i) => `${i.item_name} ×${i.quantity}`).join(', ')
const totalQty = (t: TicketRow) => (t.ticket_items ?? []).reduce((n, i) => n + i.quantity, 0)

export default function TicketsPage({ fixedStatus, title, subtitle }: { fixedStatus?: TicketStatus; title: string; subtitle?: string }) {
  const [params, setParams] = useSearchParams()
  const { departments } = useCatalog(true)

  const [filters, setFilters] = useState<Filters>({ ...EMPTY, priority: (params.get('priority') as Priority) || '' })
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<TicketRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(params.get('open'))
  const [cancelTarget, setCancelTarget] = useState<TicketRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const reqId = useRef(0)

  // default page size from the admin setting
  useEffect(() => {
    void supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'tickets_per_page')
      .maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value)
        if (n && [10, 25, 50, 100].includes(n)) setPageSize(n)
      })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300)
    return () => clearTimeout(t)
  }, [filters.q])

  const effective = useMemo(() => ({ ...filters, q: debouncedQ }), [filters, debouncedQ])

  const load = useCallback(async () => {
    const id = ++reqId.current
    try {
      const from = (page - 1) * pageSize
      const { data, count, error: err } = await buildQuery(effective, fixedStatus).range(from, from + pageSize - 1)
      if (id !== reqId.current) return
      if (err) throw err
      setRows((data ?? []) as TicketRow[])
      setTotal(count ?? 0)
      setError(null)
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [effective, fixedStatus, page, pageSize])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])
  useRealtime(['tickets', 'ticket_items'], load)

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setPage(1)
  }

  const reset = () => {
    setFilters(EMPTY)
    setDebouncedQ('')
    setPage(1)
  }

  const closeModal = () => {
    setOpenId(null)
    if (params.has('open')) {
      const next = new URLSearchParams(params)
      next.delete('open')
      setParams(next, { replace: true })
    }
  }

  const changeStatus = async (t: TicketRow, status: TicketStatus) => {
    if (status === t.status) return
    setBusyId(t.id)
    try {
      const { data, error: err } = await supabase.from('tickets').update({ status }).eq('id', t.id).select('id')
      if (err) throw err
      if (!data?.length) throw new Error('The update was not applied')
      toast.success(`${t.ticket_no} marked as ${STATUS_META[status].label}`)
      await load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusyId(null)
      setCancelTarget(null)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { data, error: err } = await buildQuery(effective, fixedStatus).limit(5000)
      if (err) throw err
      const list = (data ?? []) as TicketRow[]
      if (list.length === 0) {
        toast('Nothing to export for the current filters')
        return
      }
      const header = ['Ticket ID', 'Employee Name', 'Employee ID', 'Email', 'Department', 'Designation', 'Branch', 'Equipment Requested', 'Quantity', 'Priority', 'Status', 'Submitted', 'Status Updated', 'Assigned To', 'Admin Remarks', 'Resolution Notes']
      const body = list.map((t) => [
        t.ticket_no, t.full_name, t.employee_id, t.email, t.department_name, t.designation, t.branch,
        equipmentLabel(t), totalQty(t), PRIORITY_META[t.priority].label, STATUS_META[t.status].label,
        new Date(t.created_at).toLocaleString(), new Date(t.status_updated_at).toLocaleString(),
        t.assigned_to, t.admin_remarks, t.resolution_notes,
      ])
      downloadFile(`royal-power-tickets-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([header, ...body]))
      toast.success(`Exported ${list.length} ticket${list.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = Object.entries(filters).some(([, v]) => v !== '')

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button className="btn-secondary" onClick={exportCsv} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      {/* filters */}
      <div className="glass mb-5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-soft"><Filter className="h-4 w-4" /> Search & filters</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input className="input pl-10" placeholder="Search Ticket ID or employee name…" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Search by ticket ID or employee name" />
          </div>
          <select className="input" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value as Filters['priority'])} aria-label="Filter by priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          {!fixedStatus && (
            <select className="input" value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-semibold text-ink-soft">From
              <input type="date" className="input mt-1" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-ink-soft">To
              <input type="date" className="input mt-1" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
            </label>
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button className="btn-ghost" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</button>
            </div>
          )}
        </div>
      </div>

      <div className="glass overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Ticket} title="No tickets found" message={hasFilters ? 'No ticket matches your filters.' : 'Tickets submitted from the user portal will show up here.'}
            action={hasFilters ? <button className="btn-secondary" onClick={reset}>Clear filters</button> : undefined} />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1000px]">
                <thead className="border-b border-silver-200/70 bg-primary-50/50">
                  <tr>
                    <th className="th">Ticket ID</th><th className="th">Employee</th><th className="th">Emp. ID</th><th className="th">Department</th>
                    <th className="th">Equipment</th><th className="th text-right">Qty</th><th className="th">Priority</th><th className="th">Submitted</th>
                    <th className="th">Status</th><th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver-200/60">
                  {rows.map((t) => (
                    <tr key={t.id} className="transition hover:bg-primary-50/40">
                      <td className="td whitespace-nowrap font-bold text-primary-700">{t.ticket_no}</td>
                      <td className="td font-semibold">{t.full_name}</td>
                      <td className="td text-ink-soft">{t.employee_id}</td>
                      <td className="td">{t.department_name}</td>
                      <td className="td max-w-[220px] truncate" title={equipmentLabel(t)}>{equipmentLabel(t) || '—'}</td>
                      <td className="td text-right font-semibold">{totalQty(t)}</td>
                      <td className="td"><PriorityBadge priority={t.priority} /></td>
                      <td className="td whitespace-nowrap text-ink-soft">{formatDate(t.created_at)}</td>
                      <td className="td"><StatusBadge status={t.status} /></td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            className="input !w-auto !py-1.5 text-xs"
                            value={t.status}
                            disabled={busyId === t.id}
                            aria-label={`Update status of ${t.ticket_no}`}
                            onChange={(e) => {
                              const s = e.target.value as TicketStatus
                              if (s === 'cancelled') setCancelTarget(t)
                              else void changeStatus(t, s)
                            }}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </select>
                          <button className="icon-btn" onClick={() => setOpenId(t.id)} aria-label={`View ${t.ticket_no}`} title="View details"><Eye className="h-[18px] w-[18px]" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="divide-y divide-silver-200/60 md:hidden">
              {rows.map((t) => (
                <li key={t.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-primary-700">{t.ticket_no}</div>
                      <div className="text-sm font-semibold">{t.full_name} <span className="font-normal text-ink-soft">· {t.employee_id}</span></div>
                      <div className="text-xs text-ink-soft">{t.department_name} · {formatDate(t.created_at)}</div>
                    </div>
                    <button className="icon-btn" onClick={() => setOpenId(t.id)} aria-label={`View ${t.ticket_no}`}><Eye className="h-5 w-5" /></button>
                  </div>
                  <div className="text-sm">{equipmentLabel(t)}</div>
                  <div className="flex flex-wrap items-center gap-2"><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></div>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
          </>
        )}
      </div>

      <TicketDetailModal ticketId={openId} onClose={closeModal} onChanged={load} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        danger
        loading={Boolean(busyId)}
        title="Cancel this ticket?"
        confirmLabel="Yes, cancel ticket"
        message={<>Ticket <b>{cancelTarget?.ticket_no}</b> from <b>{cancelTarget?.full_name}</b> will be marked as Cancelled and logged in the audit trail.</>}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && void changeStatus(cancelTarget, 'cancelled')}
      />
    </div>
  )
}
