import { useState } from 'react'
import client from '../api/client.js'
import { PageHeader, Button, Field, inputClass, Readout, Disclaimer } from '../components/ui.jsx'

const DEFAULTS = {
  age: 45,
  bmi: 26,
  systolic_bp: 122,
  glucose: 98,
  cholesterol: 190,
  smoker: false,
  family_history: false,
  activity_level: 1,
}

export default function RiskCheck() {
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await client.post('/risk/assess', form)
      setResult(res.data)
    } catch (err) {
      setError('Could not calculate risk. Please check the values and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Disease Risk Check"
        subtitle="A trained model estimates risk from common health metrics — an educational estimate, not a diagnosis."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age">
              <input type="number" className={inputClass} value={form.age} min={1} max={120}
                onChange={(e) => update('age', Number(e.target.value))} />
            </Field>
            <Field label="BMI">
              <input type="number" step="0.1" className={inputClass} value={form.bmi} min={10} max={70}
                onChange={(e) => update('bmi', Number(e.target.value))} />
            </Field>
            <Field label="Systolic BP (mmHg)">
              <input type="number" className={inputClass} value={form.systolic_bp} min={70} max={250}
                onChange={(e) => update('systolic_bp', Number(e.target.value))} />
            </Field>
            <Field label="Fasting glucose (mg/dL)">
              <input type="number" className={inputClass} value={form.glucose} min={40} max={500}
                onChange={(e) => update('glucose', Number(e.target.value))} />
            </Field>
            <Field label="Total cholesterol (mg/dL)">
              <input type="number" className={inputClass} value={form.cholesterol} min={80} max={500}
                onChange={(e) => update('cholesterol', Number(e.target.value))} />
            </Field>
            <Field label="Activity level">
              <select className={inputClass} value={form.activity_level}
                onChange={(e) => update('activity_level', Number(e.target.value))}>
                <option value={0}>Low</option>
                <option value={1}>Moderate</option>
                <option value={2}>High</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.smoker} onChange={(e) => update('smoker', e.target.checked)} />
              Smoker
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.family_history} onChange={(e) => update('family_history', e.target.checked)} />
              Family history of these conditions
            </label>
          </div>

          {error && <p className="text-sm text-alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Calculating…' : 'Calculate risk'}</Button>
        </div>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="card grid grid-cols-2 gap-4 p-5">
                <Readout label="Diabetes risk" value={result.diabetes_risk_pct} unit="%"
                  tone={result.diabetes_risk_pct > 50 ? 'alert' : result.diabetes_risk_pct > 20 ? 'amber' : 'pulse'} />
                <Readout label="Heart disease risk" value={result.heart_disease_risk_pct} unit="%"
                  tone={result.heart_disease_risk_pct > 50 ? 'alert' : result.heart_disease_risk_pct > 20 ? 'amber' : 'pulse'} />
              </div>
              <div className="card p-5">
                <div className="readout-label mb-2">What's contributing most</div>
                <p className="text-sm text-ink">
                  {[...new Set([...result.diabetes_top_factors, ...result.heart_top_factors])]
                    .map((f) => f.replace(/_/g, ' '))
                    .join(', ') || 'No single factor stands out — overall profile looks favorable.'}
                </p>
              </div>
              <div className="card p-5">
                <div className="readout-label mb-2">Suggestions</div>
                <ul className="space-y-1.5 text-sm text-ink">
                  {result.tips.map((tip, i) => <li key={i}>• {tip}</li>)}
                </ul>
              </div>
              <Disclaimer />
            </>
          ) : (
            <div className="card flex h-full items-center justify-center p-10 text-center text-sm text-muted">
              Fill in the form and calculate to see your results here.
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
