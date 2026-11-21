import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, BookOpen, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../contexts/SettingsContext'
import { DEFAULT_SOPS } from '../../lib/sops'
import { ICON_NAMES, getIcon } from '../../lib/icons'
import type { Sop } from '../../lib/types'
import { errMsg } from '../../lib/utils'
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader } from '../../components/ui'
import SopCard from '../../components/SopCard'

/** SOPs live in system_settings.sops (public, so the User Portal reads the same list). */
export default function SopLibrary() {
  const { settings, refresh } = useSettings()
  const [editing, setEditing] = useState<Sop | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Sop | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const sops = settings.sops

  const persist = async (next: Sop[], okMsg: string) => {
    setBusy(true)
    const { error } = await supabase.from('system_settings').upsert({ key: 'sops', value: next, is_public: true }, { onConflict: 'key' })
    setBusy(false)
    if (error) {
      toast.error(errMsg(error))
      return false
    }
    toast.success(okMsg)
    await refresh()
    return true
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= sops.length) return
    const next = [...sops]
    ;[next[i], next[j]] = [next[j], next[i]]
    void persist(next, 'Order updated')
  }

  return (
    <div>
      <PageHeader
        title="IT SOP Library"
        subtitle="Standard Operating Procedures shown to employees in the User Portal."
        actions={
          <>
            <button className="btn-secondary" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" /> Restore defaults</button>
            <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add SOP</button>
          </>
        }
      />

      {sops.length === 0 ? (
        <div className="glass"><EmptyState icon={BookOpen} title="No SOPs" message="Add a procedure or restore the defaults." /></div>
      ) : (
        <div className="space-y-4">
          {sops.map((s, i) => (
            <div key={s.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><SopCard sop={s} /></div>
              <div className="flex flex-col gap-1 pt-2">
                <button className="icon-btn" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label={`Move ${s.title} up`}><ArrowUp className="h-[18px] w-[18px]" /></button>
                <button className="icon-btn" disabled={i === sops.length - 1 || busy} onClick={() => move(i, 1)} aria-label={`Move ${s.title} down`}><ArrowDown className="h-[18px] w-[18px]" /></button>
                <button className="icon-btn" onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`}><Pencil className="h-[18px] w-[18px]" /></button>
                <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(s)} aria-label={`Delete ${s.title}`}><Trash2 className="h-[18px] w-[18px]" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SopModal
        target={editing}
        existing={sops}
        onClose={() => setEditing(null)}
        onSave={async (sop) => {
          const next = editing === 'new' ? [...sops, sop] : sops.map((s) => (s.id === sop.id ? sop : s))
          if (await persist(next, editing === 'new' ? 'SOP added' : 'SOP updated')) setEditing(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={busy}
        title="Delete SOP?"
        confirmLabel="Delete"
        message={<><b>{toDelete?.code} – {toDelete?.title}</b> will be removed from the User Portal.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await persist(sops.filter((s) => s.id !== toDelete.id), 'SOP deleted'))) setToDelete(null)
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        danger
        loading={busy}
        title="Restore default SOPs?"
        confirmLabel="Restore"
        message="Your customised SOP list will be replaced by the six default procedures."
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          if (await persist(DEFAULT_SOPS, 'Default SOPs restored')) setConfirmReset(false)
        }}
      />
    </div>
  )
}

function SopModal({ target, existing, onClose, onSave }: { target: Sop | 'new' | null; existing: Sop[]; onClose: () => void; onSave: (s: Sop) => Promise<void> }) {
  const sop = target && target !== 'new' ? target : null
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('ClipboardList')
  const [summary, setSummary] = useState('')
  const [points, setPoints] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    setCode(sop?.code ?? `SOP ${String(existing.length + 1).padStart(2, '0')}`)
    setTitle(sop?.title ?? '')
    setIcon(sop?.icon ?? 'ClipboardList')
    setSummary(sop?.summary ?? '')
    setPoints(sop?.points.join('\n') ?? '')
    setErr(null)
  }, [target, sop, existing.length])

  const submit = async () => {
    const pts = points.split('\n').map((p) => p.trim()).filter(Boolean)
    if (!code.trim() || !title.trim()) return setErr('Code and title are required.')
    if (pts.length === 0) return setErr('Add at least one procedure point (one per line).')
    setErr(null)
    setSaving(true)
    await onSave({
      id: sop?.id ?? `sop-${Date.now().toString(36)}`,
      code: code.trim(),
      title: title.trim(),
      icon,
      summary: summary.trim(),
      points: pts,
    })
    setSaving(false)
  }

  const Preview = getIcon(icon)

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      size="lg"
      title={sop ? 'Edit SOP' : 'Add SOP'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {sop ? 'Save changes' : 'Add SOP'}</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code" required htmlFor="sop-code"><input id="sop-code" className="input" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="Title" required htmlFor="sop-title" className="sm:col-span-2"><input id="sop-title" className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Short summary" htmlFor="sop-sum" className="sm:col-span-3"><input id="sop-sum" className="input" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} /></Field>
        <Field label="Icon" htmlFor="sop-icon" className="sm:col-span-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-300 to-primary-600 text-white"><Preview className="h-5 w-5" /></div>
            <select id="sop-icon" className="input" value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Procedure points" required htmlFor="sop-points" hint="One point per line." className="sm:col-span-3">
          <textarea id="sop-points" rows={7} className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
        </Field>
      </div>
      {err && <p className="mt-3 text-sm font-medium text-red-600" role="alert">{err}</p>}
    </Modal>
  )
}
