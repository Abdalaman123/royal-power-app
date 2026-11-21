/**
 * Notification sounds, synthesised with the Web Audio API (no audio files needed).
 * Browsers only allow sound after the user has interacted with the page once,
 * so `unlockAudio()` is wired to the first click / key press in the admin portal.
 */
export type SoundKind = 'new' | 'critical' | 'update'

const KEY = 'rp_sound'
let ctx: AudioContext | null = null

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* storage unavailable – preference simply isn't remembered */
  }
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

export function unlockAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

function tone(c: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

/** new = two-note "ding-dong", critical = urgent triple beep + high note, update = single soft ping. */
export function playNotificationSound(kind: SoundKind, force = false) {
  if (!force && !isSoundOn()) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const t = c.currentTime + 0.02
  if (kind === 'new') {
    tone(c, 880, t, 0.45, 0.3)
    tone(c, 1318.5, t + 0.2, 0.6, 0.3)
  } else if (kind === 'critical') {
    ;[0, 0.22, 0.44].forEach((d) => tone(c, 988, t + d, 0.18, 0.28, 'square'))
    tone(c, 1568, t + 0.7, 0.6, 0.3)
  } else {
    tone(c, 660, t, 0.5, 0.25)
  }
}

export const soundForType = (type: string): SoundKind =>
  type === 'critical_ticket' ? 'critical' : type === 'new_ticket' ? 'new' : 'update'
