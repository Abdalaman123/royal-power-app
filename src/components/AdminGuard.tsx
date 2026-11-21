import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FullPageLoader } from './ui'

/**
 * Client-side gate for the admin portal. This is a UX layer only: the real
 * enforcement is Row Level Security in the database (public.is_admin()).
 */
export default function AdminGuard({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const { session, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader label="Checking your access…" />
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) return <Navigate to="/admin/login" replace state={{ denied: true }} />

  const mustChange = Boolean(profile?.must_change_password)
  if (mustChange && !allowPasswordChange) return <Navigate to="/admin/change-password" replace />
  if (!mustChange && allowPasswordChange) return <Navigate to="/admin" replace />

  return <Outlet />
}
