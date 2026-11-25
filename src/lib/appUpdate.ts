import { REPO } from './desktop'

/** Version baked into this build by CI ("1.0.14"). "0.0.0" = website or local dev (never prompts). */
export const installedVersion = (): string => __APP_VERSION__

export interface LatestRelease {
  version: string
  apkUrl: string | null
}

/** True when `a` is a higher release number than `b` (compares 1.0.9 < 1.0.14 correctly). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** The newest PUBLISHED release (drafts are invisible, so the files are guaranteed to exist). */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] }
    if (!json.tag_name) return null
    const apk = json.assets?.find((a) => /\.apk$/i.test(a.name))
    return { version: json.tag_name.replace(/^v/i, ''), apkUrl: apk?.browser_download_url ?? null }
  } catch {
    return null
  }
}
