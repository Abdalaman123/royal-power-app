import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../lib/hooks'
import { DEFAULT_SOPS } from '../lib/sops'
import type { Priority, Sop } from '../lib/types'

export interface AppSettings {
  site_name: string
  tagline: string
  company_logo_url: string
  support_email: string
  support_phone: string
  support_hours: string
  support_location: string
  default_priority: Priority
  allow_attachments: boolean
  desktop_app_url: string
  android_app_url: string
  sops: Sop[]
}

/** Keys readable by anonymous visitors. Everything else stays admin-only. */
export const PUBLIC_SETTING_KEYS = new Set<string>([
  'site_name',
  'tagline',
  'company_logo_url',
  'support_email',
  'support_phone',
  'support_hours',
  'support_location',
  'default_priority',
  'allow_attachments',
  'desktop_app_url',
  'android_app_url',
  'sops',
])

const DEFAULTS: AppSettings = {
  site_name: 'ROYAL POWER',
  tagline: 'Smart IT Support & Asset Management',
  company_logo_url: '',
  support_email: 'it-support@royalpower.local',
  support_phone: '',
  support_hours: 'Mon – Fri, 9:00 AM – 6:00 PM',
  support_location: 'IT Helpdesk',
  default_priority: 'medium',
  allow_attachments: true,
  desktop_app_url: '',
  android_app_url: '',
  sops: DEFAULT_SOPS,
}

interface SettingsState {
  settings: AppSettings
  loading: boolean
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('key,value').eq('is_public', true)
    if (data) {
      const next: Record<string, unknown> = { ...DEFAULTS }
      for (const row of data as { key: string; value: unknown }[]) {
        if (row.key === 'sops') {
          if (Array.isArray(row.value) && row.value.length) next.sops = row.value
        } else if (row.value !== null && row.value !== undefined && row.value !== '') {
          next[row.key] = row.value
        } else if (row.key === 'company_logo_url') {
          next.company_logo_url = ''
        }
      }
      setSettings(next as unknown as AppSettings)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtime(['system_settings'], refresh)

  const value = useMemo(() => ({ settings, loading, refresh }), [settings, loading, refresh])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
