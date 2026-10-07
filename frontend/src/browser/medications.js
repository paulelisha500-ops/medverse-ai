// Medication checking in the browser: app/nlp/medication_data.py (names,
// brands, curated interactions), app/nlp/drug_data.py (live openFDA label
// and RxNorm lookups — both send CORS headers, so the browser calls them
// directly) and app/nlp/dose_conversion.py.

import { getCloseMatches } from './difflib.js'
import { HttpError, pyRound } from './http.js'

let dataPromise = null

export function loadMedicationData() {
  dataPromise ||= import('./data/medications.json').then(({ default: data }) => {
    const brandToGeneric = new Map(Object.entries(data.brand_to_generic))
    const curated = new Set(data.curated_names)
    const interactions = new Map()
    for (const item of data.interactions) {
      interactions.set(pairKey(item.drugs[0], item.drugs[1]), item)
    }
    return {
      directory: data.directory,
      brandToGeneric,
      curated,
      interactions,
      candidates: [...brandToGeneric.keys(), ...data.curated_names],
    }
  })
  dataPromise.catch(() => {
    dataPromise = null
  })
  return dataPromise
}

const pairKey = (a, b) => [a, b].sort().join('\u0000')

// medication_data._generic
export function normalize(data, name) {
  const n = name.trim().toLowerCase()
  if (data.brandToGeneric.has(n)) return data.brandToGeneric.get(n)
  if (data.curated.has(n)) return n
  const close = getCloseMatches(n, data.candidates, 1, 0.82)
  if (close.length) return data.brandToGeneric.get(close[0]) ?? close[0]
  return n
}

// medication_data.check_curated_pair
export function checkCuratedPair(data, drugA, drugB) {
  const a = normalize(data, drugA)
  const b = normalize(data, drugB)
  if (a === b) return null
  const item = data.interactions.get(pairKey(a, b))
  if (!item) return null
  return { drug_a: drugA, drug_b: drugB, description: item.description, severity: item.severity, source: 'curated' }
}

// ---------------------------------------------------------------------------
// Live lookups (drug_data.py)
// ---------------------------------------------------------------------------
const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST'
const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json'
const TIMEOUT_MS = 6000
const CACHE_TTL_MS = 3600 * 1000
const INTERACTION_FIELDS = ['drug_interactions', 'warnings_and_cautions', 'ask_doctor_or_pharmacist', 'warnings']

const cache = new Map()

const clean = (name) => name.replace(/["\\]/g, ' ').trim().slice(0, 100)

async function getJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return { status: res.status, ok: res.ok, body: res.ok ? await res.json() : null }
  } finally {
    clearTimeout(timer)
  }
}

async function resolveDrugName(name) {
  const term = clean(name)
  if (!term) return null
  try {
    const found = await getJson(`${RXNORM_BASE}/approximateTerm.json?${new URLSearchParams({ term, maxEntries: '1' })}`)
    if (!found.ok) return null
    const candidates = found.body?.approximateGroup?.candidate || []
    const rxcui = candidates[0]?.rxcui
    if (!rxcui) return null
    const props = await getJson(
      `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/property.json?${new URLSearchParams({ propName: 'RxNorm Name' })}`,
    )
    if (!props.ok) return null
    return props.body?.propConceptGroup?.propConcept?.[0]?.propValue ?? null
  } catch {
    return null
  }
}

async function fetchLabelByName(name) {
  const term = clean(name)
  if (!term) return null
  try {
    const search = `openfda.brand_name:"${term}" openfda.generic_name:"${term}"`
    const res = await getJson(`${OPENFDA_BASE}?${new URLSearchParams({ search, limit: '1' })}`)
    if (!res.ok) return null // 404 = no label; anything else = unreachable
    const label = res.body?.results?.[0]
    if (!label) return null
    for (const field of INTERACTION_FIELDS) {
      const value = label[field]
      if (value && (!Array.isArray(value) || value.length)) {
        return Array.isArray(value) ? value.join(' ') : String(value)
      }
    }
    return null
  } catch {
    return null
  }
}

