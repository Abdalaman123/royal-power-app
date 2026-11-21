import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Field, Logo } from '../components/ui'
import { cn, errMsg } from '../lib/utils'

interface LoginValues {
  email: string
  password: string
}

export default function AdminLogin() {
  const { signIn, signOut, isAdmin, loading } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string; denied?: boolean } | null
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(state?.denied ? 'This account does not have administrator access.' : null)
  const { register, handleSubmit, formState } = useForm<LoginValues>({ defaultValues: { email: '', password: '' } })
  const { errors } = formState

  if (!loading && isAdmin && !busy) return <Navigate to="/admin" replace />

  const onSubmit = handleSubmit(async (v) => {
    setBusy(true)
    setError(null)
    try {
      const profile = await signIn(v.email, v.password)
      if (!profile || profile.role !== 'admin') {
        await signOut()
        setError('This account does not have administrator access.')
        return
      }
      if (profile.must_change_password) {
        toast('Please set a new password to continue', { icon: '🔐' })
        navigate('/admin/change-password', { replace: true })
      } else {
        toast.success('Welcome back!')
        navigate(state?.from && state.from.startsWith('/admin') ? state.from : '/admin', { replace: true })
      }
    } catch (e) {
      const m = errMsg(e)
      setError(/invalid login/i.test(m) ? 'Incorrect email or password.' : m)
    } finally {
      setBusy(false)
    }
  })

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-6">
      <div className="glass-strong p-6 sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo url={settings.company_logo_url} name={settings.site_name} size={56} />
          <h1 className="mt-4 text-2xl font-extrabold">Admin Login</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to the {settings.site_name} administration portal.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input id="email" type="email" autoComplete="username" className={cn('input pl-10', errors.email && 'input-error')} placeholder="admin@company.com"
                {...register('email', { required: 'Email is required' })} />
            </div>
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className={cn('input px-10', errors.password && 'input-error')}
                {...register('password', { required: 'Password is required' })} />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-faint hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Not an administrator? <Link to="/" className="font-semibold text-primary-700 hover:underline">Back to the user portal</Link>
        </p>
      </div>
    </div>
  )
}
