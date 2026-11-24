import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCatalog } from '../lib/hooks'
import { useSettings } from '../contexts/SettingsContext'
import type { Attachment, Priority } from '../lib/types'
import { PRIORITIES, PRIORITY_META, errMsg, formatBytes, formatDateTime, slugFileName } from '../lib/utils'
import { Field, PageHeader, Skeleton } from '../components/ui'

const OTHER = '__other__'
const MAX_FILES = 5
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

interface ItemValues {
  category_id: string
  item_id: string
  custom_name: string
  quantity: number
}

interface FormValues {
  full_name: string
  employee_id: string
  email: string
  department_id: string
  designation: string
  branch: string
  priority: Priority
  reason: string
  notes: string
  items: ItemValues[]
}

interface SubmitResult {
  ticket_no: string
  tracking_code: string
  created_at: string
}

const blankItem = (): ItemValues => ({ category_id: '', item_id: '', custom_name: '', quantity: 1 })

function SectionCard({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="glass p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-300 to-primary-600 text-sm font-extrabold text-white">{n}</div>
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ItemRow({
  index,
  form,
  categories,
  items,
  canRemove,
  onRemove,
}: {
  index: number
  form: UseFormReturn<FormValues>
  categories: { id: string; name: string }[]
  items: { id: string; category_id: string; name: string; is_available: boolean; is_other: boolean }[]
  canRemove: boolean
  onRemove: () => void
}) {
  const { register, watch, setValue, formState } = form
  const errs = formState.errors.items?.[index]
  const catId = watch(`items.${index}.category_id`)
  const itemId = watch(`items.${index}.item_id`)
  const catItems = items.filter((i) => i.category_id === catId)
  const needsName = itemId === OTHER || Boolean(items.find((i) => i.id === itemId)?.is_other)
  const regularItems = catItems.filter((i) => !i.is_other)
  const otherItem = catItems.find((i) => i.is_other)

  return (
    <div className="rounded-2xl border border-silver-200 bg-white/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-primary-700">Item {index + 1}</span>
        {canRemove && (
          <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onRemove}>
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-12">
        <Field label="Equipment Category" required htmlFor={`cat-${index}`} error={errs?.category_id?.message} className="md:col-span-4">
          <select
            id={`cat-${index}`}
            className={`input ${errs?.category_id ? 'input-error' : ''}`}
            {...register(`items.${index}.category_id`, {
              required: 'Choose a category',
              onChange: () => setValue(`items.${index}.item_id`, '', { shouldValidate: false }),
            })}
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Equipment Name" required htmlFor={`item-${index}`} error={errs?.item_id?.message} className="md:col-span-5">
          <select
            id={`item-${index}`}
            disabled={!catId}
            className={`input ${errs?.item_id ? 'input-error' : ''}`}
            {...register(`items.${index}.item_id`, { required: 'Choose the equipment' })}
          >
            <option value="">{catId ? 'Select equipment…' : 'Choose a category first'}</option>
            {regularItems.map((i) => (
              <option key={i.id} value={i.id} disabled={!i.is_available}>
                {i.name}{i.is_available ? '' : ' (unavailable)'}
              </option>
            ))}
            {otherItem && otherItem.is_available ? (
              <option value={otherItem.id}>Other (specify)</option>
            ) : (
              <option value={OTHER}>Other (specify)</option>
            )}
          </select>
        </Field>

        <Field label="Quantity" required htmlFor={`qty-${index}`} error={errs?.quantity?.message} className="md:col-span-3">
          <input
            id={`qty-${index}`}
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            className={`input ${errs?.quantity ? 'input-error' : ''}`}
            {...register(`items.${index}.quantity`, {
              valueAsNumber: true,
              required: 'Required',
              min: { value: 1, message: 'Minimum is 1' },
              max: { value: 1000, message: 'Maximum is 1000' },
              validate: (v) => Number.isInteger(v) || 'Whole numbers only',
            })}
          />
        </Field>

        {needsName && (
          <Field label="Specify the equipment" required htmlFor={`custom-${index}`} error={errs?.custom_name?.message} className="md:col-span-12">
            <input
              id={`custom-${index}`}
              className={`input ${errs?.custom_name ? 'input-error' : ''}`}
              placeholder="e.g. 24-port PoE switch, label printer…"
              maxLength={160}
              {...register(`items.${index}.custom_name`, {
                validate: (v) => !needsName || v.trim().length >= 2 || 'Please name the equipment you need',
              })}
            />
          </Field>
        )}
      </div>
    </div>
  )
}

export default function CreateRequest() {
  const { departments, categories, items, loading, error } = useCatalog()
  const { settings } = useSettings()
  const location = useLocation()
  const prefill = location.state as { categoryId?: string; itemId?: string } | null

  const form = useForm<FormValues>({
    mode: 'onTouched',
    defaultValues: {
      full_name: '',
      employee_id: '',
      email: '',
      department_id: '',
      designation: '',
      branch: '',
      priority: settings.default_priority,
      reason: '',
      notes: '',
      items: [{ ...blankItem(), category_id: prefill?.categoryId ?? '', item_id: prefill?.itemId ?? '' }],
    },
  })
  const { register, control, handleSubmit, watch, setValue, reset, formState } = form
  const { errors, dirtyFields } = formState
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<(SubmitResult & { email: string; lines: { name: string; quantity: number }[] }) | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!dirtyFields.priority) setValue('priority', settings.default_priority)
  }, [settings.default_priority, dirtyFields.priority, setValue])

  const priority = watch('priority')
  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c.id, name: c.name })), [categories])

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const next = [...files]
    for (const f of picked) {
      if (next.length >= MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files`)
        break
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`)
        continue
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} is larger than 5 MB`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const onSubmit = handleSubmit(async (v) => {
    setSubmitting(true)
    try {
      const folder = crypto.randomUUID()
      const uploaded: Attachment[] = []
      for (const [i, f] of files.entries()) {
        const path = `tickets/${folder}/${i + 1}-${slugFileName(f.name)}`
        const { error: upErr } = await supabase.storage.from('ticket-attachments').upload(path, f, { contentType: f.type, upsert: false })
        if (upErr) throw new Error(`Could not upload ${f.name}: ${upErr.message}`)
        uploaded.push({ path, name: f.name, size: f.size, type: f.type })
      }

      const payload = {
        full_name: v.full_name.trim(),
        employee_id: v.employee_id.trim(),
        email: v.email.trim(),
        department_id: v.department_id,
        designation: v.designation.trim(),
        branch: v.branch.trim(),
        priority: v.priority,
        reason: v.reason.trim(),
        notes: v.notes.trim(),
        attachments: uploaded,
        items: v.items.map((it) => ({
          category_id: it.category_id,
          item_id: it.item_id === OTHER ? '' : it.item_id,
          custom_name: it.custom_name.trim(),
          quantity: it.quantity,
        })),
      }

      const { data, error: rpcErr } = await supabase.rpc('submit_ticket', { payload })
      if (rpcErr) throw rpcErr

      const lines = v.items.map((it) => {
        const known = items.find((i) => i.id === it.item_id)
        const name = it.item_id === OTHER || known?.is_other ? it.custom_name.trim() : (known?.name ?? 'Item')
        return { name, quantity: it.quantity }
      })
      setResult({ ...(data as SubmitResult), email: v.email.trim(), lines })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success('Request submitted successfully')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  })

  const copyCode = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(`Ticket: ${result.ticket_no}\nEmail: ${result.email}\nTracking code: ${result.tracking_code}`)
      setCopied(true)
      toast.success('Tracking details copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy – please write the details down')
    }
  }

  const startOver = () => {
    setResult(null)
    setFiles([])
    reset()
  }

  /* ----------------------------- success screen ----------------------------- */
  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="glass-strong relative overflow-hidden p-6 text-center sm:p-10">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-300/40 blur-3xl" />
          <div className="relative mx-auto flex h-20 w-20 animate-pop-in items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 text-white shadow-lg shadow-emerald-400/40">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <h1 className="relative mt-5 text-2xl font-extrabold sm:text-3xl">Request submitted!</h1>
          <p className="relative mt-1 text-ink-soft">Your request is now in the IT team’s queue with the status <b>Pending</b>.</p>

          <div className="relative mt-7 rounded-2xl border border-primary-200 bg-primary-50/70 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-primary-700">Your Ticket ID</div>
            <div className="mt-1 text-3xl font-black tracking-wider text-ink sm:text-4xl">{result.ticket_no}</div>
            <div className="mt-1 text-sm text-ink-soft">Submitted {formatDateTime(result.created_at)}</div>
          </div>

          <div className="relative mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Private tracking code – shown only once</div>
            <div className="mt-1 text-2xl font-black tracking-[0.25em]">{result.tracking_code}</div>
            <p className="mt-2 text-sm text-amber-800">
              You need the Ticket ID, this code and the email you used (<b>{result.email}</b>) to track your request. Save them now.
            </p>
            <button onClick={copyCode} className="btn-secondary btn-sm mt-3">
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy tracking details'}
            </button>
          </div>

          <div className="relative mt-4 rounded-2xl border border-silver-200 bg-white/70 p-4 text-left">
            <div className="mb-2 text-sm font-bold">Requested equipment</div>
            <ul className="divide-y divide-silver-200/70 text-sm">
              {result.lines.map((l, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span>{l.name}</span>
                  <span className="font-semibold text-ink-soft">× {l.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/track" className="btn-primary">
              <Search className="h-4 w-4" /> Track this request
            </Link>
            <button onClick={startOver} className="btn-secondary">
              <Plus className="h-4 w-4" /> Create another request
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* --------------------------------- the form -------------------------------- */
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create New Request" subtitle="Tell us what you need. Fields marked * are required." />

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load the catalog: {error}</div>}

      {loading ? (
        <div className="space-y-5">
          <Skeleton className="h-72" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <SectionCard n={1} title="Your details" subtitle="We use this to verify and contact you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" required htmlFor="full_name" error={errors.full_name?.message}>
                <input id="full_name" autoComplete="name" className={`input ${errors.full_name ? 'input-error' : ''}`} placeholder="e.g. Muhammad Abdal"
                  {...register('full_name', { required: 'Full name is required', minLength: { value: 2, message: 'Please enter your full name' }, maxLength: { value: 120, message: 'Too long' } })} />
              </Field>
              <Field label="Employee ID" required htmlFor="employee_id" error={errors.employee_id?.message}>
                <input id="employee_id" className={`input ${errors.employee_id ? 'input-error' : ''}`} placeholder="e.g. EMP-1042"
                  {...register('employee_id', { required: 'Employee ID is required', maxLength: { value: 40, message: 'Too long' } })} />
              </Field>
              <Field label="Email Address" required htmlFor="email" error={errors.email?.message}>
                <input id="email" type="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`} placeholder="you@company.com"
                  {...register('email', { required: 'Email is required', pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Enter a valid email address' } })} />
              </Field>
              <Field label="Department" required htmlFor="department_id" error={errors.department_id?.message}>
                <select id="department_id" className={`input ${errors.department_id ? 'input-error' : ''}`} {...register('department_id', { required: 'Select your department' })}>
                  <option value="">Select department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Designation" required htmlFor="designation" error={errors.designation?.message}>
                <input id="designation" className={`input ${errors.designation ? 'input-error' : ''}`} placeholder="e.g. Senior Accountant"
                  {...register('designation', { required: 'Designation is required', maxLength: { value: 120, message: 'Too long' } })} />
              </Field>
              <Field label="Branch / Location" required htmlFor="branch" error={errors.branch?.message}>
                <input id="branch" className={`input ${errors.branch ? 'input-error' : ''}`} placeholder="e.g. Head Office, 2nd floor"
                  {...register('branch', { required: 'Branch / location is required', maxLength: { value: 120, message: 'Too long' } })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard n={2} title="Equipment needed" subtitle="Add as many items as you need in a single request.">
            <div className="space-y-4">
              {fields.map((f, i) => (
                <ItemRow key={f.id} index={i} form={form} categories={categoryOptions} items={items} canRemove={fields.length > 1} onRemove={() => remove(i)} />
              ))}
            </div>
            {fields.length < 20 && (
              <button type="button" className="btn-secondary mt-4" onClick={() => append(blankItem())}>
                <Plus className="h-4 w-4" /> Add another item
              </button>
            )}
          </SectionCard>

          <SectionCard n={3} title="Priority & reason">
            <fieldset>
              <legend className="label">Request Priority <span className="text-red-500">*</span></legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PRIORITIES.map((p) => (
                  <label
                    key={p}
                    className="has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50 has-[:checked]:ring-4 has-[:checked]:ring-primary-100 relative flex cursor-pointer flex-col rounded-xl border border-silver-200 bg-white/70 p-3 transition hover:border-primary-300"
                  >
                    <input type="radio" value={p} className="sr-only" {...register('priority', { required: true })} />
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_META[p].color }} />
                      {PRIORITY_META[p].label}
                    </span>
                    <span className="mt-0.5 text-xs text-ink-soft">{PRIORITY_META[p].hint}</span>
                  </label>
                ))}
              </div>
              {priority === 'critical' && (
                <p className="mt-2 text-xs font-medium text-red-600">Critical requests notify the IT team immediately. Please use this only when work is blocked.</p>
              )}
            </fieldset>

            <div className="mt-5 grid gap-4">
              <Field label="Reason / Description" required htmlFor="reason" error={errors.reason?.message}>
                <textarea id="reason" rows={4} className={`input ${errors.reason ? 'input-error' : ''}`} placeholder="Why do you need this equipment? Mention any faulty item being replaced."
                  {...register('reason', { required: 'Please explain why you need this', minLength: { value: 5, message: 'Please add a little more detail' }, maxLength: { value: 4000, message: 'Too long' } })} />
              </Field>
              <Field label="Additional Notes" htmlFor="notes" error={errors.notes?.message} hint="Optional – anything else IT should know (model preferences, deadline…).">
                <textarea id="notes" rows={3} className="input" {...register('notes', { maxLength: { value: 4000, message: 'Too long' } })} />
              </Field>
            </div>
          </SectionCard>

          {settings.allow_attachments && (
            <SectionCard n={4} title="Attachments" subtitle={`Optional – up to ${MAX_FILES} images or documents, 5 MB each.`}>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-4 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50">
                <UploadCloud className="h-9 w-9 text-primary-500" />
                <span className="mt-2 text-sm font-semibold">Click to upload files</span>
                <span className="text-xs text-ink-soft">PNG, JPG, WEBP, GIF, PDF, DOC(X), XLS(X), TXT</span>
                <input type="file" multiple className="sr-only" accept={ALLOWED_TYPES.join(',')} onChange={onPickFiles} />
              </label>
              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-silver-200 bg-white/80 px-3 py-2 text-sm">
                      {f.type.startsWith('image/') ? <Paperclip className="h-4 w-4 text-primary-500" /> : <FileText className="h-4 w-4 text-primary-500" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                      <span className="text-xs text-ink-soft">{formatBytes(f.size)}</span>
                      <button type="button" className="icon-btn h-7 w-7" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-ink-soft">By submitting you confirm the information is accurate (see SOP 01).</p>
            <button type="submit" className="btn-primary px-8 py-3 text-base" disabled={submitting}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
