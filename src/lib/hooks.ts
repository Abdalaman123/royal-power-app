import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Category, Department, EquipmentItem } from './types'
import { errMsg } from './utils'

/** Re-run `onChange` (debounced) whenever any of the given tables change in the database. */
export function useRealtime(tables: string[], onChange: () => void) {
  const cb = useRef(onChange)
  cb.current = onChange
  const key = tables.join(',')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase.channel(`rt-${key}-${Math.random().toString(36).slice(2)}`)
    key.split(',').forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => cb.current(), 250)
      })
    })
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [key])
}

/**
 * Live catalog: departments, categories and items. Public pages only see active rows;
 * admin pages pass `all = true` to include inactive ones (RLS allows this for admins only).
 */
export function useCatalog(all = false) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      let d = supabase.from('departments').select('*').order('sort_order').order('name')
      let c = supabase.from('equipment_categories').select('*').order('sort_order').order('name')
      let i = supabase.from('equipment_items').select('*').order('sort_order').order('name')
      if (!all) {
        d = d.eq('is_active', true)
        c = c.eq('is_active', true)
        i = i.eq('is_active', true)
      }
      const [dr, cr, ir] = await Promise.all([d, c, i])
      const failure = dr.error || cr.error || ir.error
      if (failure) throw failure
      setDepartments((dr.data ?? []) as Department[])
      setCategories((cr.data ?? []) as Category[])
      setItems((ir.data ?? []) as EquipmentItem[])
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [all])

  useEffect(() => {
    void load()
  }, [load])

  useRealtime(['departments', 'equipment_categories', 'equipment_items'], load)

  return { departments, categories, items, loading, error, reload: load }
}
