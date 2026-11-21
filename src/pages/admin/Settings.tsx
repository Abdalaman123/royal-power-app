import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Bell, Building2, ImagePlus, KeyRound, Layers, Loader2, Settings2, Trash2, UserCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { PRIORITIES, PRIORITY_META, errMsg } from '../../lib/utils'
import type { Priority, Profile } from '../../lib/types'
import { Field, Logo, PageHeader, Switch } from '../../components/ui'
import PasswordForm from '../../components/PasswordForm'
import { isSoundOn, playNotificationSound, setSoundOn } from '../../lib/sound'
import type { ReactNode } from 'react'

function Section({ icon: Icon, title, desc, children }: { icon: typeof Bell; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="glass p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-300 to-primary-600 text-white shadow-md"><Icon className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {desc && <p className="text-sm text-ink-soft">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

async function saveSettings(rows: { key: string; value: unknown; is_public: boolean }[]) {
  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

export default function AdminSettings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Branding, support details, ticket rules, your profile and preferences." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <BrandingSection />
          <TicketSection />
          <ShortcutsSection />
        </div>
        <div className="space-y-6">
          <ProfileSection />
          <NotificationSection />
          <Section icon={KeyRound} title="Password" desc="Change your admin password.">
            <PasswordForm />
          </Section>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Branding / website / support ---------------- */
function BrandingSection() {
  const { settings, refresh } = useSettings()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { site_name: '', tagline: '', support_email: '', support_phone: '', support_hours: '', support_location: '', desktop_app_url: '', android_app_url: '' },
  })

  useEffect(() => {
    reset({
      site_name: settings.site_name, tagline: settings.tagline, support_email: settings.support_email,
      support_phone: settings.support_phone, support_hours: settings.support_hours, support_location: settings.support_location,
      desktop_app_url: settings.desktop_app_url, android_app_url: settings.android_app_url,
    })
  }, [settings, reset])

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true)
    try {
      await saveSettings(Object.entries(v).map(([key, value]) => ({ key, value: value.trim(), is_public: true })))
      await refresh()
      toast.success('Website settings saved')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  })

  const setLogo = async (url: string) => {
    await saveSettings([{ key: 'company_logo_url', value: url, is_public: true }])
    await refresh()
  }

  const upload = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return void toast.error('Use a PNG, JPG or WebP image')
    if (file.size > 2 * 1024 * 1024) return void toast.error('Logo must be 2 MB or smaller')
    setUploading(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type, cacheControl: '3600' })
      if (error) throw error
      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      await setLogo(data.publicUrl)
      toast.success('Logo updated')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Section icon={Building2} title="Website & support details" desc="Shown in the header, footer and support section of the User Portal.">
      <div className="mb-5 flex items-center gap-4">
        <Logo url={settings.company_logo_url} name={settings.site_name} size={64} />
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="logo-file" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <label htmlFor="logo-file" className="btn-secondary cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload logo
          </label>
          {settings.company_logo_url && (
            <button className="btn-ghost" onClick={() => void setLogo('').then(() => toast.success('Logo removed'))}><Trash2 className="h-4 w-4" /> Remove</button>
          )}
        </div>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Website name" required htmlFor="s-name" error={formState.errors.site_name?.message}>
          <input id="s-name" className="input" maxLength={60} {...register('site_name', { required: 'Website name is required' })} />
        </Field>
        <Field label="Tagline" htmlFor="s-tag"><input id="s-tag" className="input" maxLength={120} {...register('tagline')} /></Field>
        <Field label="Support email" htmlFor="s-mail" error={formState.errors.support_email?.message}>
          <input id="s-mail" type="email" className="input" {...register('support_email', { pattern: { value: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} />
        </Field>
        <Field label="Support phone" htmlFor="s-phone"><input id="s-phone" className="input" {...register('support_phone')} /></Field>
        <Field label="Support hours" htmlFor="s-hours"><input id="s-hours" className="input" {...register('support_hours')} /></Field>
        <Field label="Support location" htmlFor="s-loc"><input id="s-loc" className="input" {...register('support_location')} /></Field>
        <Field label="Windows app download link (optional)" htmlFor="s-app" className="sm:col-span-2" error={formState.errors.desktop_app_url?.message}
          hint="Leave EMPTY to always give users the newest installer from GitHub automatically. Only fill this to override it.">
          <input id="s-app" className="input" placeholder="https://github.com/…/ROYAL-POWER-Setup.exe" {...register('desktop_app_url', { pattern: { value: /^$|^(https?:\/\/|\/)\S+$/, message: 'Enter a full link (https://…) or a path starting with /' } })} />
        </Field>
        <Field label="Android app download link (optional)" htmlFor="s-apk" className="sm:col-span-2" error={formState.errors.android_app_url?.message}
          hint="Leave EMPTY to always give users the newest APK from GitHub automatically.">
          <input id="s-apk" className="input" placeholder="https://github.com/…/ROYAL-POWER.apk" {...register('android_app_url', { pattern: { value: /^$|^(https?:\/\/|\/)\S+$/, message: 'Enter a full link (https://…) or a path starting with /' } })} />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save website settings</button>
        </div>
      </form>
    </Section>
  )
}

/* ---------------- Ticket rules & system preferences ---------------- */
function TicketSection() {
  const { settings, refresh } = useSettings()
  const [prefix, setPrefix] = useState('RP')
  const [perPage, setPerPage] = useState(10)
  const [priority, setPriority] = useState<Priority>('medium')
  const [attachments, setAttachments] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPriority(settings.default_priority)
    setAttachments(settings.allow_attachments)
  }, [settings.default_priority, settings.allow_attachments])

  useEffect(() => {
    void supabase.from('system_settings').select('key,value').in('key', ['ticket_prefix', 'tickets_per_page']).then(({ data }) => {
      for (const r of (data ?? []) as { key: string; value: unknown }[]) {
        if (r.key === 'ticket_prefix' && typeof r.value === 'string') setPrefix(r.value)
        if (r.key === 'tickets_per_page' && typeof r.value === 'number') setPerPage(r.value)
      }
    })
  }, [])

  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const valid = clean.length >= 2 && clean.length <= 8

  const save = async () => {
    if (!valid) return void toast.error('Ticket prefix must be 2–8 letters or digits')
    setSaving(true)
    try {
      await saveSettings([
        { key: 'ticket_prefix', value: clean, is_public: false },
        { key: 'tickets_per_page', value: perPage, is_public: false },
        { key: 'default_priority', value: priority, is_public: true },
        { key: 'allow_attachments', value: attachments, is_public: true },
      ])
      setPrefix(clean)
      await refresh()
      toast.success('Ticket settings saved')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section icon={Settings2} title="Ticket & system preferences" desc="Applies to new requests; existing ticket numbers never change.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticket ID prefix" htmlFor="t-prefix" hint={`Next tickets look like ${valid ? clean : '??'}-${new Date().getFullYear()}-00001`} error={valid ? undefined : '2–8 letters or digits'}>
          <input id="t-prefix" className="input uppercase" value={prefix} maxLength={8} onChange={(e) => setPrefix(e.target.value)} />
        </Field>
        <Field label="Default request priority" htmlFor="t-prio">
          <select id="t-prio" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </Field>
        <Field label="Tickets per page (admin tables)" htmlFor="t-pp">
          <select id="t-pp" className="input" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div className="flex items-center gap-3 pt-6 text-sm font-semibold">
          <Switch checked={attachments} onChange={setAttachments} label="Allow attachments" /> Allow request attachments
        </div>
      </div>
      <button className="btn-primary mt-5" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save ticket settings</button>
    </Section>
  )
}

