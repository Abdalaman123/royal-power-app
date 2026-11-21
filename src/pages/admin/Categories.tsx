import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCatalog } from '../../lib/hooks'
import { ICON_NAMES, getIcon } from '../../lib/icons'
import type { Category } from '../../lib/types'
import { cn, errMsg } from '../../lib/utils'
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, Switch } from '../../components/ui'

interface FormValues {
  name: string
  description: string
  sort_order: number
  is_active: boolean
}

export default function Categories() {
  const { categories, items, loading, error, reload } = useCatalog(true)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    items.forEach((i) => m.set(i.category_id, (m.get(i.category_id) ?? 0) + 1))
    return m
  }, [items])

  const toggle = async (c: Category, is_active: boolean) => {
    const { error: err } = await supabase.from('equipment_categories').update({ is_active }).eq('id', c.id)
    if (err) toast.error(errMsg(err))
    else {
      toast.success(is_active ? 'Category enabled' : 'Category hidden from users')
      await reload()
    }
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    const { error: err } = await supabase.from('equipment_categories').delete().eq('id', toDelete.id)
    setBusy(false)
    if (err) return void toast.error(errMsg(err))
    toast.success(`Category “${toDelete.name}” deleted`)
    setToDelete(null)
    await reload()
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Group equipment into categories. Users see active categories in the request form."
        actions={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New category</button>}
      />

      {error ? (
        <div className="glass"><ErrorState message={error} onRetry={reload} /></div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : categories.length === 0 ? (
        <div className="glass"><EmptyState icon={Layers} title="No categories yet" message="Create your first category to start building the catalog." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => {
            const Icon = getIcon(c.icon)
            return (
              <div key={c.id} className={cn('glass glass-hover flex flex-col gap-3 p-5', !c.is_active && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white"><Icon className="h-6 w-6" /></div>
                    <div>
                      <h2 className="font-bold leading-snug">{c.name}</h2>
                      <p className="text-xs font-semibold text-primary-600">{counts.get(c.id) ?? 0} item{(counts.get(c.id) ?? 0) === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <Switch checked={c.is_active} label={`Enable ${c.name}`} onChange={(v) => void toggle(c, v)} />
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-soft">{c.description || 'No description'}</p>
                <div className="flex justify-end gap-1 border-t border-silver-200/60 pt-3">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /> Edit</button>
                  <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4" /> Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CategoryModal target={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload() }} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={busy}
        title="Delete category?"
        confirmLabel="Delete category"
        message={<><b>{toDelete?.name}</b> and its <b>{counts.get(toDelete?.id ?? '') ?? 0}</b> equipment item(s) will be removed from the catalog. Past tickets keep their item names and are not affected. Consider disabling the category instead.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}

function CategoryModal({ target, onClose, onSaved }: { target: Category | 'new' | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>()
  const { errors, isSubmitting } = formState
  const [icon, setIcon] = useState('Package')
  const cat = target && target !== 'new' ? target : null

  useEffect(() => {
    if (!target) return
    reset({ name: cat?.name ?? '', description: cat?.description ?? '', sort_order: cat?.sort_order ?? 0, is_active: cat?.is_active ?? true })
    setIcon(cat?.icon ?? 'Package')
  }, [target, cat, reset])

  const onSubmit = handleSubmit(async (v) => {
    const row = { name: v.name.trim(), description: v.description.trim() || null, icon, sort_order: Number.isFinite(v.sort_order) ? v.sort_order : 0, is_active: v.is_active }
    const { error: err } = cat ? await supabase.from('equipment_categories').update(row).eq('id', cat.id) : await supabase.from('equipment_categories').insert(row)
    if (err) return void toast.error(err.code === '23505' ? 'A category with this name already exists' : errMsg(err))
    toast.success(cat ? 'Category updated' : 'Category created')
    await onSaved()
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={cat ? 'Edit category' : 'New category'}
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="cat-form" type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} {cat ? 'Save changes' : 'Create category'}</button>
        </>
      }
    >
      <form id="cat-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" required htmlFor="c-name" error={errors.name?.message}>
          <input id="c-name" className="input" maxLength={80} {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
        </Field>
        <Field label="Description" htmlFor="c-desc">
          <textarea id="c-desc" rows={2} className="input" maxLength={300} {...register('description')} />
        </Field>
        <div>
          <span className="label">Icon</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9" role="radiogroup" aria-label="Icon">
            {ICON_NAMES.map((n) => {
              const I = getIcon(n)
              return (
                <button key={n} type="button" role="radio" aria-checked={icon === n} aria-label={n} title={n} onClick={() => setIcon(n)}
                  className={cn('flex h-10 items-center justify-center rounded-xl border transition', icon === n ? 'border-primary-400 bg-primary-50 text-primary-700 ring-4 ring-primary-100' : 'border-silver-200 bg-white/70 text-ink-soft hover:border-primary-300')}>
                  <I className="h-5 w-5" />
                </button>
              )
            })}
          </div>
        </div>
        <Field label="Display order" htmlFor="c-order" hint="Lower numbers appear first.">
          <input id="c-order" type="number" className="input" {...register('sort_order', { valueAsNumber: true })} />
        </Field>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch checked={watch('is_active') ?? true} label="Active" onChange={(v) => setValue('is_active', v)} /> Active (visible to users)
        </label>
      </form>
    </Modal>
  )
}
