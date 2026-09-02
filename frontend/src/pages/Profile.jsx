import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, Button, Field, inputClass } from '../components/ui.jsx'

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user.role === 'patient') {
      client.get('/patients/me/profile').then((res) => setProfile(res.data))
    }
  }, [user.role])

  async function handleSave(e) {
    e.preventDefault()
    const res = await client.put('/patients/me/profile', {
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      blood_group: profile.blood_group,
      allergies: profile.allergies,
    })
    setProfile(res.data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account details." />

      <div className="card max-w-md space-y-4 p-5">
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
        <form onSubmit={handleSave} className="card mt-6 max-w-md space-y-4 p-5">
          <div className="readout-label">Patient details</div>
          <Field label="Date of birth">
            <input
              type="date"
              className={inputClass}
              value={profile.date_of_birth || ''}
              onChange={(e) => setProfile((p) => ({ ...p, date_of_birth: e.target.value }))}
            />
          </Field>
          <Field label="Gender">
            <input
              className={inputClass}
              value={profile.gender || ''}
              onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
            />
          </Field>
          <Field label="Blood group">
            <input
              className={inputClass}
              value={profile.blood_group || ''}
              onChange={(e) => setProfile((p) => ({ ...p, blood_group: e.target.value }))}
            />
          </Field>
          <Field label="Allergies">
            <input
              className={inputClass}
              value={profile.allergies || ''}
              onChange={(e) => setProfile((p) => ({ ...p, allergies: e.target.value }))}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit">Save changes</Button>
            {saved && <span className="text-sm text-pulse-dark">Saved.</span>}
          </div>
        </form>
      )}
    </div>
  )
}
