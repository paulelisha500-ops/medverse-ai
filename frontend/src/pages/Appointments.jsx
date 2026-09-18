import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, Button, Field, inputClass, EmptyState, Badge } from '../components/ui.jsx'

const STATUS_TONE = {
  requested: 'moderate',
  confirmed: 'low',
  completed: 'low',
  cancelled: 'high',
}

export default function Appointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isStaff = user.role === 'admin' || user.role === 'doctor'

  const [form, setForm] = useState({ doctor_id: '', patient_id: '', scheduled_at: '', reason: '' })
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  function load() {
    setError(false)
    const requests = [client.get('/appointments'), client.get('/appointments/doctors')]
    if (isStaff) requests.push(client.get('/patients'))

    Promise.all(requests)
      .then(([appts, docs, pts]) => {
        setAppointments(appts.data)
        setDoctors(docs.data)
        if (pts) setPatients(pts.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleBook(e) {
    e.preventDefault()
    if (!form.doctor_id || !form.scheduled_at || (isStaff && !form.patient_id)) return
    setBooking(true)
    setBookError('')
    try {
      await client.post('/appointments', {
        doctor_id: Number(form.doctor_id),
        patient_id: isStaff ? Number(form.patient_id) : undefined,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        reason: form.reason || null,
      })
      setForm({ doctor_id: '', patient_id: '', scheduled_at: '', reason: '' })
      load()
    } catch (err) {
      setBookError(err.response?.data?.detail || "Couldn't book this appointment. Please try again.")
    } finally {
      setBooking(false)
    }
  }

  async function updateStatus(id, status) {
    try {
      await client.patch(`/appointments/${id}`, { status })
      load()
    } catch (err) {
      // best-effort; the list simply won't update if this fails
    }
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={isStaff ? 'Manage upcoming patient appointments.' : 'Request and track your appointments.'}
      />

      <form onSubmit={handleBook} className="card mb-6 max-w-lg space-y-3 p-5">
        <div className="readout-label mb-1">{isStaff ? 'Book an appointment for a patient' : 'Book an appointment'}</div>
        {isStaff && (
          <Field label="Patient">
            <select
              className={inputClass}
              value={form.patient_id}
              onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </Field>
        )}
          <Field label="Doctor">
            <select
              className={inputClass}
              value={form.doctor_id}
              onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value }))}
            >
              <option value="">Select a doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Date & time">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
            />
          </Field>
          <Field label="Reason (optional)">
            <input
              className={inputClass}
              placeholder="e.g. Follow-up on blood pressure"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </Field>
        {bookError && <p className="text-sm text-alert">{bookError}</p>}
        <Button type="submit" disabled={booking}>{booking ? 'Booking…' : 'Request appointment'}</Button>
      </form>

      {loading && <div className="readout-label">Loading appointments…</div>}

      {!loading && error && (
        <EmptyState title="Couldn't load appointments" description="Something went wrong. Please try again." />
      )}

      {!loading && !error && appointments.length === 0 && (
        <EmptyState title="No appointments yet" description="Appointments will appear here once booked." />
      )}

      {!loading && !error && appointments.length > 0 && (
        <div className="space-y-2">
          {appointments.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium text-ink">
                  {isStaff ? a.patient_name : a.doctor_name}
                </div>
                <div className="text-xs text-muted">
                  {new Date(a.scheduled_at).toLocaleString()}
                  {a.reason && <> · {a.reason}</>}
                </div>
                {isStaff && a.notes && (
                  <div className="mt-1 text-xs italic text-muted">Notes: {a.notes}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge severity={STATUS_TONE[a.status]}>{a.status}</Badge>
                {isStaff && a.status === 'requested' && (
                  <button
                    onClick={() => updateStatus(a.id, 'confirmed')}
                    className="text-xs font-medium text-pulse-dark underline"
                  >
                    Confirm
                  </button>
                )}
                {isStaff && a.status === 'confirmed' && (
                  <button
                    onClick={() => updateStatus(a.id, 'completed')}
                    className="text-xs font-medium text-pulse-dark underline"
                  >
                    Mark completed
                  </button>
                )}
                {isStaff && (a.status === 'requested' || a.status === 'confirmed') && (
                  <button
                    onClick={() => updateStatus(a.id, 'cancelled')}
                    className="text-xs font-medium text-alert underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