// `generic` is the last place to look for a label: a brand that's off the
// market (Coumadin) has none of its own, but its generic (warfarin) does.
async function lookupDrug(name, generic) {
  const key = name.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result

  const [labelText, resolved] = await Promise.all([fetchLabelByName(name), resolveDrugName(name)])
  const canonical = resolved || clean(name)
  let text = labelText
  const tried = new Set([key])
  for (const alternative of [canonical, generic]) {
    if (text === null && alternative && !tried.has(alternative.trim().toLowerCase())) {
      tried.add(alternative.trim().toLowerCase())
      text = await fetchLabelByName(alternative)
    }
  }

  const result = { canonical_name: canonical, label_text: text }
  if (text !== null) cache.set(key, { at: Date.now(), result }) // never cache failures
  return result
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The sentence of `haystack` that names `needle` as a whole word/phrase.
const EXCERPT_CHARS = 400

// The sentence, or for one too long to quote whole the stretch around the
// match: labels often flatten a table into one "sentence" thousands of
// characters long, and a quote cut from its start may never reach the drug.
function excerpt(sentence, start, end) {
  if (sentence.length <= EXCERPT_CHARS) return sentence
  let left = Math.max(0, start - Math.floor(EXCERPT_CHARS / 3))
  let right = Math.min(sentence.length, left + EXCERPT_CHARS)
  if (left > 0) {
    const space = sentence.indexOf(' ', left)
    if (space !== -1 && space < start) left = space + 1
  }
  if (right < sentence.length) {
    const space = sentence.lastIndexOf(' ', right - 1)
    if (space !== -1 && space >= end) right = space
  }
  return (left > 0 ? '…' : '') + sentence.slice(left, right).trim() + (right < sentence.length ? '…' : '')
}

function mentions(haystack, needle) {
  const n = needle.trim()
  if (n.length < 3) return null
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(n)}(?![\\p{L}\\p{N}_])`, 'iu')
  for (const raw of haystack.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim()
    const match = pattern.exec(sentence)
    if (match) return excerpt(sentence, match.index, match.index + match[0].length)
  }
  return null
}

// The names another drug's label could use for this one: its RxNorm name,
// the name as typed, and its generic. Labels name ingredients, so a warfarin
// label warns about "ibuprofen", never "Advil".
function searchNames(info, typed, generic) {
  const names = []
  const seen = new Set()
  for (const name of [info.canonical_name, typed, generic]) {
    if (name && !seen.has(name.trim().toLowerCase())) {
      seen.add(name.trim().toLowerCase())
      names.push(name.trim())
    }
  }
  return names
}

function firstMention(text, names) {
  for (const name of names) {
    const sentence = mentions(text, name)
    if (sentence) return [name, sentence]
  }
  return null
}

function checkPairLive(drugA, drugB, a, b, genericA, genericB) {
  if (a.label_text) {
    const found = firstMention(a.label_text, searchNames(b, drugB, genericB))
    if (found) return { status: 'hit', excerpt: found[1], labeled_drug: drugA, mentioned_drug: drugB, matched_name: found[0] }
  }
  if (b.label_text) {
    const found = firstMention(b.label_text, searchNames(a, drugA, genericA))
    if (found) return { status: 'hit', excerpt: found[1], labeled_drug: drugB, mentioned_drug: drugA, matched_name: found[0] }
  }
  if (a.label_text === null || b.label_text === null) return { status: 'unavailable' }
  return { status: 'no_match' }
}

// api/medications.py check()
export async function checkMedications(medications) {
  const data = await loadMedicationData()
  const names = []
  const seen = new Set()
  for (const raw of medications) {
    const name = raw.trim().slice(0, 100)
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      names.push(name)
    }
  }

  const infos = new Map(await Promise.all(names.map(async (n) => [n, await lookupDrug(n, normalize(data, n))])))
  const unverified = names.filter((n) => infos.get(n).label_text === null)
  const interactions = []

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const drugA = names[i]
      const drugB = names[j]
      const live = checkPairLive(
        drugA, drugB, infos.get(drugA), infos.get(drugB), normalize(data, drugA), normalize(data, drugB),
      )
      if (live.status === 'hit') {
        const mentioned = live.matched_name.toLowerCase() === live.mentioned_drug.toLowerCase()
          ? live.mentioned_drug
          : `${live.mentioned_drug} (${live.matched_name})`
        interactions.push({
          drug_a: drugA,
          drug_b: drugB,
          description: `${mentioned} is mentioned in ${live.labeled_drug}'s official FDA labeling as a potential interaction.`,
          severity: checkCuratedPair(data, drugA, drugB)?.severity ?? null,
          source: 'fda_label',
          excerpt: live.excerpt,
        })
      } else {
        // Neither label names the other drug, or one couldn't be read. That
        // doesn't rule an interaction out — labels often warn about a whole
        // class ("NSAIDs") — so the hand-reviewed pairs still apply.
        const curated = checkCuratedPair(data, drugA, drugB)
        if (curated) interactions.push({ ...curated, excerpt: null })
      }
    }
  }
  return { interactions, checked: names, unverified }
}

// ---------------------------------------------------------------------------
// Dose conversion (dose_conversion.py)
// ---------------------------------------------------------------------------
let dosePromise = null
function loadDoseTables() {
  dosePromise ||= import('./data/dose-conversion.json').then((m) => m.default)
  dosePromise.catch(() => {
    dosePromise = null
  })
  return dosePromise
}

export async function conversionFamilies() {
  return (await loadDoseTables()).families
}

export async function convertDose(family, fromDrug, toDrug, doseMg) {
  const data = await loadDoseTables()
  const fam = data.families.find((f) => f.key === family)
  if (!fam) throw new HttpError(400, `Unknown conversion family: ${family}`)

  const from = fromDrug.trim().toLowerCase()
  const to = toDrug.trim().toLowerCase()
  if (family === 'opioid') {
    for (const drug of [from, to]) {
      if (drug in data.opioid_excluded) throw new HttpError(400, data.opioid_excluded[drug])
    }
  }

  const table = data.tables[family]
  let converted
  let referenceValue
  let referenceUnit
  if (family === 'opioid') {
    if (!(from in table) || !(to in table)) {
      throw new HttpError(400, 'Both medications must be in the opioid conversion table')
    }
    const mme = doseMg * table[from]
    converted = mme / table[to]
    referenceValue = pyRound(mme, 1)
    referenceUnit = 'MME/day'
  } else {
    if (!(from in table) || !(to in table)) {
      throw new HttpError(400, 'Both medications must be in this conversion table')
    }
    converted = doseMg * (table[to] / table[from])
    referenceValue = pyRound(doseMg / table[from], 2)
    referenceUnit = `× reference dose of ${fam.reference.toLowerCase()}`
  }

  return {
    family,
    from_drug: from,
    to_drug: to,
    dose_mg: doseMg,
    converted_mg: pyRound(converted, 2),
    reference_value: referenceValue,
    reference_unit: referenceUnit,
    caveats: fam.caveats,
  }
}
