import { useEffect, useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'

/** GitHub repository that hosts the releases (owner/name). Override with VITE_GITHUB_REPO. */
const REPO = (import.meta.env.VITE_GITHUB_REPO as string | undefined) || 'Abdalaman123/royal-power-app'
const LATEST = `https://github.com/${REPO}/releases/latest/download`

/** Always points at the newest release, so the link never goes stale. */
const DEFAULT_WINDOWS = (import.meta.env.VITE_DESKTOP_APP_URL as string | undefined) || `${LATEST}/ROYAL-POWER-Setup.exe`
const DEFAULT_ANDROID = (import.meta.env.VITE_ANDROID_APP_URL as string | undefined) || `${LATEST}/ROYAL-POWER.apk`

export type DownloadTarget = 'android' | 'windows'

/** True inside the Windows (Electron) or Android (Capacitor) app – no download buttons are shown there. */
export function isInstalledApp(): boolean {
  if (typeof navigator === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return /Electron/i.test(navigator.userAgent) || Boolean(cap?.isNativePlatform?.())
}

/**
 * Phones (Android user-agent, or any screen narrower than 768 px) get the Android app;
 * laptops / desktops get the Windows app; iPhones and iPads get nothing (no iOS app).
 */
function detect(): DownloadTarget | null {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return null
  if (/Android/i.test(ua)) return 'android'
  return window.matchMedia('(max-width: 767px)').matches ? 'android' : 'windows'
}

/**
 * Asks GitHub which release really contains the installer files and returns their direct download links.
 * Skips releases that are drafts or that have no APK/EXE yet (e.g. a build still running or failed), so the
 * button never lands on an empty GitHub page when an older build exists.
 */
interface Assets { windows?: string; android?: string; resolved: boolean }
let cache: Promise<Assets> | null = null

function loadAssets(): Promise<Assets> {
  if (cache) return cache
  cache = (async (): Promise<Assets> => {
    try {
      const cached = sessionStorage.getItem('rp_assets')
      if (cached) return JSON.parse(cached) as Assets
    } catch { /* storage unavailable */ }
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, { headers: { Accept: 'application/vnd.github+json' } })
      if (!res.ok) return { resolved: false }
      const releases = (await res.json()) as { draft: boolean; assets: { name: string; browser_download_url: string }[] }[]
      const out: Assets = { resolved: true }
      for (const r of releases) {
        if (r.draft) continue
        for (const a of r.assets ?? []) {
          if (!out.android && /\.apk$/i.test(a.name)) out.android = a.browser_download_url
          if (!out.windows && /\.exe$/i.test(a.name)) out.windows = a.browser_download_url
        }
        if (out.android && out.windows) break
      }
      try { sessionStorage.setItem('rp_assets', JSON.stringify(out)) } catch { /* ignore */ }
      return out
    } catch {
      return { resolved: false }
    }
  })()
  return cache
}

export interface DownloadInfo {
  target: DownloadTarget
  url: string
  /** "Android" | "Windows" */
  label: string
}

export function useDownload(): DownloadInfo | null {
  const { settings } = useSettings()
  const [target, setTarget] = useState<DownloadTarget | null>(detect)
  const [assets, setAssets] = useState<Assets | null>(null)

  useEffect(() => {
    let live = true
    void loadAssets().then((a) => live && setAssets(a))
    return () => { live = false }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setTarget(detect())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  if (!target || isInstalledApp()) return null
  // 1) a link typed by the admin in Settings wins, 2) otherwise the real file found on GitHub, 3) otherwise the "latest" link
  const found = target === 'android' ? assets?.android : assets?.windows
  const typed = (target === 'android' ? settings.android_app_url : settings.desktop_app_url)?.trim()
  // only a direct file link counts – a GitHub "releases" web page would just open the page instead of downloading
  const manual = typed && (target === 'android' ? /\.apk(\?.*)?$/i : /\.exe(\?.*)?$/i).test(typed) ? typed : ''
  const url = manual || found || (target === 'android' ? DEFAULT_ANDROID : DEFAULT_WINDOWS)
  return { target, url, label: target === 'android' ? 'Android' : 'Windows' }
}
