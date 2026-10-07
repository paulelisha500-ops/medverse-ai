import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { PageHeader, Button, Field, inputClass, EmptyState, StatCard } from '../components/ui.jsx'

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [form, setForm] = useState({ medication_name: '', dosage: '', frequency: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [loggingId, setLoggingId] = useState(null)

  function load() {
    setError(false)
    Promise.all([client.get('/reminders'), client.get('/reminders/progress')])
      .then(([r, p]) => {
        setReminders(r.data)
        setProgress(p.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.medication_name.trim()) {
      setAddError('Enter a medication name.')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      await client.post('/reminders', form)
      setForm({ medication_name: '', dosage: '', frequency: '' })
      load()
    } catch (err) {
      setAddError("Couldn't add this reminder. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  async function logDose(reminderId, status) {
    setLoggingId(reminderId)
    try {
      await client.post(`/reminders/${reminderId}/log`, { status })
      const res = await client.get('/reminders/progress')
      setProgress(res.data)
    } catch (err) {
      // best-effort — the log call itself either landed or didn't; there's
      // nothing local to roll back since progress is server-computed.
    } finally {
      setLoggingId(null)
    }
  }

  const activeReminders = reminders.filter((r) => r.active)

  return (
    <div>
      <PageHeader title="My Medications" subtitle="Track your medications and daily adherence." />

      {progress && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Overall adherence (7d)" value={`${progress.overall_adherence_pct}%`} />
        </div>
      )}

      <form onSubmit={handleAdd} className="card mb-6 max-w-lg space-y-3 p-5">
        <div className="readout-label mb-1">Add a medication</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Medication">
            <input
              required
              className={inputClass}
              placeholder="e.g. Metformin"
              value={form.medication_name}
              onChange={(e) => setForm((f) => ({ ...f, medication_name: e.target.value }))}
            />
          </Field>
          <Field label="Dosage">
            <input
              className={inputClass}
              placeholder="e.g. 500mg"
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            />
          </Field>
          <Field label="Frequency">
            <input
              className={inputClass}
              placeholder="e.g. Twice daily"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            />
          </Field>
        </div>
        {addError && <p className="text-sm text-alert">{addError}</p>}
        <Button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add medication'}</Button>
      </form>

      {loading && <div className="readout-label">Loading medications…</div>}

      {!loading && error && (
        <EmptyState title="Couldn't load your medications" description="Something went wrong. Please try again." />
      )}

      {!loading && !error && activeReminders.length === 0 && (
        <EmptyState title="No medications tracked yet" description="Add one above to start tracking adherence." />
      )}

      {!loading && !error && activeReminders.length > 0 && (
        <div className="space-y-2">
          {activeReminders.map((r) => {
            const p = progress?.reminders.find((pr) => pr.reminder_id === r.id)
            return (
              <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium text-ink">{r.medication_name}</div>
                  <div className="text-xs text-muted">
                    {[r.dosage, r.frequency].filter(Boolean).join(' · ') || 'No dosage details'}
                  </div>
                  {p && (
                    <div className="mt-1 font-mono text-xs text-muted">
                      {p.adherence_pct}% adherence over the last 7 days
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => logDose(r.id, 'taken')}
                    disabled={loggingId === r.id}
                    className="rounded border border-line px-3 py-1.5 text-xs font-medium text-pulse-dark hover:border-pulse disabled:opacity-40"
                  >
                    {loggingId === r.id ? '…' : 'Mark taken'}
                  </button>
                  <button
                    onClick={() => logDose(r.id, 'skipped')}
                    disabled={loggingId === r.id}
                    className="rounded border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-alert hover:text-alert disabled:opacity-40"
                  >
                    Skip today
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
