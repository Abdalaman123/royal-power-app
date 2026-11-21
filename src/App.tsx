import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RouteSeo } from './components/Seo'
import { isConfigured } from './lib/supabase'
import SetupNotice from './components/SetupNotice'
import UserLayout from './components/UserLayout'
import AdminLayout from './components/AdminLayout'
import AdminGuard from './components/AdminGuard'
import { FullPageLoader } from './components/ui'

import Home from './pages/Home'
import CreateRequest from './pages/CreateRequest'
import EquipmentCatalog from './pages/EquipmentCatalog'
import Sops from './pages/Sops'
import TrackRequest from './pages/TrackRequest'
import About from './pages/About'
import AdminLogin from './pages/AdminLogin'
import ChangePassword from './pages/admin/ChangePassword'

// Admin pages (and the heavy chart library) are code-split away from the public portal.
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const TicketsPage = lazy(() => import('./pages/admin/Tickets'))
const EquipmentManagement = lazy(() => import('./pages/admin/EquipmentManagement'))
const Inventory = lazy(() => import('./pages/admin/Inventory'))
const OfficeUsers = lazy(() => import('./pages/admin/OfficeUsers'))
const Categories = lazy(() => import('./pages/admin/Categories'))
const Departments = lazy(() => import('./pages/admin/Departments'))
const SopLibrary = lazy(() => import('./pages/admin/SopLibrary'))
const Notifications = lazy(() => import('./pages/admin/Notifications'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))

export default function App() {
  if (!isConfigured) return <SetupNotice />

  return (
    <Suspense fallback={<FullPageLoader />}>
      <RouteSeo />
      <Routes>
        {/* ---------- User portal ---------- */}
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="request/new" element={<CreateRequest />} />
          <Route path="catalog" element={<EquipmentCatalog />} />
          <Route path="sops" element={<Sops />} />
          <Route path="track" element={<TrackRequest />} />
          <Route path="about" element={<About />} />
          <Route path="admin/login" element={<AdminLogin />} />
        </Route>

        {/* ---------- Forced first-login password change ---------- */}
        <Route element={<AdminGuard allowPasswordChange />}>
          <Route path="admin/change-password" element={<ChangePassword />} />
        </Route>

        {/* ---------- Admin portal (role protected) ---------- */}
        <Route element={<AdminGuard />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<TicketsPage key="all" title="All Tickets" subtitle="Every request submitted through the portal." />} />
            <Route path="tickets/pending" element={<TicketsPage key="pending" fixedStatus="pending" title="Pending Tickets" subtitle="Waiting for IT review." />} />
            <Route path="tickets/in-progress" element={<TicketsPage key="in_progress" fixedStatus="in_progress" title="In Progress" subtitle="Currently being handled by the IT team." />} />
            <Route path="tickets/resolved" element={<TicketsPage key="resolved" fixedStatus="resolved" title="Resolved Tickets" subtitle="Completed requests." />} />
            <Route path="tickets/cancelled" element={<TicketsPage key="cancelled" fixedStatus="cancelled" title="Cancelled Tickets" subtitle="Requests that were cancelled." />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="users" element={<OfficeUsers />} />
            <Route path="equipment" element={<EquipmentManagement />} />
            <Route path="categories" element={<Categories />} />
            <Route path="departments" element={<Departments />} />
            <Route path="sops" element={<SopLibrary />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
