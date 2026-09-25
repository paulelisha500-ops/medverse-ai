import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, Button, Badge, inputClass } from '../components/ui.jsx'
import { apiErrorMessage } from '../api/errors.js'

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
    setError('')
    if (cleaned.length < 2) {
      setError('Enter at least two medications to check.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await client.post('/medications/check', { medications: cleaned })
      setResult(res.data)
    } catch (err) {
      setResult(null)
      setError(
        err.response?.status === 422
          ? 'You can check up to 10 medications at a time.'
          : "Couldn't complete the check. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medication Interaction Checker"
        subtitle="Enter two or more medications to check for interactions against official FDA drug labeling. Start typing for suggestions and typical dosing."
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
                          {drug.tier === 'reference' && (
                            <span
                              title="From the FDA drug directory — no typical dosing on file, and not covered by interaction checking"
                              className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted"
                            >
                              Reference
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-muted">{drug.dosage}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {exact && activeIndex !== i && (
                <p className="mt-1 pl-1 text-xs text-muted">
                  {exact.category} ·{' '}
                  {exact.tier === 'reference' ? exact.dosage : `Typical dosage: ${exact.dosage}`}
                  {exact.fda_class && (
                    <span className="block text-muted/80">FDA class: {exact.fda_class}</span>
                  )}
                  {exact.tier === 'reference' && (
                    <span className="block text-muted/80">
                      Reference entry — not covered by interaction checking.
                    </span>
                  )}
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

        {error && <p role="alert" className="text-sm text-alert">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Check interactions'}</Button>
        {error && <p className="text-sm text-alert">{error}</p>}
      </form>

      {result && (
        <div className="mt-8 max-w-2xl space-y-4">
          <div className="readout-label">
            Checked {result.checked.length} medications · {result.interactions.length} interaction(s) found
          </div>

          {result.unverified?.length > 0 && (
            <div role="alert" className="card border-amber/40 p-5 text-sm text-ink">
              <span className="font-medium">Couldn't verify: {result.unverified.join(', ')}.</span>{' '}
              No official label was found for {result.unverified.length === 1 ? 'this medication' : 'these medications'}
              , so the absence of a warning below does not mean it is safe to combine. Check the spelling
              or ask a pharmacist.
            </div>
          )}

          {result.interactions.length === 0 && !result.unverified?.length && (
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

      <DoseConverter />
    </div>
  )
}

function DoseConverter() {
  const [families, setFamilies] = useState([])
  const [family, setFamily] = useState('')
  const [fromDrug, setFromDrug] = useState('')
  const [toDrug, setToDrug] = useState('')
  const [dose, setDose] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    client
      .get('/medications/conversion-families')
      .then((res) => {
        setFamilies(res.data.families)
        if (res.data.families.length) {
          const first = res.data.families[0]
          setFamily(first.key)
          setFromDrug(first.drugs[0] || '')
          setToDrug(first.drugs[1] || '')
        }
      })
      .catch(() => {})
  }, [])

  const active = families.find((f) => f.key === family)

  function changeFamily(key) {
    setFamily(key)
    setResult(null)
    setError('')
    const f = families.find((x) => x.key === key)
    if (f) {
      setFromDrug(f.drugs[0] || '')
      setToDrug(f.drugs[1] || '')
    }
  }

  async function handleConvert(e) {
    e.preventDefault()
    const value = Number(dose)
    if (!value || value <= 0) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await client.post('/medications/convert', {
        family,
        from_drug: fromDrug,
        to_drug: toDrug,
        dose_mg: value,
      })
      setResult(res.data)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not convert that dose. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (!families.length) return null

  return (
    <div className="mt-14 max-w-2xl border-t border-line pt-10">
      <PageHeader
        title="Equivalent Dose Converter"
        subtitle="Convert between drugs in the same family using published equivalency tables."
      />

      <form onSubmit={handleConvert} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {families.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => changeFamily(f.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                f.key === family
                  ? 'border-pulse bg-pulse text-white'
                  : 'border-line bg-surface text-ink hover:border-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">From</span>
            <select className={inputClass} value={fromDrug} onChange={(e) => setFromDrug(e.target.value)}>
              {active?.drugs.map((d) => (
                <option key={d} value={d}>{capitalize(d)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Dose (mg)</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">To</span>
            <select className={inputClass} value={toDrug} onChange={(e) => setToDrug(e.target.value)}>
              {active?.drugs.map((d) => (
                <option key={d} value={d}>{capitalize(d)}</option>
              ))}
            </select>
          </label>
        </div>

        <Button type="submit" disabled={busy}>{busy ? 'Converting…' : 'Convert dose'}</Button>
        {error && <p className="text-sm text-alert">{error}</p>}
      </form>

      {result && (
        <div className="card mt-6 space-y-3 p-5">
          <div className="readout-label">Equivalent dose</div>
          <div className="font-mono text-3xl font-medium text-ink">
            {result.converted_mg}
            <span className="ml-1 text-base text-muted">mg {capitalize(result.to_drug)}</span>
          </div>
          <p className="text-sm text-muted">
            {result.dose_mg} mg {capitalize(result.from_drug)} · {result.reference_value}{' '}
            {result.reference_unit}
          </p>
        </div>
      )}

      {active?.caveats?.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
          {active.caveats.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
