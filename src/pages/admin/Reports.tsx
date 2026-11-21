import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, Timer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useRealtime } from '../../lib/hooks'
import type { Analytics, TicketRow } from '../../lib/types'
import { PRIORITY_META, STATUS_META, downloadFile, errMsg, toCSV } from '../../lib/utils'
import { ErrorState, Field, PageHeader, Skeleton } from '../../components/ui'
import { DepartmentBar, MonthlyTrend, PriorityBar, StatusDonut, TopItemsBar } from '../../components/charts'

const startOfDayISO = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const endOfDayISO = (d: string) => new Date(`${d}T23:59:59.999`).toISOString()

export default function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    const { data: res, error: err } = await supabase.rpc('admin_analytics', {
      p_from: from ? startOfDayISO(from) : null,
      p_to: to ? endOfDayISO(to) : null,
    })
    if (err) setError(errMsg(err))
    else {
      setData(res as Analytics)
      setError(null)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])
  useRealtime(['tickets', 'ticket_items'], load)

  const exportTickets = async () => {
    setExporting(true)
    try {
      let q = supabase.from('tickets').select('*, ticket_items(item_name, quantity)').order('created_at', { ascending: false }).limit(5000)
      if (from) q = q.gte('created_at', startOfDayISO(from))
      if (to) q = q.lte('created_at', endOfDayISO(to))
      const { data: rows, error: err } = await q
      if (err) throw err
      const list = (rows ?? []) as TicketRow[]
      const csv = toCSV([
        ['Ticket ID', 'Employee', 'Employee ID', 'Email', 'Department', 'Designation', 'Branch', 'Equipment', 'Priority', 'Status', 'Assigned To', 'Submitted', 'Last status update', 'Resolved at'],
        ...list.map((t) => [
          t.ticket_no, t.full_name, t.employee_id, t.email, t.department_name, t.designation, t.branch,
          t.ticket_items.map((i) => `${i.item_name} x${i.quantity}`).join('; '),
          PRIORITY_META[t.priority].label, STATUS_META[t.status].label, t.assigned_to,
          t.created_at, t.status_updated_at, t.resolved_at,
        ]),
      ])
      downloadFile(`royal-power-report-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      toast.success(`Exported ${list.length} tickets`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setExporting(false)
    }
  }

  const exportSummary = () => {
    if (!data) return
    const rows: (string | number)[][] = [['Section', 'Label', 'Value']]
    Object.entries(data.totals).forEach(([k, v]) => rows.push(['Totals', k, v]))
    data.by_department.forEach((d) => rows.push(['By department', d.name, d.count]))
    data.top_items.forEach((d) => rows.push(['Top equipment (requests)', d.name, d.requests]))
    data.monthly.forEach((m) => rows.push(['Monthly submitted', m.month, m.total]))
    downloadFile(`royal-power-summary-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))
  }

  const rate = data && data.totals.total > 0 ? Math.round((data.totals.resolved / data.totals.total) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Computed live from ticket records."
        actions={
          <>
            <button className="btn-secondary" onClick={exportSummary} disabled={!data}><FileSpreadsheet className="h-4 w-4" /> Summary CSV</button>
            <button className="btn-primary" onClick={() => void exportTickets()} disabled={exporting}><Download className="h-4 w-4" /> Export tickets CSV</button>
          </>
        }
      />

      <div className="glass mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="From" htmlFor="r-from"><input id="r-from" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To" htmlFor="r-to"><input id="r-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
        {(from || to) && <button className="btn-ghost" onClick={() => { setFrom(''); setTo('') }}>Clear range</button>}
      </div>

      {error ? (
        <div className="glass"><ErrorState message={error} onRetry={load} /></div>
      ) : loading || !data ? (
        <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Kpi label="Tickets in range" value={String(data.totals.total)} />
            <Kpi label="Resolution rate" value={`${rate}%`} />
            <Kpi label="Avg. time to resolve" value={data.avg_resolution_hours == null ? '—' : data.avg_resolution_hours < 48 ? `${data.avg_resolution_hours.toFixed(1)} h` : `${(data.avg_resolution_hours / 24).toFixed(1)} days`} icon />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <StatusDonut data={data.by_status} />
            <PriorityBar data={data.by_priority} />
            <DepartmentBar data={data.by_department} />
            <TopItemsBar data={data.top_items} />
            <div className="lg:col-span-2"><MonthlyTrend data={data.monthly} /></div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">{icon && <Timer className="h-4 w-4 text-primary-500" />}{label}</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight">{value}</div>
    </div>
  )
}
