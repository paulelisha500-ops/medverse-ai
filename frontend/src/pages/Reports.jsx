import { useState } from 'react'
import client from '../api/client.js'
import { PageHeader, Button, Badge } from '../components/ui.jsx'

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
        subtitle="Paste a lab report or prescription. Lab values are checked against typical reference ranges; conditions, medications and follow-up are extracted with built-in clinical rules, or by the configured LLM when one is connected."
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
            <LabValueCard values={result.entities?.lab_values} flags={result.entities?.lab_flags} />
            <ListCard title="Diagnoses mentioned" items={result.entities?.diagnoses} />
            <ListCard title="Medications mentioned" items={result.entities?.medications} />
          </div>

          {result.entities?.follow_up?.length > 0 && (
            <ListCard title="Follow-up noted" items={result.entities.follow_up} />
          )}

          <div className={`grid gap-4 ${result.clinical_summary ? 'md:grid-cols-2' : ''}`}>
            <div className="card p-5">
              <div className="readout-label mb-2">Patient-friendly summary</div>
              <p className="text-sm leading-relaxed text-ink">{result.patient_summary}</p>
            </div>
            {result.clinical_summary && (
              <div className="card p-5">
                <div className="readout-label mb-2">Clinical summary</div>
                <p className="text-sm leading-relaxed text-ink">{result.clinical_summary}</p>
              </div>
            )}
          </div>

          {result.entities?.method === 'rules' && (
            <p className="text-xs text-muted">
              Extracted with built-in clinical rules — no language model is connected. Always check
              these findings against the original report.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Out-of-range results reuse the risk badge colors: red for high or low,
// amber for borderline. In-range results get no badge, so flags stand out.
const LAB_STATUS_SEVERITY = { high: 'high', low: 'high', borderline: 'moderate' }

function LabValueCard({ values, flags }) {
  const flagByTest = Object.fromEntries((flags || []).map((f) => [f.test, f]))
  const entries = Object.entries(values || {})
  return (
    <div className="card p-5">
      <div className="readout-label mb-3">Lab values found</div>
      {entries.length === 0 && <p className="text-sm text-muted">None detected in this text.</p>}
      <div className="space-y-2">
        {entries.map(([key, value]) => {
          const flag = flagByTest[key]
          const severity = flag && LAB_STATUS_SEVERITY[flag.status]
          return (
            <div key={key} className="flex items-center justify-between gap-2" title={flag ? `Typical: ${flag.reference}` : undefined}>
              <span className="text-xs uppercase tracking-wide text-muted">{flag?.label || key.replace(/_/g, ' ')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-ink">
                  {value}
                  {flag?.unit && <span className="ml-1 text-xs font-normal text-muted">{flag.unit}</span>}
                </span>
                {severity && <Badge severity={severity}>{flag.status}</Badge>}
              </span>
            </div>
          )
        })}
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
