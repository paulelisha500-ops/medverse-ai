import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, Button, Field, inputClass, EmptyState } from '../components/ui.jsx'

const RECORD_TYPES = ['condition', 'medication', 'surgery', 'lab', 'visit', 'vaccination']

export default function PatientDetail() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'visit', title: '', details: '' })
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)

  function load() {
    Promise.all([client.get(`/patients/${id}`), client.get(`/patients/${id}/records`)])
      .then(([p, r]) => {
        setProfile(p.data)
        setRecords(r.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function addRecord(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    await client.post(`/patients/${id}/records`, form)
    setForm({ type: 'visit', title: '', details: '' })
    setShowForm(false)
    load()
  }

  async function askAboutPatient(e) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await client.post('/assistant/chat', {
        message: question,
        patient_id: profile.user_id,
      })
      setAnswer(res.data)
    } finally {
      setAsking(false)
    }
  }

  if (loading) return <div className="readout-label">Loading patient…</div>
  if (!profile) return <EmptyState title="Patient not found" description="This patient record doesn't exist." />

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back to patients
      </Link>

      <PageHeader title={profile.full_name || 'Patient'} subtitle={profile.email} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <InfoCard label="Blood group" value={profile.blood_group || '—'} />
        <InfoCard label="Date of birth" value={profile.date_of_birth || '—'} />
        <InfoCard label="Allergies" value={profile.allergies || 'None recorded'} />
      </div>

      <div className="mb-8 card p-5">
        <div className="readout-label mb-2">Ask the assistant about this patient</div>
        <form onSubmit={askAboutPatient} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What should I check given their glucose trend?"
            className={inputClass}
          />
          <Button type="submit" disabled={asking}>{asking ? '…' : 'Ask'}</Button>
        </form>
        {answer && (
          <div className="mt-3 whitespace-pre-wrap rounded border border-line bg-paper p-3 text-sm text-ink">
            {answer.answer}
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Medical record</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-pulse-dark"
        >
          <Plus size={16} /> Add entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={addRecord} className="card mb-4 space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Annual check-up"
              />
            </Field>
            <Field label="Details">
              <input
                className={inputClass}
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Optional notes"
              />
            </Field>
          </div>
          <Button type="submit">Save entry</Button>
        </form>
      )}

      {records.length === 0 ? (
        <EmptyState title="No records yet" description="Add the first entry to start this patient's history." />
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="card flex items-start justify-between gap-4 p-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-pulse-dark">{r.type}</div>
                <div className="font-medium text-ink">{r.title}</div>
                {r.details && <div className="mt-0.5 text-sm text-muted">{r.details}</div>}
              </div>
              <div className="whitespace-nowrap font-mono text-xs text-muted">
                {new Date(r.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="card p-4">
      <div className="readout-label">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}
