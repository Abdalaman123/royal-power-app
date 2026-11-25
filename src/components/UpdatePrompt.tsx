import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { Download, Loader2, Sparkles } from 'lucide-react'
import { fetchLatestRelease, installedVersion, isNewer, type LatestRelease } from '../lib/appUpdate'

const RECHECK_MS = 30 * 60 * 1000

/**
 * Android app: every time the app is opened (and when it comes back to the foreground) it asks GitHub for the
 * newest published release. If it is newer than this build, a pop-up offers the update.
 * The Windows app does the same natively (electron/main.cjs); the website itself is always current.
 */
export function UpdatePrompt() {
  const [latest, setLatest] = useState<LatestRelease | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || installedVersion() === '0.0.0') return
    let last = 0
    let live = true
    const check = async () => {
      if (Date.now() - last < RECHECK_MS && last !== 0) return
      last = Date.now()
      const r = await fetchLatestRelease()
      if (live && r && r.apkUrl && isNewer(r.version, installedVersion())) {
        setLatest(r)
        setDismissed(false)
      }
    }
    void check()
    const onVisible = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!latest || dismissed) return null

  const update = () => {
    if (!latest.apkUrl) return
    setBusy(true)
    // opens the system browser, which downloads the APK; the user then taps the file and "Install"
    window.open(latest.apkUrl, '_blank')
    setTimeout(() => setBusy(false), 4000)
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Update available">
      <div className="glass w-full max-w-sm space-y-4 p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white">
          <Sparkles className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold">New update available</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Version {latest.version} is ready (you have {installedVersion()}). Update now to get the latest changes.
          </p>
        </div>
        <ol className="rounded-xl bg-primary-50/70 p-3 text-left text-xs text-ink-soft">
          <li>1. Tap <b>Update now</b> – the file downloads.</li>
          <li>2. Open the downloaded file and tap <b>Install</b> (allow “unknown apps” if asked).</li>
          <li>3. Open ROYAL POWER again – your data is kept.</li>
        </ol>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setDismissed(true)}>Later</button>
          <button className="btn-primary flex-1" onClick={update} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Update now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
