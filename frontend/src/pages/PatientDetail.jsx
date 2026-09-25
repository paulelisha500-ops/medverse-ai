import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, Button, Field, inputClass, EmptyState } from '../components/ui.jsx'

const RECORD_TYPES = ['condition', 'medication', 'surgery', 'lab', 'visit', 'vaccination']
const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
const SMOKING_OPTIONS = [
  { value: '', label: 'Not answered' },
  { value: 'never', label: 'Never smoked' },
  { value: 'former', label: 'Former smoker' },
  { value: 'current', label: 'Current smoker' },
]
const ALCOHOL_OPTIONS = [
  { value: '', label: 'Not answered' },
  { value: 'none', label: 'None' },
  { value: 'occasional', label: 'Occasional' },
  { value: 'regular', label: 'Regular' },
]
const EDITABLE_FIELDS = [
  'date_of_birth', 'gender', 'blood_group', 'allergies',
  'height_cm', 'weight_kg', 'phone', 'address',
  'emergency_contact_name', 'emergency_contact_phone',
  'smoking_status', 'alcohol_use', 'chronic_conditions', 'family_history',
]

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
  const [askError, setAskError] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [saveError, setSaveError] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoadError(false)
    Promise.all([client.get(`/patients/${id}`), client.get(`/patients/${id}/records`)])
      .then(([p, r]) => {
        setProfile(p.data)
        setRecords(r.data)
      })
      .catch(() => setLoadError(true))
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

  function startEditing() {
    setEditDraft({ ...profile })
    setSaveError(false)
    setEditing(true)
  }

  async function saveEdits(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(false)
    try {
      const payload = {}
      for (const f of EDITABLE_FIELDS) {
        payload[f] = editDraft[f] === '' ? null : editDraft[f]
      }
      const res = await client.put(`/patients/${id}`, payload)
      setProfile(res.data)
      setEditing(false)
    } catch (err) {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  async function askAboutPatient(e) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    setAskError(null)
    try {
      const res = await client.post('/assistant/chat', {
        message: question,
        patient_id: profile.user_id,
      })
      setAnswer(res.data)
    } catch (err) {
      setAskError('Something went wrong reaching the assistant. Please try again.')
    } finally {
      setAsking(false)
    }
  }

  if (loading) return <div className="readout-label">Loading patient…</div>
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load this patient"
        description="Something went wrong fetching this record. Please try again."
      />
    )
  }
  if (!profile) return <EmptyState title="Patient not found" description="This patient record doesn't exist." />

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back to patients
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <PageHeader title={profile.full_name || 'Patient'} subtitle={profile.email} />
        {!editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1 text-sm font-medium text-pulse-dark"
          >
            <Pencil size={14} /> Edit details
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mb-8 space-y-4">
          <InfoSection title="Personal">
            <InfoCard label="Age" value={profile.age ?? '—'} />
            <InfoCard label="Sex / gender" value={profile.gender || '—'} />
            <InfoCard label="Date of birth" value={profile.date_of_birth || '—'} />
            <InfoCard label="Blood group" value={profile.blood_group || '—'} />
            <InfoCard label="Allergies" value={profile.allergies || 'None recorded'} />
          </InfoSection>
          <InfoSection title="Vitals">
            <InfoCard label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : '—'} />
            <InfoCard label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : '—'} />
            <InfoCard label="BMI" value={profile.bmi ?? '—'} />
          </InfoSection>
          <InfoSection title="Contact">
            <InfoCard label="Phone" value={profile.phone || '—'} />
            <InfoCard label="Address" value={profile.address || '—'} />
            <InfoCard label="Emergency contact" value={profile.emergency_contact_name || '—'} />
            <InfoCard label="Emergency phone" value={profile.emergency_contact_phone || '—'} />
          </InfoSection>
          <InfoSection title="Lifestyle">
            <InfoCard label="Smoking" value={labelFor(SMOKING_OPTIONS, profile.smoking_status)} />
            <InfoCard label="Alcohol use" value={labelFor(ALCOHOL_OPTIONS, profile.alcohol_use)} />
          </InfoSection>
          <InfoSection title="Medical background">
            <InfoCard label="Chronic conditions" value={profile.chronic_conditions || 'None recorded'} />
            <InfoCard label="Family history" value={profile.family_history || 'None recorded'} />
          </InfoSection>
        </div>
      ) : (
        <form onSubmit={saveEdits} className="mb-8 space-y-4">
          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Date of birth">
              <input
                type="date" className={inputClass}
                value={editDraft.date_of_birth || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, date_of_birth: e.target.value }))}
              />
            </Field>
            <Field label="Sex / gender">
              <select
                className={inputClass}
                value={editDraft.gender || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, gender: e.target.value }))}
              >
                <option value="">Not answered</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Blood group">
              <select
                className={inputClass}
                value={editDraft.blood_group || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, blood_group: e.target.value }))}
              >
                <option value="">Not answered</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Allergies">
              <input
                className={inputClass}
                value={editDraft.allergies || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, allergies: e.target.value }))}
              />
            </Field>
            <Field label="Height (cm)">
              <input
                type="number" min="30" max="272" step="0.1" className={inputClass}
                value={editDraft.height_cm ?? ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, height_cm: e.target.value === '' ? '' : Number(e.target.value) }))}
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                type="number" min="1" max="500" step="0.1" className={inputClass}
                value={editDraft.weight_kg ?? ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, weight_kg: e.target.value === '' ? '' : Number(e.target.value) }))}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={editDraft.phone || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClass}
                value={editDraft.address || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))}
              />
            </Field>
            <Field label="Emergency contact name">
              <input
                className={inputClass}
                value={editDraft.emergency_contact_name || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, emergency_contact_name: e.target.value }))}
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                className={inputClass}
                value={editDraft.emergency_contact_phone || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, emergency_contact_phone: e.target.value }))}
              />
            </Field>
            <Field label="Smoking status">
              <select
                className={inputClass}
                value={editDraft.smoking_status || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, smoking_status: e.target.value }))}
              >
                {SMOKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Alcohol use">
              <select
                className={inputClass}
                value={editDraft.alcohol_use || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, alcohol_use: e.target.value }))}
              >
                {ALCOHOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Chronic conditions">
              <input
                className={inputClass}
                value={editDraft.chronic_conditions || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, chronic_conditions: e.target.value }))}
              />
            </Field>
            <Field label="Family history">
              <input
                className={inputClass}
                value={editDraft.family_history || ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, family_history: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            {saveError && <span className="text-sm text-alert">Couldn't save. Please try again.</span>}
          </div>
        </form>
      )}

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
        {askError && (
          <div className="mt-3 rounded border border-alert/30 bg-alert/5 p-3 text-sm text-alert">
            {askError}
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

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || '—'
}

function InfoSection({ title, children }) {
  return (
    <div>
      <div className="readout-label mb-2">{title}</div>
      <div className="grid gap-4 sm:grid-cols-3">{children}</div>
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
