import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Loader2, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, errMsg } from '../lib/utils'
import { Field } from './ui'

interface Values {
  current: string
  password: string
  confirm: string
}

function strength(p: string) {
  let s = 0
  if (p.length >= 10) s++
  if (p.length >= 14) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(s, 4)
}
const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']

/**
 * `forced` = the first-login flow (initial password must be replaced; verified server-side).
 * Otherwise the current password is re-checked before it can be changed.
 */
export default function PasswordForm({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const { user, refreshProfile } = useAuth()
  const { register, handleSubmit, watch, reset, formState } = useForm<Values>({ defaultValues: { current: '', password: '', confirm: '' } })
  const { errors } = formState
  const [busy, setBusy] = useState(false)
  const pw = watch('password')
  const score = strength(pw ?? '')

  const onSubmit = handleSubmit(async (v) => {
    setBusy(true)
    try {
      if (!forced) {
        const { error } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: v.current })
        if (error) throw new Error('Your current password is incorrect')
      }
      const { error } = await supabase.auth.updateUser({ password: v.password })
      if (error) throw error
      if (forced) {
        const { error: rpcErr } = await supabase.rpc('complete_password_change')
        if (rpcErr) throw rpcErr
        await refreshProfile()
      }
      toast.success('Password updated')
      reset()
      onDone?.()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {!forced && (
        <Field label="Current password" required htmlFor="current" error={errors.current?.message}>
          <input id="current" type="password" autoComplete="current-password" className={cn('input', errors.current && 'input-error')}
            {...register('current', { required: 'Enter your current password' })} />
        </Field>
      )}
      <Field label="New password" required htmlFor="password" error={errors.password?.message}
        hint="At least 10 characters with upper & lower case letters, a number and a symbol.">
        <input id="password" type="password" autoComplete="new-password" className={cn('input', errors.password && 'input-error')}
          {...register('password', {
            required: 'Enter a new password',
            minLength: { value: 10, message: 'Use at least 10 characters' },
            validate: (v) =>
              (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)) ||
              'Include upper & lower case letters, a number and a symbol',
          })} />
        {pw && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn('h-1.5 flex-1 rounded-full', i < score ? COLORS[score] : 'bg-silver-200')} />
              ))}
            </div>
            <span className="text-xs font-semibold text-ink-soft">{LABELS[score]}</span>
          </div>
        )}
      </Field>
      <Field label="Confirm new password" required htmlFor="confirm" error={errors.confirm?.message}>
        <input id="confirm" type="password" autoComplete="new-password" className={cn('input', errors.confirm && 'input-error')}
          {...register('confirm', { required: 'Confirm your new password', validate: (v) => v === watch('password') || 'Passwords do not match' })} />
      </Field>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {forced ? 'Set new password & continue' : 'Update password'}
      </button>
    </form>
  )
}
