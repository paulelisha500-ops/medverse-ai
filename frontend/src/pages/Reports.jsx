import { useState } from 'react'
import client from '../api/client.js'
import { PageHeader, Button } from '../components/ui.jsx'

const SAMPLE_REPORT = `Patient Lab Report - Annual Check-up
Fasting Glucose: 126 mg/dL
HbA1c: 6.7%
Total Cholesterol: 215 mg/dL
LDL: 142 mg/dL
HDL: 42 mg/dL
Blood Pressure: 136/86

Assessment: Findings consistent with prediabetes and borderline hypertension.
Prescribed: Metformin 500mg twice daily. Recommended dietary changes and follow-up in 3 months.`

export default function Reports() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAnalyze(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await client.post('/reports/analyze', { text })
      setResult(res.data)
    } catch (err) {
      setError('Could not analyze this report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medical Report Understanding"
        subtitle="Paste a lab report or prescription. Lab values are extracted with pattern matching; diagnoses, medications, and summaries use the configured LLM."
      />

      <form onSubmit={handleAnalyze} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste report text here…"
          className="w-full rounded border border-line bg-surface p-4 font-mono text-sm focus:border-pulse"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Analyzing…' : 'Analyze report'}
          </Button>
          <button
            type="button"
            onClick={() => setText(SAMPLE_REPORT)}
            className="text-sm font-medium text-pulse-dark underline"
          >
            Use a sample report
          </button>
        </div>
        {error && <p className="text-sm text-alert">{error}</p>}
      </form>

      {result && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <LabValueCard values={result.entities?.lab_values} />
            <ListCard title="Diagnoses mentioned" items={result.entities?.diagnoses} />
            <ListCard title="Medications mentioned" items={result.entities?.medications} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="readout-label mb-2">Patient-friendly summary</div>
              <p className="text-sm leading-relaxed text-ink">{result.patient_summary}</p>
            </div>
            <div className="card p-5">
              <div className="readout-label mb-2">Clinical summary</div>
              <p className="text-sm leading-relaxed text-ink">{result.clinical_summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LabValueCard({ values }) {
  const entries = Object.entries(values || {})
  return (
    <div className="card p-5">
      <div className="readout-label mb-3">Lab values found</div>
      {entries.length === 0 && <p className="text-sm text-muted">None detected in this text.</p>}
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted">{key.replace(/_/g, ' ')}</span>
            <span className="font-mono text-sm font-medium text-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListCard({ title, items }) {
  return (
    <div className="card p-5">
      <div className="readout-label mb-3">{title}</div>
      {(!items || items.length === 0) && <p className="text-sm text-muted">None detected.</p>}
      <ul className="space-y-1.5">
        {(items || []).map((item, idx) => (
          <li key={idx} className="text-sm text-ink">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
