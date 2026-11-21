import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import PasswordForm from '../../components/PasswordForm'
import { Logo } from '../../components/ui'

/** First-login screen: the provisioned initial password must be replaced before any admin access is granted. */
export default function ChangePassword() {
  const { signOut } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md p-6 sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo url={settings.company_logo_url} name={settings.site_name} size={52} />
          <h1 className="mt-4 text-2xl font-extrabold">Set a new password</h1>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>You are signed in with the initial password. For security, choose a new one before using the admin portal.</p>
          </div>
        </div>
        <PasswordForm forced onDone={() => navigate('/admin', { replace: true })} />
        <button
          className="btn-ghost mt-5 w-full"
          onClick={async () => {
            await signOut()
            toast('Signed out')
            navigate('/admin/login', { replace: true })
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  )
}
