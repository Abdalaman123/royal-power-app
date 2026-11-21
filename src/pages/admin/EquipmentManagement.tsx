import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Loader2, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCatalog } from '../../lib/hooks'
import type { EquipmentItem } from '../../lib/types'
import { cn, errMsg } from '../../lib/utils'
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Switch, TableSkeleton } from '../../components/ui'

interface FormValues {
  name: string
  category_id: string
  description: string
  sort_order: number
  is_active: boolean
  is_available: boolean
}

export default function EquipmentManagement() {
  const { categories, items, loading, error, reload } = useCatalog(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [state, setState] = useState<'' | 'active' | 'inactive' | 'unavailable'>('')
  const [editing, setEditing] = useState<EquipmentItem | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<EquipmentItem | null>(null)
  const [busy, setBusy] = useState(false)

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(
      (i) =>
        (!cat || i.category_id === cat) &&
        (!term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term)) &&
        (state === '' || (state === 'active' && i.is_active) || (state === 'inactive' && !i.is_active) || (state === 'unavailable' && !i.is_available)),
    )
  }, [items, q, cat, state])

  const patch = async (item: EquipmentItem, values: Partial<EquipmentItem>) => {
    const { error: err } = await supabase.from('equipment_items').update(values).eq('id', item.id)
    if (err) toast.error(errMsg(err))
    else {
      toast.success('Catalog updated')
      await reload()
    }
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    const { error: err } = await supabase.from('equipment_items').delete().eq('id', toDelete.id)
    setBusy(false)
    if (err) {
      toast.error(errMsg(err))
      return
    }
    toast.success(`“${toDelete.name}” removed from the catalog`)
    setToDelete(null)
    await reload()
  }

  return (
    <div>
      <PageHeader
        title="Equipment Management"
        subtitle="Changes appear in the user request form immediately."
        actions={
          <button className="btn-primary" onClick={() => setEditing('new')} disabled={categories.length === 0}>
            <Plus className="h-4 w-4" /> Add equipment
          </button>
        }
      />

      <div className="glass mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Search equipment…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search equipment" />
        </div>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={state} onChange={(e) => setState(e.target.value as typeof state)} aria-label="Filter by state">
          <option value="">Any state</option>
          <option value="active">Enabled</option>
          <option value="inactive">Disabled</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div className="glass overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton />
        ) : list.length === 0 ? (
          <EmptyState icon={Package} title="No equipment found" message="Add equipment or adjust the filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-silver-200/70 bg-primary-50/50">
                <tr><th className="th">Equipment</th><th className="th">Category</th><th className="th">Enabled</th><th className="th">Available</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-silver-200/60">
                {list.map((i) => (
                  <tr key={i.id} className={cn('transition hover:bg-primary-50/40', !i.is_active && 'opacity-60')}>
                    <td className="td">
                      <div className="font-semibold">{i.name}{i.is_other && <span className="badge ml-2 bg-violet-50 text-violet-700 ring-violet-200">“Other” option</span>}</div>
                      {i.description && <div className="max-w-md truncate text-xs text-ink-soft">{i.description}</div>}
                    </td>
                    <td className="td text-ink-soft">{catName.get(i.category_id) ?? '—'}</td>
                    <td className="td"><Switch checked={i.is_active} label={`Enable ${i.name}`} onChange={(v) => void patch(i, { is_active: v })} /></td>
                    <td className="td"><Switch checked={i.is_available} label={`Mark ${i.name} available`} onChange={(v) => void patch(i, { is_available: v })} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="icon-btn" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}><Pencil className="h-[18px] w-[18px]" /></button>
                        <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(i)} aria-label={`Delete ${i.name}`}><Trash2 className="h-[18px] w-[18px]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ItemModal
        target={editing}
        categories={categories}
        defaultCategory={cat}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={busy}
        title="Delete equipment?"
        confirmLabel="Delete"
        message={<><b>{toDelete?.name}</b> will be removed from the catalog. Existing tickets are <b>not</b> affected — they keep the item name for the record. To hide it temporarily, disable it instead.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}

function ItemModal({
  target,
  categories,
  defaultCategory,
  onClose,
  onSaved,
}: {
  target: EquipmentItem | 'new' | null
  categories: { id: string; name: string }[]
  defaultCategory: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>()
  const { errors, isSubmitting } = formState
  const item = target && target !== 'new' ? target : null

  useEffect(() => {
    if (!target) return
    reset({
      name: item?.name ?? '',
      category_id: item?.category_id ?? defaultCategory ?? categories[0]?.id ?? '',
      description: item?.description ?? '',
      sort_order: item?.sort_order ?? 0,
      is_active: item?.is_active ?? true,
      is_available: item?.is_available ?? true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const onSubmit = handleSubmit(async (v) => {
    const row = {
      name: v.name.trim(),
      category_id: v.category_id,
      description: v.description.trim() || null,
      sort_order: Number.isFinite(v.sort_order) ? v.sort_order : 0,
      is_active: v.is_active,
      is_available: v.is_available,
    }
    const { error: err } = item
      ? await supabase.from('equipment_items').update(row).eq('id', item.id)
      : await supabase.from('equipment_items').insert(row)
    if (err) {
      toast.error(err.code === '23505' ? 'An item with this name already exists in that category' : errMsg(err))
      return
    }
    toast.success(item ? 'Equipment updated' : 'Equipment added – it is now live in the request form')
    await onSaved()
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={item ? 'Edit equipment' : 'Add equipment'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
          <button className="btn-primary" form="item-form" type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} {item ? 'Save changes' : 'Add equipment'}
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" required htmlFor="i-name" error={errors.name?.message}>
          <input id="i-name" className="input" maxLength={120} {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
        </Field>
        <Field label="Category" required htmlFor="i-cat" error={errors.category_id?.message}>
          <select id="i-cat" className="input" {...register('category_id', { required: 'Choose a category' })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Description" htmlFor="i-desc" hint="Shown in the user catalog.">
          <textarea id="i-desc" rows={3} className="input" maxLength={500} {...register('description')} />
        </Field>
        <Field label="Display order" htmlFor="i-order" hint="Lower numbers appear first.">
          <input id="i-order" type="number" className="input" {...register('sort_order', { valueAsNumber: true })} />
        </Field>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={watch('is_active') ?? true} label="Enabled" onChange={(v) => setValue('is_active', v)} /> Enabled (visible to users)</label>
          <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={watch('is_available') ?? true} label="Available" onChange={(v) => setValue('is_available', v)} /> Available to request</label>
        </div>
      </form>
    </Modal>
  )
}
