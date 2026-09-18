import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, Button, Field, inputClass } from '../components/ui.jsx'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const [account, setAccount] = useState({
    full_name: user.full_name,
    email: user.email,
    phone: user.phone || '',
  })
  const [accountSaved, setAccountSaved] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)

  useEffect(() => {
    if (user.role === 'patient') {
      client
        .get('/patients/me/profile')
        .then((res) => setProfile(res.data))
        .catch(() => {})
    }
  }, [user.role])

  async function handleSave(e) {
    e.preventDefault()
    setSaveError(false)
    try {
      const res = await client.put('/patients/me/profile', {
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        blood_group: profile.blood_group,
        allergies: profile.allergies,
      })
      setProfile(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(true)
    }
  }

  async function handleAccountSave(e) {
    e.preventDefault()
    setAccountError('')
    setAccountBusy(true)
    try {
      const res = await client.put('/auth/me', account)
      updateUser(res.data)
      setAccount({ full_name: res.data.full_name, email: res.data.email, phone: res.data.phone || '' })
      setAccountSaved(true)
      setTimeout(() => setAccountSaved(false), 2000)
    } catch (err) {
      setAccountError(err.response?.data?.detail || "Couldn't save your details. Please try again.")
    } finally {
      setAccountBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account details." />

      <form onSubmit={handleAccountSave} className="card max-w-md space-y-4 p-5">
        <Field label="Name">
          <input
            required
            className={inputClass}
            value={account.full_name}
            onChange={(e) => setAccount((a) => ({ ...a, full_name: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            className={inputClass}
            value={account.email}
            onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
          />
        </Field>
        <Field label="Phone number">
          <input
            type="tel"
            className={inputClass}
            placeholder="e.g. +1 555 123 4567"
            value={account.phone}
            onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
          />
        </Field>
        <div>
          <div className="readout-label">Role</div>
          <div className="mt-1 text-sm font-medium capitalize text-pulse-dark">{user.role}</div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={accountBusy}>{accountBusy ? 'Saving…' : 'Save changes'}</Button>
          {accountSaved && <span className="text-sm text-pulse-dark">Saved.</span>}
          {accountError && <span className="text-sm text-alert">{accountError}</span>}
        </div>
      </form>

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
            {saveError && <span className="text-sm text-alert">Couldn't save. Please try again.</span>}
          </div>
        </form>
      )}
    </div>
  )
}
