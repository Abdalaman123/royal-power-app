import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useRealtime } from './hooks'
import type { AssignmentWithUser, Category, EquipmentItem, OfficeUser } from './types'
import { errMsg, formatDateTime } from './utils'
import type { Cell, SheetDef } from './xlsx'

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

/** PostgREST returns at most 1000 rows per request, so page through until everything is loaded. */
async function fetchAll<T>(page: (from: number, to: number) => Page): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const HOLDER_COLUMNS = '*, office_users(employee_id, full_name, department_name, designation, email, phone)'

/** Live inventory data: catalog, stock totals, active assignments and office users. */
export function useInventory() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [stock, setStock] = useState<Map<string, number>>(new Map())
  const [assignments, setAssignments] = useState<AssignmentWithUser[]>([])
  const [users, setUsers] = useState<OfficeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, i, s, a, u] = await Promise.all([
        fetchAll<Category>((x, y) => supabase.from('equipment_categories').select('*').order('sort_order').order('name').order('id').range(x, y)),
        fetchAll<EquipmentItem>((x, y) => supabase.from('equipment_items').select('*').order('sort_order').order('name').order('id').range(x, y)),
        fetchAll<{ item_id: string; total_quantity: number }>((x, y) => supabase.from('equipment_stock').select('item_id,total_quantity').order('item_id').range(x, y)),
        fetchAll<AssignmentWithUser>((x, y) =>
          supabase.from('equipment_assignments').select(HOLDER_COLUMNS).eq('status', 'assigned').order('assigned_at', { ascending: false }).order('id').range(x, y),
        ),
        fetchAll<OfficeUser>((x, y) => supabase.from('office_users').select('*').order('full_name').order('id').range(x, y)),
      ])
      setCategories(c)
      setItems(i)
      setStock(new Map(s.map((r) => [r.item_id, r.total_quantity])))
      setAssignments(a)
      setUsers(u)
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtime(['equipment_categories', 'equipment_items', 'equipment_stock', 'equipment_assignments', 'office_users'], load)

  return { categories, items, stock, assignments, users, loading, error, reload: load }
}

export interface InventoryLine {
  item: EquipmentItem
  categoryId: string
  category: string
  total: number
  assigned: number
  /** units still in the store / backup */
  available: number
  holders: AssignmentWithUser[]
}

export function buildLines(categories: Category[], items: EquipmentItem[], stock: Map<string, number>, assignments: AssignmentWithUser[]): InventoryLine[] {
  const catIndex = new Map(categories.map((c, i) => [c.id, i]))
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const holders = new Map<string, AssignmentWithUser[]>()
  for (const a of assignments) {
    if (!a.item_id) continue
    const list = holders.get(a.item_id)
    if (list) list.push(a)
    else holders.set(a.item_id, [a])
  }
  return items
    .map((item) => {
      const h = holders.get(item.id) ?? []
      const assigned = h.reduce((n, a) => n + a.quantity, 0)
      const total = stock.get(item.id) ?? 0
      return {
        item,
        categoryId: item.category_id,
        category: catName.get(item.category_id) ?? 'Uncategorised',
        total,
        assigned,
        available: Math.max(0, total - assigned),
        holders: h,
      }
    })
    .sort((a, b) => (catIndex.get(a.categoryId) ?? 999) - (catIndex.get(b.categoryId) ?? 999))
}

export const holderLabel = (a: AssignmentWithUser) =>
  `${a.office_users?.full_name ?? 'Unknown user'} (${a.office_users?.employee_id ?? '-'}) x${a.quantity}`

function statusText(l: InventoryLine) {
  if (l.total === 0) return 'No stock recorded'
  if (l.available === 0) return 'All assigned'
  if (l.assigned === 0) return 'All in backup'
  return 'Partly assigned'
}

/** Workbook: Summary + one sheet per category + full assignment list. */
export function inventorySheets(categories: Category[], lines: InventoryLine[], assignments: AssignmentWithUser[]): SheetDef[] {
  const head: Cell[] = ['Category', 'Equipment', 'Total Stock', 'Assigned', 'Available (Backup)', 'Status', 'Assigned To']
  const row = (l: InventoryLine): Cell[] => [l.category, l.item.name, l.total, l.assigned, l.available, statusText(l), l.holders.map(holderLabel).join('; ')]

  const sum = (f: (l: InventoryLine) => number) => lines.reduce((n, l) => n + f(l), 0)
  const summary: SheetDef = {
    name: 'Summary',
    rows: [head, ...lines.map(row), ['TOTAL', '', sum((l) => l.total), sum((l) => l.assigned), sum((l) => l.available), '', '']],
    widths: [28, 30, 13, 11, 19, 20, 70],
  }

  const perCategory: SheetDef[] = categories
    .map((c) => ({ c, rows: lines.filter((l) => l.categoryId === c.id) }))
    .filter((x) => x.rows.length > 0)
    .map(({ c, rows }) => ({
      name: c.name,
      rows: [
        ['Equipment', 'Total Stock', 'Assigned', 'Available (Backup)', 'Status', 'Assigned To'] as Cell[],
        ...rows.map((l): Cell[] => [l.item.name, l.total, l.assigned, l.available, statusText(l), l.holders.map(holderLabel).join('; ')]),
        ['TOTAL', rows.reduce((n, l) => n + l.total, 0), rows.reduce((n, l) => n + l.assigned, 0), rows.reduce((n, l) => n + l.available, 0), '', ''] as Cell[],
      ],
      widths: [30, 13, 11, 19, 20, 70],
    }))

  const assigned: SheetDef = {
    name: 'Assigned Equipment',
    rows: [
      ['Employee ID', 'Name', 'Department', 'Designation', 'Email', 'Phone', 'Category', 'Equipment', 'Qty', 'Serial No', 'Asset Tag', 'Ticket', 'Assigned On', 'Assigned By', 'Notes'],
      ...assignments.map((a): Cell[] => [
        a.office_users?.employee_id, a.office_users?.full_name, a.office_users?.department_name, a.office_users?.designation,
        a.office_users?.email, a.office_users?.phone, a.category_name, a.item_name, a.quantity,
        a.serial_no, a.asset_tag, a.ticket_no, formatDateTime(a.assigned_at), a.assigned_by_name, a.notes,
      ]),
    ],
  }

  return [summary, ...perCategory, assigned]
}

export const todayStamp = () => new Date().toISOString().slice(0, 10)

export function useUserLookup(users: OfficeUser[]) {
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
}
