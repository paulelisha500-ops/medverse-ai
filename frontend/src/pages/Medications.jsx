import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, Button, Badge, inputClass } from '../components/ui.jsx'

function getSuggestions(query, directory) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts = []
  const includes = []
  for (const drug of directory) {
    const names = [capitalize(drug.name), ...drug.brand_names]
    const hit = names.find((n) => n.toLowerCase().startsWith(q))
    if (hit) {
      starts.push({ drug, matchedName: hit })
      continue
    }
    const partial = names.find((n) => n.toLowerCase().includes(q))
    if (partial) includes.push({ drug, matchedName: partial })
  }
  return [...starts, ...includes].slice(0, 8)
}

function findExactDrug(value, directory) {
  const v = value.trim().toLowerCase()
  if (!v) return null
  return directory.find((d) => d.name === v || d.brand_names.some((b) => b.toLowerCase() === v)) || null
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Medications() {
  const [meds, setMeds] = useState(['', ''])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [directory, setDirectory] = useState([])
  const [activeIndex, setActiveIndex] = useState(null)

  useEffect(() => {
    client
      .get('/medications/directory')
      .then((res) => setDirectory(res.data.drugs))
      .catch(() => {})
  }, [])

  function updateMed(index, value) {
    setMeds((prev) => prev.map((m, i) => (i === index ? value : m)))
  }

  function selectSuggestion(index, name) {
    updateMed(index, name)
    setActiveIndex(null)
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
    setError('')
    try {
      const res = await client.post('/medications/check', { medications: cleaned })
      setResult(res.data)
    } catch (err) {
      setError('Could not check interactions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medication Interaction Checker"
        subtitle="Enter two or more medications to check for known interactions in our curated dataset. Start typing for suggestions and typical dosing."
      />

      <form onSubmit={handleCheck} className="max-w-lg space-y-3">
        {meds.map((med, i) => {
          const suggestions = activeIndex === i ? getSuggestions(med, directory) : []
          const exact = findExactDrug(med, directory)
          return (
            <div key={i}>
              <div className="relative flex items-center gap-2">
                <input
                  value={med}
                  onChange={(e) => updateMed(i, e.target.value)}
                  onFocus={() => setActiveIndex(i)}
                  onBlur={() => setTimeout(() => setActiveIndex((cur) => (cur === i ? null : cur)), 150)}
                  placeholder={`Medication ${i + 1} (e.g. Warfarin)`}
                  className={inputClass}
                  autoComplete="off"
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

                {suggestions.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full max-h-64 overflow-auto rounded border border-line bg-surface shadow-lg">
                    {suggestions.map(({ drug, matchedName }) => (
                      <button
                        key={drug.name + matchedName}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(i, matchedName)}
                        className="flex w-full flex-col items-start gap-0.5 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-pulse-dim"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          {matchedName}
                          {matchedName.toLowerCase() !== drug.name && (
                            <span className="font-normal text-muted">({capitalize(drug.name)})</span>
                          )}
                          <span className="rounded-sm bg-pulse-dim px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-pulse-dark">
                            {drug.category}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-muted">{drug.dosage}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {exact && activeIndex !== i && (
                <p className="mt-1 pl-1 text-xs text-muted">
                  {exact.category} · Typical dosage: {exact.dosage}
                </p>
              )}
            </div>
          )
        })}

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
        {error && <p className="text-sm text-alert">{error}</p>}
      </form>

      {result && (
        <div className="mt-8 max-w-2xl space-y-4">
          <div className="readout-label">
            Checked {result.checked.length} medications · {result.interactions.length} interaction(s) found
          </div>

          {result.interactions.length === 0 && (
            <div className="card p-5 text-sm text-ink">
              No known interactions found in our dataset for this combination.
            </div>
          )}

          {result.interactions.map((it, i) => (
            <div key={i} className="card space-y-2 p-5">
              <div className="flex items-center justify-between">
                <span className="font-display font-medium text-ink">
                  {it.drug_a} + {it.drug_b}
                </span>
                <Badge severity={it.severity}>{it.severity}</Badge>
              </div>
              <p className="text-sm text-ink/80">{it.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
