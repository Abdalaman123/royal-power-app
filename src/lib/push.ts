import { Capacitor, registerPlugin } from '@capacitor/core'
import { supabase } from './supabase'

/** Minimal typing of the native Capacitor "PushNotifications" plugin (it is installed in the Android build only). */
interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  createChannel(c: { id: string; name: string; description?: string; importance: 1 | 2 | 3 | 4 | 5; visibility?: -1 | 0 | 1; vibration?: boolean }): Promise<void>
  addListener(event: string, cb: (data: any) => void): Promise<{ remove: () => Promise<void> }>
}

const KEY = 'rp_push_token'
let started = false
let Push: PushPlugin | null = null

export const isNativeApp = () => Capacitor.isNativePlatform()

/** Called once an admin is signed in inside the Android app: asks permission, gets the token and saves it. */
export async function enablePush(onOpen: (path: string) => void): Promise<void> {
  if (!isNativeApp() || started) return
  started = true
  try {
    Push = registerPlugin<PushPlugin>('PushNotifications')
    await Push.createChannel({ id: 'tickets', name: 'Tickets', description: 'New and updated IT tickets', importance: 5, visibility: 1, vibration: true })

    await Push.addListener('registration', async (t: { value: string }) => {
      try {
        localStorage.setItem(KEY, t.value)
      } catch { /* ignore */ }
      await supabase.rpc('register_device', { p_token: t.value, p_platform: 'android' })
    })
    await Push.addListener('registrationError', (e) => console.warn('Push registration failed', e))
    await Push.addListener('pushNotificationActionPerformed', (a: { notification?: { data?: { type?: string } } }) => {
      onOpen('/admin/tickets')
      void a
    })

    let perm = await Push.checkPermissions()
    if (perm.receive !== 'granted') perm = await Push.requestPermissions()
    if (perm.receive === 'granted') await Push.register()
  } catch (e) {
    started = false
    console.warn('Push setup failed', e)
  }
}

/** Called on sign-out so this phone stops receiving that admin's alerts. */
export async function disablePush(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const t = localStorage.getItem(KEY)
    if (t) {
      await supabase.rpc('unregister_device', { p_token: t })
      localStorage.removeItem(KEY)
    }
  } catch { /* ignore */ }
  started = false
}
