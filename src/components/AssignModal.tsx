import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AssignmentWithUser, OfficeUser } from '../lib/types'
import type { InventoryLine } from '../lib/inventory'
import { errMsg, formatDate } from '../lib/utils'
import { Field, Modal } from './ui'

interface AssignProps {
  open: boolean
  onClose: () => void
  users: OfficeUser[]
  lines: InventoryLine[]
  presetItemId?: string
  presetUserId?: string
  onDone: () => void | Promise<void>
}

/** Issue equipment to an office user. Stock is checked again on the server (race-safe). */
export function AssignModal({ open, onClose, users, lines, presetItemId, presetUserId, onDone }: AssignProps) {
  const [userQ, setUserQ] = useState('')
  const [userId, setUserId] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [serial, setSerial] = useState('')
  const [asset, setAsset] = useState('')
  const [ticket, setTicket] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUserQ('')
    setUserId(presetUserId ?? '')
    setItemId(presetItemId ?? '')
    setQty(1)
    setSerial('')
    setAsset('')
    setTicket('')
    setNotes('')
    setErr(null)
  }, [open, presetItemId, presetUserId])

  const userOptions = useMemo(() => {
    const t = userQ.trim().toLowerCase()
    const active = users.filter((u) => u.is_active)
    const list = t ? active.filter((u) => `${u.full_name} ${u.employee_id} ${u.department_name ?? ''}`.toLowerCase().includes(t)) : active
    const cut = list.slice(0, 200)
    const chosen = users.find((u) => u.id === userId)
    if (chosen && !cut.some((u) => u.id === chosen.id)) cut.unshift(chosen)
    return cut
  }, [users, userQ, userId])

  const groups = useMemo(() => {
    const m = new Map<string, InventoryLine[]>()
    for (const l of lines) {
      const list = m.get(l.category)
      if (list) list.push(l)
      else m.set(l.category, [l])
    }
    return [...m.entries()]
  }, [lines])

  const selected = lines.find((l) => l.item.id === itemId)
  const max = selected?.available ?? 0

  const submit = async () => {
    if (!userId) return setErr('Choose the user who will receive the equipment.')
    if (!itemId) return setErr('Choose the equipment.')
    if (!Number.isInteger(qty) || qty < 1) return setErr('Quantity must be a whole number of at least 1.')
    if (qty > max) return setErr(max === 0 ? 'This item has no units available in stock.' : `Only ${max} unit(s) available in stock.`)
    setErr(null)
    setSaving(true)
    const { error } = await supabase.rpc('assign_equipment', {
      p_user: userId,
      p_item: itemId,
      p_qty: qty,
      p_serial: serial,
      p_asset_tag: asset,
      p_ticket_no: ticket,
      p_notes: notes,
    })
    setSaving(false)
    if (error) return setErr(errMsg(error))
    const who = users.find((u) => u.id === userId)?.full_name ?? 'user'
    toast.success(`Assigned ${qty} × ${selected?.item.name ?? 'item'} to ${who}`)
    await onDone()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assign equipment to user"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Assign
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Find user" htmlFor="as-find" className="sm:col-span-2" hint="Type a name, employee ID or department to filter the list.">
          <input id="as-find" className="input" value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Search users…" />
        </Field>
        <Field label="User" required htmlFor="as-user" className="sm:col-span-2">
          <select id="as-user" className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{userOptions.length ? 'Select user…' : 'No matching active users'}</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.employee_id} — {u.full_name}{u.department_name ? ` (${u.department_name})` : ''}{u.is_active ? '' : ' [inactive]'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Equipment" required htmlFor="as-item" className="sm:col-span-2">
          <select id="as-item" className="input" value={itemId} onChange={(e) => { setItemId(e.target.value); setQty(1) }}>
            <option value="">Select equipment…</option>
            {groups.map(([cat, ls]) => (
              <optgroup key={cat} label={cat}>
                {ls.map((l) => (
                  <option key={l.item.id} value={l.item.id} disabled={l.available < 1}>
                    {l.item.name} — {l.available} available
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Quantity" required htmlFor="as-qty" hint={selected ? `${selected.available} in backup stock` : undefined}>
          <input id="as-qty" type="number" min={1} max={Math.max(max, 1)} className="input" value={Number.isNaN(qty) ? '' : qty} onChange={(e) => setQty(e.target.valueAsNumber)} />
        </Field>
        <Field label="Ticket ID (optional)" htmlFor="as-ticket">
          <input id="as-ticket" className="input" value={ticket} maxLength={40} onChange={(e) => setTicket(e.target.value)} placeholder="RP-2026-00001" />
        </Field>
        <Field label="Serial number (optional)" htmlFor="as-serial">
          <input id="as-serial" className="input" value={serial} maxLength={80} onChange={(e) => setSerial(e.target.value)} />
        </Field>
        <Field label="Asset tag (optional)" htmlFor="as-asset">
          <input id="as-asset" className="input" value={asset} maxLength={80} onChange={(e) => setAsset(e.target.value)} />
        </Field>
        <Field label="Notes (optional)" htmlFor="as-notes" className="sm:col-span-2">
          <textarea id="as-notes" rows={2} className="input" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {err && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{err}</p>}
    </Modal>
  )
}

/** Take equipment back from a user (full or partial). Returned units go back to backup stock. */
export function ReturnModal({ assignment, onClose, onDone }: { assignment: AssignmentWithUser | null; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!assignment) return
    setQty(assignment.quantity)
    setNotes('')
    setErr(null)
  }, [assignment])

  const submit = async () => {
    if (!assignment) return
    if (!Number.isInteger(qty) || qty < 1 || qty > assignment.quantity) return setErr(`Enter a quantity between 1 and ${assignment.quantity}.`)
    setSaving(true)
    const { error } = await supabase.rpc('return_equipment', { p_assignment: assignment.id, p_qty: qty, p_notes: notes })
    setSaving(false)
    if (error) return setErr(errMsg(error))
    toast.success(`${qty} × ${assignment.item_name} returned to stock`)
    await onDone()
    onClose()
  }

  return (
    <Modal
      open={Boolean(assignment)}
      onClose={onClose}
      size="sm"
      title="Return equipment"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Mark as returned
          </button>
        </>
      }
    >
      {assignment && (
        <div className="space-y-4">
          <div className="rounded-xl bg-primary-50/70 p-3 text-sm">
            <div className="font-bold">{assignment.item_name} × {assignment.quantity}</div>
            <div className="text-ink-soft">
              {assignment.office_users?.full_name ?? 'Unknown user'} ({assignment.office_users?.employee_id ?? '-'}) · since {formatDate(assignment.assigned_at)}
            </div>
          </div>
          <Field label="Quantity returned" required htmlFor="rt-qty" hint={`Out of ${assignment.quantity} assigned`}>
            <input id="rt-qty" type="number" min={1} max={assignment.quantity} className="input" value={Number.isNaN(qty) ? '' : qty} onChange={(e) => setQty(e.target.valueAsNumber)} />
          </Field>
          <Field label="Return notes (optional)" htmlFor="rt-notes" hint="e.g. condition of the item">
            <textarea id="rt-notes" rows={2} className="input" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{err}</p>}
        </div>
      )}
    </Modal>
  )
}
