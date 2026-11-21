import type { Priority, TicketStatus } from './types'

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} d ago`
  return formatDate(iso)
}

export const STATUSES: TicketStatus[] = ['pending', 'in_progress', 'resolved', 'cancelled']
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']

export const STATUS_META: Record<TicketStatus, { label: string; badge: string; dot: string; color: string }> = {
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', color: '#F59E0B' },
  in_progress: { label: 'In Progress', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', color: '#38BDF8' },
  resolved: { label: 'Resolved', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', color: '#22C55E' },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', color: '#94A3B8' },
}

export const PRIORITY_META: Record<Priority, { label: string; badge: string; color: string; hint: string }> = {
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-600 ring-slate-200', color: '#94A3B8', hint: 'Can wait; no impact on work' },
  medium: { label: 'Medium', badge: 'bg-sky-50 text-sky-700 ring-sky-200', color: '#38BDF8', hint: 'Needed soon; workaround exists' },
  high: { label: 'High', badge: 'bg-orange-50 text-orange-700 ring-orange-200', color: '#F97316', hint: 'Slowing down daily work' },
  critical: { label: 'Critical', badge: 'bg-red-50 text-red-700 ring-red-200', color: '#EF4444', hint: 'Work is blocked right now' },
}

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return 'Something went wrong. Please try again.'
}

/** Strip characters that have special meaning inside PostgREST `or()` / `ilike` filters. */
export const sanitizeSearch = (s: string) => s.replace(/[,()%*\\_]/g, ' ').trim()

export const slugFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** CSV with quote escaping and spreadsheet-formula injection protection. */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