function ShortcutsSection() {
  return (
    <Section icon={Layers} title="Catalog configuration" desc="Equipment categories and departments are managed on their own pages.">
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/categories" className="btn-secondary">Equipment categories</Link>
        <Link to="/admin/equipment" className="btn-secondary">Equipment items</Link>
        <Link to="/admin/departments" className="btn-secondary">Departments</Link>
        <Link to="/admin/sops" className="btn-secondary">IT SOP library</Link>
      </div>
    </Section>
  )
}

/* ---------------- Admin profile ---------------- */
function ProfileSection() {
  const { profile, user, refreshProfile } = useAuth()
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: { full_name: '', designation: '', phone: '' } })

  useEffect(() => {
    reset({ full_name: profile?.full_name ?? '', designation: profile?.designation ?? '', phone: profile?.phone ?? '' })
  }, [profile, reset])

  const onSubmit = handleSubmit(async (v) => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: v.full_name.trim(), designation: v.designation.trim() || null, phone: v.phone.trim() || null })
      .eq('id', user?.id ?? '')
    if (error) return void toast.error(errMsg(error))
    await refreshProfile()
    toast.success('Profile updated')
  })

  return (
    <Section icon={UserCircle2} title="Admin profile">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Email" htmlFor="p-email" className="sm:col-span-2" hint="Sign-in email can't be changed here.">
          <input id="p-email" className="input" value={profile?.email ?? user?.email ?? ''} disabled readOnly />
        </Field>
        <Field label="Full name" required htmlFor="p-name" error={formState.errors.full_name?.message}>
          <input id="p-name" className="input" maxLength={80} {...register('full_name', { required: 'Name is required' })} />
        </Field>
        <Field label="Designation" htmlFor="p-des"><input id="p-des" className="input" maxLength={80} {...register('designation')} /></Field>
        <Field label="Phone" htmlFor="p-phone"><input id="p-phone" className="input" maxLength={30} {...register('phone')} /></Field>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={formState.isSubmitting}>{formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Save profile</button>
        </div>
      </form>
    </Section>
  )
}

