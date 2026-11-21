import { Fragment, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, ChevronDown, FileSpreadsheet, PackageCheck, PackageOpen, PackageX, Search, UserPlus, Undo2, Warehouse } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { buildLines, inventorySheets, todayStamp, useInventory, type InventoryLine } from '../../lib/inventory'
import type { AssignmentWithUser } from '../../lib/types'
import { cn, errMsg, formatDate } from '../../lib/utils'
import { downloadXlsx } from '../../lib/xlsx'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { AssignModal, ReturnModal } from '../../components/AssignModal'

type StateFilter = 'all' | 'in' | 'out' | 'none'

export default function Inventory() {
  const { categories, items, stock, assignments, users, loading, error, reload } = useInventory()
  const lines = useMemo(() => buildLines(categories, items, stock, assignments), [categories, items, stock, assignments])

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [state, setState] = useState<StateFilter>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [assign, setAssign] = useState<{ itemId?: string } | null>(null)
  const [returning, setReturning] = useState<AssignmentWithUser | null>(null)

  const totals = useMemo(
    () => ({
      total: lines.reduce((n, l) => n + l.total, 0),
      assigned: lines.reduce((n, l) => n + l.assigned, 0),
      available: lines.reduce((n, l) => n + l.available, 0),
      out: lines.filter((l) => l.total > 0 && l.available === 0).length,
    }),
    [lines],
  )

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return lines.filter((l) => {
      if (cat && l.categoryId !== cat) return false
      if (state === 'in' && l.available < 1) return false
      if (state === 'out' && !(l.total > 0 && l.available === 0)) return false
      if (state === 'none' && l.total !== 0) return false
      if (!t) return true
      return (
        l.item.name.toLowerCase().includes(t) ||
        l.category.toLowerCase().includes(t) ||
        l.holders.some((h) => `${h.office_users?.full_name ?? ''} ${h.office_users?.employee_id ?? ''} ${h.serial_no ?? ''} ${h.asset_tag ?? ''}`.toLowerCase().includes(t))
      )
    })
  }, [lines, q, cat, state])

  const grouped = useMemo(
    () => categories.map((c) => ({ c, rows: filtered.filter((l) => l.categoryId === c.id) })).filter((g) => g.rows.length > 0),
    [categories, filtered],
  )

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const exportExcel = () => {
    if (lines.length === 0) return void toast.error('There is no inventory to export yet')
    downloadXlsx(`ROYAL-POWER-Inventory-${todayStamp()}.xlsx`, inventorySheets(categories, lines, assignments))
    toast.success('Inventory Excel downloaded (category-wise sheets)')
  }

  const kpis = [
    { label: 'Total units', value: totals.total, icon: Warehouse, gradient: 'from-sky-400 to-blue-600' },
    { label: 'Assigned to users', value: totals.assigned, icon: PackageCheck, gradient: 'from-violet-400 to-purple-600' },
    { label: 'Backup / in stock', value: totals.available, icon: PackageOpen, gradient: 'from-emerald-400 to-green-600' },
    { label: 'Items fully assigned', value: totals.out, icon: PackageX, gradient: 'from-amber-400 to-orange-500' },
  ]

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock, who holds each item, and what is still available as backup."
        actions={
          <>
            <button className="btn-secondary" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Download Excel</button>
            <button className="btn-primary" onClick={() => setAssign({})}><UserPlus className="h-4 w-4" /> Assign equipment</button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass relative overflow-hidden p-5">
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${k.gradient} opacity-15`} />
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${k.gradient} text-white shadow-md`}><k.icon className="h-5 w-5" /></div>
            {loading ? <Skeleton className="h-9 w-16" /> : <div className="text-3xl font-extrabold tracking-tight">{k.value}</div>}
            <div className="mt-0.5 text-sm font-semibold text-ink-soft">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="glass mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Search item, user, serial…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
        </div>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={state} onChange={(e) => setState(e.target.value as StateFilter)} aria-label="Filter by stock state">
          <option value="all">All items</option>
          <option value="in">Available in backup</option>
          <option value="out">Fully assigned (0 left)</option>
          <option value="none">No stock recorded</option>
        </select>
      </div>

      {error ? (
        <div className="glass"><ErrorState message={error.includes('equipment_stock') || error.includes('office_users') ? 'Inventory tables are missing. Run migration 0005_inventory.sql in the Supabase SQL Editor.' : error} onRetry={reload} /></div>
      ) : loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="glass"><EmptyState icon={Boxes} title="No items match" message="Adjust the filters, or add equipment in Equipment Management." /></div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ c, rows }) => (
            <section key={c.id} className="glass overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver-200/70 bg-primary-50/50 px-5 py-3">
                <h2 className="font-bold">{c.name}</h2>
                <div className="flex gap-2 text-xs font-semibold text-ink-soft">
                  <span>Total {rows.reduce((n, l) => n + l.total, 0)}</span>·
                  <span>Assigned {rows.reduce((n, l) => n + l.assigned, 0)}</span>·
                  <span>Backup {rows.reduce((n, l) => n + l.available, 0)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="border-b border-silver-200/70">
                    <tr>
                      <th className="th">Equipment</th>
                      <th className="th">Total stock</th>
                      <th className="th">Assigned</th>
                      <th className="th">Backup (available)</th>
                      <th className="th">Assigned to</th>
                      <th className="th text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver-200/60">
                    {rows.map((l) => (
                      <Fragment key={l.item.id}>
                        <tr className={cn('transition hover:bg-primary-50/40', !l.item.is_active && 'opacity-60')}>
                          <td className="td">
                            <button className="flex items-center gap-2 text-left font-semibold" onClick={() => toggle(l.item.id)} aria-expanded={open.has(l.item.id)}>
                              <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-soft transition-transform', open.has(l.item.id) && 'rotate-180')} />
                              {l.item.name}
                              {!l.item.is_active && <span className="badge bg-slate-100 text-slate-600 ring-slate-200">Disabled</span>}
                            </button>
                          </td>
                          <td className="td"><StockInput line={l} onSaved={reload} /></td>
                          <td className="td font-semibold">{l.assigned}</td>
                          <td className="td"><AvailBadge line={l} /></td>
                          <td className="td">
                            {l.holders.length === 0 ? (
                              <span className="text-xs text-ink-faint">{l.total > 0 ? 'Nobody — all in backup' : '—'}</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {l.holders.slice(0, 2).map((h) => (
                                  <span key={h.id} className="badge bg-white/80 text-ink ring-silver-200">{h.office_users?.full_name ?? 'Unknown'} ×{h.quantity}</span>
                                ))}
                                {l.holders.length > 2 && (
                                  <button className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => toggle(l.item.id)}>+{l.holders.length - 2} more</button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="td text-right">
                            <button className="btn-secondary btn-sm" disabled={l.available < 1} onClick={() => setAssign({ itemId: l.item.id })} title={l.available < 1 ? 'No units available' : 'Assign to a user'}>
                              <UserPlus className="h-3.5 w-3.5" /> Assign
                            </button>
                          </td>
                        </tr>
                        {open.has(l.item.id) && (
                          <tr>
                            <td colSpan={6} className="bg-primary-50/40 px-5 py-4">
                              <Holders line={l} onReturn={setReturning} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <AssignModal
        open={Boolean(assign)}
        onClose={() => setAssign(null)}
        users={users}
        lines={lines}
        presetItemId={assign?.itemId}
        onDone={reload}
      />
      <ReturnModal assignment={returning} onClose={() => setReturning(null)} onDone={reload} />
    </div>
  )
}

function AvailBadge({ line }: { line: InventoryLine }) {
  if (line.total === 0) return <span className="badge bg-slate-100 text-slate-600 ring-slate-200">No stock recorded</span>
  if (line.available === 0) return <span className="badge bg-red-50 text-red-700 ring-red-200">0 · all assigned</span>
  return <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">{line.available} in backup</span>
}

function Holders({ line, onReturn }: { line: InventoryLine; onReturn: (a: AssignmentWithUser) => void }) {
  if (line.holders.length === 0) return <p className="text-sm text-ink-soft">This item is not assigned to anyone. All {line.total} unit(s) are in backup stock.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <th className="py-1.5 pr-3">User</th><th className="py-1.5 pr-3">Employee ID</th><th className="py-1.5 pr-3">Department</th>
            <th className="py-1.5 pr-3">Qty</th><th className="py-1.5 pr-3">Serial / Asset tag</th><th className="py-1.5 pr-3">Since</th><th className="py-1.5 text-right">Return</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silver-200/60">
          {line.holders.map((h) => (
            <tr key={h.id}>
              <td className="py-2 pr-3 font-semibold">{h.office_users?.full_name ?? 'Unknown user'}</td>
              <td className="py-2 pr-3">{h.office_users?.employee_id ?? '—'}</td>
              <td className="py-2 pr-3 text-ink-soft">{h.office_users?.department_name ?? '—'}</td>
              <td className="py-2 pr-3 font-semibold">{h.quantity}</td>
              <td className="py-2 pr-3 text-ink-soft">{[h.serial_no, h.asset_tag].filter(Boolean).join(' / ') || '—'}</td>
              <td className="py-2 pr-3 text-ink-soft">{formatDate(h.assigned_at)}</td>
              <td className="py-2 text-right">
                <button className="btn-ghost btn-sm" onClick={() => onReturn(h)}><Undo2 className="h-3.5 w-3.5" /> Return</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Editable total stock. Saved when the field loses focus or Enter is pressed. */
function StockInput({ line, onSaved }: { line: InventoryLine; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)

  const save = async (el: HTMLInputElement) => {
    const n = Math.floor(Number(el.value))
    if (el.value === '' || !Number.isFinite(n) || n < 0) {
      toast.error('Enter a valid stock quantity (0 or more)')
      el.value = String(line.total)
      return
    }
    if (n === line.total) return
    setSaving(true)
    const { error } = await supabase.from('equipment_stock').upsert({ item_id: line.item.id, total_quantity: n }, { onConflict: 'item_id' })
    setSaving(false)
    if (error) {
      toast.error(errMsg(error))
      el.value = String(line.total)
      return
    }
    toast.success(`${line.item.name}: total stock set to ${n}`)
    await onSaved()
  }

  return (
    <input
      key={`${line.item.id}-${line.total}`}
      type="number"
      min={0}
      defaultValue={line.total}
      disabled={saving}
      aria-label={`Total stock of ${line.item.name}`}
      className="input w-24 py-1.5 text-center font-semibold"
      onBlur={(e) => void save(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
