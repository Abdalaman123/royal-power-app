import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Building2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCatalog } from '../../lib/hooks'
import type { Department } from '../../lib/types'
import { cn, errMsg } from '../../lib/utils'
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Switch, TableSkeleton } from '../../components/ui'

interface FormValues {
  name: string
  description: string
  sort_order: number
  is_active: boolean
}

export default function Departments() {
  const { departments, loading, error, reload } = useCatalog(true)
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Department | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = async (d: Department, is_active: boolean) => {
    const { error: err } = await supabase.from('departments').update({ is_active }).eq('id', d.id)
    if (err) toast.error(errMsg(err))
    else {
      toast.success(is_active ? 'Department activated' : 'Department deactivated')
      await reload()
    }
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    const { error: err } = await supabase.from('departments').delete().eq('id', toDelete.id)
    setBusy(false)
    if (err) return void toast.error(errMsg(err))
    toast.success(`“${toDelete.name}” removed`)
    setToDelete(null)
    await reload()
  }

  return (
    <div>
      <PageHeader
        title="Department Management"
        subtitle="Active departments appear in the user request form."
        actions={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add department</button>}
      />
      <div className="glass overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton />
        ) : departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments" message="Add departments so users can pick theirs in the request form." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-silver-200/70 bg-primary-50/50">
                <tr><th className="th">Department</th><th className="th">Active</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-silver-200/60">
                {departments.map((d) => (
                  <tr key={d.id} className={cn('transition hover:bg-primary-50/40', !d.is_active && 'opacity-60')}>
                    <td className="td">
                      <div className="font-semibold">{d.name}</div>
                      {d.description && <div className="text-xs text-ink-soft">{d.description}</div>}
                    </td>
                    <td className="td"><Switch checked={d.is_active} label={`Activate ${d.name}`} onChange={(v) => void toggle(d, v)} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="icon-btn" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}><Pencil className="h-[18px] w-[18px]" /></button>
                        <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-[18px] w-[18px]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeptModal target={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload() }} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={busy}
        title="Remove department?"
        confirmLabel="Remove"
        message={<><b>{toDelete?.name}</b> will no longer be selectable. Existing tickets keep the department name for the record. You can deactivate it instead.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}

function DeptModal({ target, onClose, onSaved }: { target: Department | 'new' | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>()
  const { errors, isSubmitting } = formState
  const dept = target && target !== 'new' ? target : null

  useEffect(() => {
    if (!target) return
    reset({ name: dept?.name ?? '', description: dept?.description ?? '', sort_order: dept?.sort_order ?? 0, is_active: dept?.is_active ?? true })
  }, [target, dept, reset])

  const onSubmit = handleSubmit(async (v) => {
    const row = { name: v.name.trim(), description: v.description.trim() || null, sort_order: Number.isFinite(v.sort_order) ? v.sort_order : 0, is_active: v.is_active }
    const { error: err } = dept ? await supabase.from('departments').update(row).eq('id', dept.id) : await supabase.from('departments').insert(row)
    if (err) return void toast.error(err.code === '23505' ? 'A department with this name already exists' : errMsg(err))
    toast.success(dept ? 'Department updated' : 'Department added')
    await onSaved()
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={dept ? 'Edit department' : 'Add department'}
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="dept-form" type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} {dept ? 'Save changes' : 'Add department'}</button>
        </>
      }
    >
      <form id="dept-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" required htmlFor="d-name" error={errors.name?.message}>
          <input id="d-name" className="input" maxLength={80} {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
        </Field>
        <Field label="Description" htmlFor="d-desc">
          <textarea id="d-desc" rows={2} className="input" maxLength={300} {...register('description')} />
        </Field>
        <Field label="Display order" htmlFor="d-order" hint="Lower numbers appear first.">
          <input id="d-order" type="number" className="input" {...register('sort_order', { valueAsNumber: true })} />
        </Field>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch checked={watch('is_active') ?? true} label="Active" onChange={(v) => setValue('is_active', v)} /> Active (selectable by users)
        </label>
      </form>
    </Modal>
  )
}