/* ---------------- Notification preferences ---------------- */
const NOTIFY: { key: keyof Pick<Profile, 'notify_new_ticket' | 'notify_critical' | 'notify_updates' | 'notify_cancelled'>; label: string; hint: string }[] = [
  { key: 'notify_new_ticket', label: 'New ticket submitted', hint: 'Whenever an employee submits a request.' },
  { key: 'notify_critical', label: 'Critical priority ticket', hint: 'Requests marked Critical.' },
  { key: 'notify_updates', label: 'Ticket updated', hint: 'Status, assignment and remarks changes.' },
  { key: 'notify_cancelled', label: 'Ticket cancelled', hint: 'When a ticket is cancelled.' },
]

function NotificationSection() {
  const { profile, user, refreshProfile } = useAuth()
  const [sound, setSound] = useState(isSoundOn)

  const toggle = async (key: (typeof NOTIFY)[number]['key'], value: boolean) => {
    const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', user?.id ?? '')
    if (error) return void toast.error(errMsg(error))
    await refreshProfile()
    toast.success('Preference saved')
  }

  return (
    <Section icon={Bell} title="Notification preferences" desc="Choose which in-app notifications you receive.">
      <ul className="divide-y divide-silver-200/70">
        {NOTIFY.map((n) => (
          <li key={n.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="text-sm font-semibold">{n.label}</div>
              <div className="text-xs text-ink-soft">{n.hint}</div>
            </div>
            <Switch checked={profile?.[n.key] ?? true} label={n.label} onChange={(v) => void toggle(n.key, v)} />
          </li>
        ))}
        <li className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Notification sound</div>
              <div className="text-xs text-ink-soft">Plays a tone when a ticket arrives or changes (this device only).</div>
            </div>
            <Switch checked={sound} label="Notification sound" onChange={(v) => { setSound(v); setSoundOn(v); if (v) playNotificationSound('new', true) }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => playNotificationSound('new', true)}>Test: new ticket</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => playNotificationSound('critical', true)}>Test: critical</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => playNotificationSound('update', true)}>Test: update</button>
          </div>
        </li>
      </ul>
    </Section>
  )
}
