import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, Button, Badge, inputClass } from '../components/ui.jsx'

export default function Medications() {
  const [meds, setMeds] = useState(['', ''])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateMed(index, value) {
    setMeds((prev) => prev.map((m, i) => (i === index ? value : m)))
  }

  function addField() {
    setMeds((prev) => [...prev, ''])
  }

  function removeField(index) {
    setMeds((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCheck(e) {
    e.preventDefault()
    const cleaned = meds.map((m) => m.trim()).filter(Boolean)
    if (cleaned.length < 2) return
    setLoading(true)
    try {
      const res = await client.post('/medications/check', { medications: cleaned })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medication Interaction Checker"
        subtitle="Enter two or more medications to check for interactions against official FDA drug labeling."
      />

      <form onSubmit={handleCheck} className="max-w-lg space-y-3">
        {meds.map((med, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={med}
              onChange={(e) => updateMed(i, e.target.value)}
              placeholder={`Medication ${i + 1} (e.g. Warfarin)`}
              className={inputClass}
            />
            {meds.length > 2 && (
              <button
                type="button"
                onClick={() => removeField(i)}
                aria-label={`Remove medication ${i + 1}`}
                className="text-muted hover:text-alert"
              >
                <X size={18} />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 text-sm font-medium text-pulse-dark"
          >
            <Plus size={16} /> Add another
          </button>
        </div>

        <Button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Check interactions'}</Button>
      </form>

      {result && (
        <div className="mt-8 max-w-2xl space-y-4">
          <div className="readout-label">
            Checked {result.checked.length} medications · {result.interactions.length} interaction(s) found
          </div>

          {result.interactions.length === 0 && (
            <div className="card p-5 text-sm text-ink">
              No known interactions found for this combination.
            </div>
          )}

          {result.interactions.map((it, i) => (
            <div key={i} className="card space-y-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display font-medium text-ink">
                  {it.drug_a} + {it.drug_b}
                </span>
                <div className="flex items-center gap-2">
                  {it.severity && <Badge severity={it.severity}>{it.severity}</Badge>}
                  <Badge severity={it.source === 'fda_label' ? undefined : 'low'}>
                    {it.source === 'fda_label' ? 'FDA label' : 'Curated reference'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-ink/80">{it.description}</p>
              {it.excerpt && it.source === 'fda_label' && (
                <p className="border-l-2 border-line pl-3 text-xs italic text-muted">
                  From the official FDA label: “{it.excerpt}”
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
