import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FileSpreadsheet, Loader2, Package, Pencil, Plus, Search, Trash2, Undo2, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCatalog } from '../../lib/hooks'
import { buildLines, todayStamp, useInventory } from '../../lib/inventory'
import type { Assignment, AssignmentWithUser, OfficeUser } from '../../lib/types'
import { cn, errMsg, formatDate, formatDateTime } from '../../lib/utils'
import { downloadXlsx } from '../../lib/xlsx'
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Switch, TableSkeleton } from '../../components/ui'
import { AssignModal, ReturnModal } from '../../components/AssignModal'

interface FormValues {
  employee_id: string
  full_name: string
  email: string
  phone: string
  department_id: string
  designation: string
  branch: string
  notes: string
  is_active: boolean
}

export default function OfficeUsers() {
  const { categories, items, stock, assignments, users, loading, error, reload } = useInventory()
  const { departments } = useCatalog(true)
  const lines = useMemo(() => buildLines(categories, items, stock, assignments), [categories, items, stock, assignments])

  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [editing, setEditing] = useState<OfficeUser | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<OfficeUser | null>(null)
  const [assignTo, setAssignTo] = useState<OfficeUser | null>(null)
  const [viewing, setViewing] = useState<OfficeUser | null>(null)
  const [busy, setBusy] = useState(false)

  const heldBy = useMemo(() => {
    const m = new Map<string, AssignmentWithUser[]>()
    for (const a of assignments) {
      const l = m.get(a.user_id)
      if (l) l.push(a)
      else m.set(a.user_id, [a])
    }
    return m
  }, [assignments])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return users.filter(
      (u) =>
        (!dept || u.department_id === dept) &&
        (status === '' || (status === 'active' ? u.is_active : !u.is_active)) &&
        (!t || `${u.full_name} ${u.employee_id} ${u.email ?? ''} ${u.designation ?? ''} ${u.department_name ?? ''} ${u.phone ?? ''}`.toLowerCase().includes(t)),
    )
  }, [users, q, dept, status])

  const toggleActive = async (u: OfficeUser, is_active: boolean) => {
    const { error: err } = await supabase.from('office_users').update({ is_active }).eq('id', u.id)
    if (err) return void toast.error(errMsg(err))
    toast.success(is_active ? 'User activated' : 'User deactivated')
    await reload()
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    const { error: err } = await supabase.from('office_users').delete().eq('id', toDelete.id)
    setBusy(false)
    if (err) {
      toast.error(err.code === '23503' ? 'This user has assignment history, so they cannot be deleted. Deactivate them instead.' : errMsg(err))
      return
    }
    toast.success(`“${toDelete.full_name}” removed`)
    setToDelete(null)
    await reload()
  }

  const exportExcel = () => {
    if (users.length === 0) return void toast.error('No users to export yet')
    downloadXlsx(`ROYAL-POWER-Office-Users-${todayStamp()}.xlsx`, [
      {
        name: 'Office Users',
        rows: [
          ['Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Branch / Location', 'Status', 'Units Assigned', 'Assigned Equipment'],
          ...users.map((u) => {
            const h = heldBy.get(u.id) ?? []
            return [
              u.employee_id, u.full_name, u.email, u.phone, u.department_name, u.designation, u.branch,
              u.is_active ? 'Active' : 'Inactive', h.reduce((n, a) => n + a.quantity, 0),
              h.map((a) => `${a.item_name} x${a.quantity}`).join('; '),
            ]
          }),
        ],
      },
    ])
  }

  return (
    <div>
      <PageHeader
        title="Office Users"
        subtitle="Employees who can be issued IT equipment."
        actions={
          <>
            <button className="btn-secondary" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Download Excel</button>
            <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add user</button>
          </>
        }
      />

      <div className="glass mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Search name, ID, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </div>
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="">Active & inactive</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="glass overflow-hidden">
        {error ? (
          <ErrorState message={error.includes('office_users') ? 'Office user tables are missing. Run migration 0005_inventory.sql in the Supabase SQL Editor.' : error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton />
        ) : list.length === 0 ? (
          <EmptyState icon={Users} title="No users found" message="Add your office staff so you can assign equipment to them." action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add user</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-silver-200/70 bg-primary-50/50">
                <tr>
                  <th className="th">Employee</th><th className="th">Department</th><th className="th">Designation</th><th className="th">Contact</th>
                  <th className="th">Equipment held</th><th className="th">Active</th><th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver-200/60">
                {list.map((u) => {
                  const h = heldBy.get(u.id) ?? []
                  const units = h.reduce((n, a) => n + a.quantity, 0)
                  return (
                    <tr key={u.id} className={cn('transition hover:bg-primary-50/40', !u.is_active && 'opacity-60')}>
                      <td className="td">
                        <div className="font-semibold">{u.full_name}</div>
                        <div className="text-xs text-ink-soft">ID: {u.employee_id}{u.branch ? ` · ${u.branch}` : ''}</div>
                      </td>
                      <td className="td text-ink-soft">{u.department_name ?? '—'}</td>
                      <td className="td text-ink-soft">{u.designation ?? '—'}</td>
                      <td className="td text-xs text-ink-soft">
                        <div>{u.email ?? '—'}</div>
                        {u.phone && <div>{u.phone}</div>}
                      </td>
                      <td className="td">
                        <button className="badge bg-white/80 text-primary-700 ring-primary-200 hover:bg-primary-50" onClick={() => setViewing(u)}>
                          <Package className="h-3.5 w-3.5" /> {units} unit{units === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td className="td"><Switch checked={u.is_active} label={`Activate ${u.full_name}`} onChange={(v) => void toggleActive(u, v)} /></td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button className="btn-secondary btn-sm" disabled={!u.is_active} onClick={() => setAssignTo(u)}><UserPlus className="h-3.5 w-3.5" /> Assign</button>
                          <button className="icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.full_name}`}><Pencil className="h-[18px] w-[18px]" /></button>
                          <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(u)} aria-label={`Delete ${u.full_name}`}><Trash2 className="h-[18px] w-[18px]" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal target={editing} departments={departments} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload() }} />

      <AssignModal open={Boolean(assignTo)} onClose={() => setAssignTo(null)} users={users} lines={lines} presetUserId={assignTo?.id} onDone={reload} />

      <UserAssetsModal user={viewing} onClose={() => setViewing(null)} onChanged={reload} onAssign={(u) => { setViewing(null); setAssignTo(u) }} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={busy}
        title="Delete user?"
        confirmLabel="Delete"
        message={<><b>{toDelete?.full_name}</b> ({toDelete?.employee_id}) will be removed. Users who ever received equipment cannot be deleted so the history stays intact — deactivate them instead.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}

function UserModal({ target, departments, onClose, onSaved }: { target: OfficeUser | 'new' | null; departments: { id: string; name: string; is_active: boolean }[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>()
  const { errors, isSubmitting } = formState
  const user = target && target !== 'new' ? target : null

  useEffect(() => {
    if (!target) return
    reset({
      employee_id: user?.employee_id ?? '',
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      department_id: user?.department_id ?? '',
      designation: user?.designation ?? '',
      branch: user?.branch ?? '',
      notes: user?.notes ?? '',
      is_active: user?.is_active ?? true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const onSubmit = handleSubmit(async (v) => {
    const d = departments.find((x) => x.id === v.department_id)
    const row = {
      employee_id: v.employee_id.trim(),
      full_name: v.full_name.trim(),
      email: v.email.trim().toLowerCase() || null,
      phone: v.phone.trim() || null,
      department_id: v.department_id || null,
      department_name: d?.name ?? null,
      designation: v.designation.trim() || null,
      branch: v.branch.trim() || null,
      notes: v.notes.trim() || null,
      is_active: v.is_active,
    }
    const { error: err } = user ? await supabase.from('office_users').update(row).eq('id', user.id) : await supabase.from('office_users').insert(row)
    if (err) return void toast.error(err.code === '23505' ? 'A user with this Employee ID already exists' : errMsg(err))
    toast.success(user ? 'User updated' : 'User added')
    await onSaved()
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      size="lg"
      title={user ? 'Edit user' : 'Add office user'}
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="user-form" type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} {user ? 'Save changes' : 'Add user'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Employee ID" required htmlFor="u-id" error={errors.employee_id?.message}>
          <input id="u-id" className="input" maxLength={40} {...register('employee_id', { required: 'Employee ID is required' })} />
        </Field>
        <Field label="Full name" required htmlFor="u-name" error={errors.full_name?.message}>
          <input id="u-name" className="input" maxLength={120} {...register('full_name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
        </Field>
        <Field label="Email" htmlFor="u-email" error={errors.email?.message}>
          <input id="u-email" type="email" className="input" {...register('email', { pattern: { value: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} />
        </Field>
        <Field label="Phone" htmlFor="u-phone"><input id="u-phone" className="input" maxLength={30} {...register('phone')} /></Field>
        <Field label="Department" htmlFor="u-dept">
          <select id="u-dept" className="input" {...register('department_id')}>
            <option value="">— None —</option>
            {departments.filter((d) => d.is_active || d.id === user?.department_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation" htmlFor="u-des"><input id="u-des" className="input" maxLength={80} {...register('designation')} /></Field>
        <Field label="Branch / Location" htmlFor="u-branch"><input id="u-branch" className="input" maxLength={80} {...register('branch')} /></Field>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Switch checked={watch('is_active') ?? true} label="Active" onChange={(v) => setValue('is_active', v)} /> Active employee
          </label>
        </div>
        <Field label="Notes" htmlFor="u-notes" className="sm:col-span-2"><textarea id="u-notes" rows={2} className="input" maxLength={300} {...register('notes')} /></Field>
      </form>
    </Modal>
  )
}

function UserAssetsModal({ user, onClose, onChanged, onAssign }: { user: OfficeUser | null; onClose: () => void; onChanged: () => Promise<void>; onAssign: (u: OfficeUser) => void }) {
  const [rows, setRows] = useState<AssignmentWithUser[]>([])
  const [loading, setLoading] = useState(false)
  const [returning, setReturning] = useState<AssignmentWithUser | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('equipment_assignments')
      .select('*, office_users(employee_id, full_name, department_name, designation, email, phone)')
      .eq('user_id', user.id)
      .order('assigned_at', { ascending: false })
      .limit(500)
    if (error) toast.error(errMsg(error))
    setRows((data ?? []) as AssignmentWithUser[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) void load()
    else setRows([])
  }, [user, load])

  const active = rows.filter((r: Assignment) => r.status === 'assigned')
  const history = rows.filter((r: Assignment) => r.status === 'returned')

  return (
    <>
      <Modal
        open={Boolean(user)}
        onClose={onClose}
        size="lg"
        title={user ? `${user.full_name} — equipment` : 'Equipment'}
        footer={user && user.is_active ? <button className="btn-primary" onClick={() => onAssign(user)}><UserPlus className="h-4 w-4" /> Assign more equipment</button> : undefined}
      >
        {user && (
          <div className="space-y-5">
            <div className="rounded-xl bg-primary-50/70 p-3 text-sm text-ink-soft">
              <b className="text-ink">{user.employee_id}</b> · {user.department_name ?? 'No department'} · {user.designation ?? 'No designation'}{user.email ? ` · ${user.email}` : ''}
            </div>
            {loading ? (
              <TableSkeleton rows={3} />
            ) : (
              <>
                <section>
                  <h3 className="mb-2 font-bold">Currently assigned ({active.reduce((n, a) => n + a.quantity, 0)} units)</h3>
                  {active.length === 0 ? (
                    <p className="text-sm text-ink-soft">Nothing is assigned to this user.</p>
                  ) : (
                    <ul className="divide-y divide-silver-200/70 rounded-xl border border-silver-200/70 bg-white/60">
                      {active.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <div>
                            <div className="font-semibold">{a.item_name} × {a.quantity}</div>
                            <div className="text-xs text-ink-soft">
                              {a.category_name ?? ''} · since {formatDate(a.assigned_at)}
                              {a.serial_no ? ` · S/N ${a.serial_no}` : ''}{a.asset_tag ? ` · Tag ${a.asset_tag}` : ''}{a.ticket_no ? ` · ${a.ticket_no}` : ''}
                            </div>
                          </div>
                          <button className="btn-secondary btn-sm" onClick={() => setReturning(a)}><Undo2 className="h-3.5 w-3.5" /> Return</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {history.length > 0 && (
                  <section>
                    <h3 className="mb-2 font-bold">Returned history</h3>
                    <ul className="divide-y divide-silver-200/70 rounded-xl border border-silver-200/70 bg-white/60 text-sm">
                      {history.map((a) => (
                        <li key={a.id} className="px-4 py-2.5">
                          <span className="font-semibold">{a.item_name} × {a.quantity}</span>
                          <span className="text-ink-soft"> · {formatDate(a.assigned_at)} → {formatDateTime(a.returned_at)}{a.return_notes ? ` · ${a.return_notes}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
      <ReturnModal assignment={returning} onClose={() => setReturning(null)} onDone={async () => { await load(); await onChanged() }} />
    </>
  )
}
