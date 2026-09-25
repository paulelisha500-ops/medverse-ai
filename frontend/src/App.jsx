import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'

import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import DashboardHome from './pages/DashboardHome.jsx'
import Assistant from './pages/Assistant.jsx'
import Reports from './pages/Reports.jsx'
import RiskCheck from './pages/RiskCheck.jsx'
import Medications from './pages/Medications.jsx'
import Patients from './pages/Patients.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import Profile from './pages/Profile.jsx'
import Appointments from './pages/Appointments.jsx'
import Reminders from './pages/Reminders.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
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
  )
}
