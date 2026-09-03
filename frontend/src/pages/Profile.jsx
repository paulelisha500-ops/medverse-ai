import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, Button, Field, inputClass, Readout } from '../components/ui.jsx'

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

const PROFILE_FIELDS = [
  'date_of_birth', 'gender', 'blood_group', 'allergies',
  'height_cm', 'weight_kg', 'phone', 'address',
  'emergency_contact_name', 'emergency_contact_phone',
  'smoking_status', 'alcohol_use', 'chronic_conditions', 'family_history',
]

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    if (user.role === 'patient') {
      client
        .get('/patients/me/profile')
        .then((res) => setProfile(res.data))
        .catch(() => {})
    }
  }, [user.role])

  function update(field, value) {
    setProfile((p) => ({ ...p, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError(false)
    try {
      const payload = {}
      for (const f of PROFILE_FIELDS) {
        payload[f] = profile[f] === '' ? null : profile[f]
      }
      const res = await client.put('/patients/me/profile', payload)
      setProfile(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(true)
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account details." />

      <div className="card max-w-2xl space-y-4 p-5">
        <div>
          <div className="readout-label">Name</div>
          <div className="mt-1 text-sm font-medium text-ink">{user.full_name}</div>
        </div>
        <div>
          <div className="readout-label">Email</div>
          <div className="mt-1 font-mono text-sm text-ink">{user.email}</div>
        </div>
        <div>
          <div className="readout-label">Role</div>
          <div className="mt-1 text-sm font-medium capitalize text-pulse-dark">{user.role}</div>
        </div>
      </div>

      {user.role === 'patient' && profile && (
        <form onSubmit={handleSave} className="mt-6 max-w-2xl space-y-6">
          {(profile.age != null || profile.bmi != null) && (
            <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-2">
              {profile.age != null && <Readout label="Age" value={profile.age} unit="yrs" />}
              {profile.bmi != null && <Readout label="BMI" value={profile.bmi} />}
            </div>
          )}

          <div className="card space-y-4 p-5">
            <div className="readout-label">Personal details</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth">
                <input
                  type="date"
                  className={inputClass}
                  value={profile.date_of_birth || ''}
                  onChange={(e) => update('date_of_birth', e.target.value)}
                />
              </Field>
              <Field label="Sex / gender">
                <select className={inputClass} value={profile.gender || ''} onChange={(e) => update('gender', e.target.value)}>
                  <option value="">Not answered</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Blood group">
                <select className={inputClass} value={profile.blood_group || ''} onChange={(e) => update('blood_group', e.target.value)}>
                  <option value="">Not answered</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Allergies">
                <input
                  className={inputClass}
                  value={profile.allergies || ''}
                  onChange={(e) => update('allergies', e.target.value)}
                  placeholder="e.g. Penicillin, peanuts"
                />
              </Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div className="readout-label">Vitals</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Height (cm)">
                <input
                  type="number" min="30" max="272" step="0.1"
                  className={inputClass}
                  value={profile.height_cm ?? ''}
                  onChange={(e) => update('height_cm', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  type="number" min="1" max="500" step="0.1"
                  className={inputClass}
                  value={profile.weight_kg ?? ''}
                  onChange={(e) => update('weight_kg', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div className="readout-label">Contact</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input className={inputClass} value={profile.phone || ''} onChange={(e) => update('phone', e.target.value)} />
              </Field>
              <Field label="Address">
                <input className={inputClass} value={profile.address || ''} onChange={(e) => update('address', e.target.value)} />
              </Field>
              <Field label="Emergency contact name">
                <input
                  className={inputClass}
                  value={profile.emergency_contact_name || ''}
                  onChange={(e) => update('emergency_contact_name', e.target.value)}
                />
              </Field>
              <Field label="Emergency contact phone">
                <input
                  className={inputClass}
                  value={profile.emergency_contact_phone || ''}
                  onChange={(e) => update('emergency_contact_phone', e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div className="readout-label">Lifestyle</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Smoking status">
                <select className={inputClass} value={profile.smoking_status || ''} onChange={(e) => update('smoking_status', e.target.value)}>
                  {SMOKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Alcohol use">
                <select className={inputClass} value={profile.alcohol_use || ''} onChange={(e) => update('alcohol_use', e.target.value)}>
                  {ALCOHOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div className="readout-label">Medical background</div>
            <Field label="Known chronic conditions">
              <input
                className={inputClass}
                value={profile.chronic_conditions || ''}
                onChange={(e) => update('chronic_conditions', e.target.value)}
                placeholder="e.g. Hypertension, type 2 diabetes"
              />
            </Field>
            <Field label="Family medical history">
              <input
                className={inputClass}
                value={profile.family_history || ''}
                onChange={(e) => update('family_history', e.target.value)}
                placeholder="e.g. Father: heart disease"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit">Save changes</Button>
            {saved && <span className="text-sm text-pulse-dark">Saved.</span>}
            {saveError && <span className="text-sm text-alert">Couldn't save. Please try again.</span>}
          </div>
        </form>
      )}
    </div>
  )
}
