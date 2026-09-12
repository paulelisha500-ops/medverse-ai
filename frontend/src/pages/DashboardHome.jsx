import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'

export default function DashboardHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    client
      .get('/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title={`Welcome, ${firstName(user.full_name)}`}
        subtitle={roleSubtitle(user.role)}
      />

      {loading && <div className="readout-label">Loading dashboard…</div>}

      {!loading && error && (
        <div className="card p-5 text-sm text-muted">
          Couldn't load your dashboard stats. Please refresh the page.
        </div>
      )}

      {!loading && !error && stats?.role === 'admin' && <AdminView stats={stats} />}
      {!loading && !error && stats?.role === 'doctor' && <DoctorView stats={stats} />}
      {!loading && !error && stats?.role === 'patient' && <PatientView stats={stats} />}
    </div>
  )
}

function firstName(fullName) {
  const parts = fullName.trim().split(' ')
  const first = parts[0].endsWith('.') && parts.length > 1 ? parts[1] : parts[0]
  return first
}

function roleSubtitle(role) {
  if (role === 'admin') return 'Platform-wide overview.'
  if (role === 'doctor') return "Here's what's happening across your patients."
  return 'Your health at a glance.'
}

function AdminView({ stats }) {
  const chartData = (stats.records_by_type || []).map((r) => ({ name: r.type, count: r.count }))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Patients" value={stats.total_patients} />
        <StatCard label="Doctors" value={stats.total_doctors} />
        <StatCard label="Assistant chats" value={stats.total_chats} />
        <StatCard label="Reports analyzed" value={stats.total_reports_analyzed} />
      </div>

      {chartData.length > 0 && (
        <div className="card p-5">
          <div className="readout-label mb-4">Medical record entries by type</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBD9D3" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#7C6167' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7C6167' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#EBD9D3' }} />
              <Bar dataKey="count" fill="#A32E35" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function DoctorView({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Total patients" value={stats.total_patients} />
      <StatCard label="Your assistant queries" value={stats.total_chats} />
      <StatCard label="Reports analyzed" value={stats.total_reports_analyzed} />
      <Link to="/patients" className="card flex flex-col justify-between p-5 hover:border-pulse">
        <div className="readout-label">Quick action</div>
        <div className="mt-2 font-display text-lg font-medium text-ink">Review patients →</div>
      </Link>
    </div>
  )
}

function PatientView({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Record entries" value={stats.record_count} />
      <StatCard label="Assistant chats" value={stats.total_chats} />
      <StatCard label="Reports analyzed" value={stats.total_reports_analyzed} />
      <div className="card p-5">
        <div className="readout-label">Last risk check</div>
        {stats.last_risk_assessment ? (
          <div className="mt-2 font-mono text-sm text-ink">
            Diabetes {stats.last_risk_assessment.diabetes_risk_pct}% · Heart{' '}
            {stats.last_risk_assessment.heart_disease_risk_pct}%
          </div>
        ) : (
          <Link to="/risk-check" className="mt-2 block text-sm font-medium text-pulse-dark underline">
            Run your first check →
          </Link>
        )}
      </div>
    </div>
  )
}
