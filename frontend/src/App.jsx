import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import { pageLoaders } from './pageLoaders.js'

// Each page loads as its own chunk on first visit instead of all being
// bundled into one script the browser has to download and parse before
// anything renders. A logged-in doctor never fetches the Landing page's
// marketing content; a visitor on the landing page never fetches Recharts
// (only used in the admin dashboard chart) or any of the authenticated
// pages. Vite/Rollup splits automatically on dynamic import() — no config
// needed beyond this. Layout.jsx prefetches these same chunks on nav-link
// hover, so by the time a click lands the page is usually already cached.
const Landing = lazy(pageLoaders.landing)
const Login = lazy(pageLoaders.login)
const Register = lazy(pageLoaders.register)
const DashboardHome = lazy(pageLoaders.dashboard)
const Assistant = lazy(pageLoaders.assistant)
const Reports = lazy(pageLoaders.reports)
const RiskCheck = lazy(pageLoaders.riskCheck)
const Medications = lazy(pageLoaders.medications)
const Patients = lazy(pageLoaders.patients)
const PatientDetail = lazy(pageLoaders.patientDetail)
const Profile = lazy(pageLoaders.profile)
const Appointments = lazy(pageLoaders.appointments)
const Reminders = lazy(pageLoaders.reminders)
const NotFound = lazy(pageLoaders.notFound)

function PageFallback() {
  // Matches ProtectedRoute's own loading state so a chunk fetch never looks
  // different from the auth check that usually precedes it.
  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <div className="readout-label">Loading…</div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* The landing page lived here while the dashboard held "/". Kept as a
            redirect so existing links don't 404. */}
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/risk-check" element={<RiskCheck />} />
          <Route path="/medications" element={<Medications />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route
            path="/reminders"
            element={
              <ProtectedRoute roles={['patient']}>
                <Reminders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute roles={['admin', 'doctor']}>
                <Patients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients/:id"
            element={
              <ProtectedRoute roles={['admin', 'doctor']}>
                <PatientDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
