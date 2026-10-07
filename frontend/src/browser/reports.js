// Report analysis on the device.
//
// Lab values use the API's own regexes (app/nlp/extraction.py LAB_PATTERNS,
// exported verbatim). Where the API asks its configured LLM for diagnoses,
// medications and summaries, this edition has no LLM, so it extracts them
// with a condition lexicon and the medication directory, and writes both
// summaries from the findings against standard adult reference ranges.

import labPatterns from './data/lab-patterns.json'
import { loadMedicationData } from './medications.js'

// ---------------------------------------------------------------------------
// Lab values (exact port of extract_lab_values)
// ---------------------------------------------------------------------------
const LAB_REGEXES = Object.entries(labPatterns.patterns).map(([key, source]) => [key, new RegExp(source, 'i')])

export function extractLabValues(text) {
  const found = {}
  const lowered = text.toLowerCase()
  for (const [key, regex] of LAB_REGEXES) {
    const match = regex.exec(lowered)
    if (match) found[key] = match[1].trim()
  }
  return found
}

function labUnit(text, key) {
  const regex = LAB_REGEXES.find(([k]) => k === key)?.[1]
  const match = regex?.exec(text.toLowerCase())
  return match?.[2] || null
}

// ---------------------------------------------------------------------------
// Diagnoses mentioned
// ---------------------------------------------------------------------------
// [pattern, label]; a null label keeps the wording found in the report.
// More specific entries come first and mask their text, so "type 2
// diabetes" isn't reported again as "diabetes".
const CONDITIONS = [
  [String.raw`pre-?diabet(?:es|ic)`, 'Prediabetes'],
  [String.raw`gestational diabetes`, 'Gestational diabetes'],
  [String.raw`type\s*(?:1|i|one)\s+diabetes(?:\s+mellitus)?|t1dm`, 'Type 1 diabetes'],
  [String.raw`type\s*(?:2|ii|two)\s+diabetes(?:\s+mellitus)?|t2dm`, 'Type 2 diabetes'],
  [String.raw`diabetic\s+(?:retinopathy|neuropathy|nephropathy)`, null],
  [String.raw`diabetes(?:\s+mellitus)?`, 'Diabetes'],
  [String.raw`insulin resistance`, 'Insulin resistance'],
  [String.raw`metabolic syndrome`, 'Metabolic syndrome'],
  [String.raw`(?:(?:borderline|stage\s*(?:1|2|i|ii)|uncontrolled|essential|resistant|secondary)\s+)?hypertension`, null],
  [String.raw`high blood pressure`, 'High blood pressure'],
  [String.raw`htn`, 'Hypertension'],
  [String.raw`hypotension`, 'Hypotension'],
  [String.raw`hyperlipid(?:a)?emia|dyslipid(?:a)?emia|hypercholesterol(?:a)?emia|hypertriglycerid(?:a)?emia`, null],
  [String.raw`coronary (?:artery|heart) disease|cad`, 'Coronary artery disease'],
  [String.raw`(?:congestive\s+)?heart failure|chf`, 'Heart failure'],
  [String.raw`atrial fibrillation|a-?fib`, 'Atrial fibrillation'],
  [String.raw`myocardial infarction|heart attack`, 'Myocardial infarction'],
  [String.raw`angina`, 'Angina'],
  [String.raw`transient ischemic attack|tia`, 'Transient ischemic attack'],
  [String.raw`stroke`, 'Stroke'],
  [String.raw`peripheral (?:artery|arterial|vascular) disease`, 'Peripheral artery disease'],
  [String.raw`(?:iron[- ]deficiency|pernicious|sickle[- ]cell)\s+an(?:a)?emia`, null],
  [String.raw`an(?:a)?emi(?:a|c)`, 'Anemia'],
  [String.raw`hypothyroidism|underactive thyroid`, 'Hypothyroidism'],
  [String.raw`hyperthyroidism|overactive thyroid`, 'Hyperthyroidism'],
  [String.raw`chronic kidney disease(?:\s*,?\s*stage\s*(?:[1-5]|iv|v|i{1,3}))?|ckd(?:\s*stage\s*[1-5])?`, 'Chronic kidney disease'],
  [String.raw`acute kidney injury|aki`, 'Acute kidney injury'],
  [String.raw`copd|chronic obstructive pulmonary disease`, 'COPD'],
  [String.raw`asthma`, 'Asthma'],
  [String.raw`pneumonia`, 'Pneumonia'],
  [String.raw`bronchitis`, 'Bronchitis'],
  [String.raw`(?:obstructive\s+)?sleep apn(?:o)?ea|osa`, 'Sleep apnea'],
  [String.raw`urinary tract infection|uti`, 'Urinary tract infection'],
  [String.raw`(?:morbid\s+)?obesity|obese`, 'Obesity'],
  [String.raw`overweight`, 'Overweight'],
  [String.raw`osteoporosis`, 'Osteoporosis'],
  [String.raw`osteopenia`, 'Osteopenia'],
  [String.raw`osteoarthritis`, 'Osteoarthritis'],
  [String.raw`rheumatoid arthritis`, 'Rheumatoid arthritis'],
  [String.raw`gout`, 'Gout'],
  [String.raw`gerd|gastro-?(?:o)?esophageal reflux(?:\s+disease)?|acid reflux`, 'GERD'],
  [String.raw`(?:non-?alcoholic\s+)?fatty liver(?:\s+disease)?|nafld|masld`, 'Fatty liver disease'],
  [String.raw`cirrhosis`, 'Cirrhosis'],
  [String.raw`hepatitis\s*a`, 'Hepatitis A'],
  [String.raw`hepatitis\s*b`, 'Hepatitis B'],
  [String.raw`hepatitis\s*c`, 'Hepatitis C'],
  [String.raw`hepatitis`, 'Hepatitis'],
  [String.raw`major depressive disorder|depression`, null],
  [String.raw`(?:generali[sz]ed\s+)?anxiety disorder`, null],
  [String.raw`migraine`, 'Migraine'],
  [String.raw`epilepsy|seizure disorder`, 'Epilepsy'],
  [String.raw`vitamin d deficiency`, 'Vitamin D deficiency'],
  [String.raw`(?:vitamin\s+)?b12 deficiency`, 'Vitamin B12 deficiency'],
  [String.raw`influenza`, 'Influenza'],
  [String.raw`covid(?:-?19)?`, 'COVID-19'],
  [String.raw`sinusitis`, 'Sinusitis'],
  [String.raw`(?:peripheral\s+)?neuropathy`, null],
  [String.raw`psoriasis`, 'Psoriasis'],
  [String.raw`eczema|atopic dermatitis`, 'Eczema'],
  [String.raw`allergic rhinitis|hay fever`, 'Allergic rhinitis'],
  [String.raw`hyperkal(?:a)?emia`, 'Hyperkalemia'],
  [String.raw`hypokal(?:a)?emia`, 'Hypokalemia'],
  [String.raw`hyponatr(?:a)?emia`, 'Hyponatremia'],
  [String.raw`hypoglyc(?:a)?emia`, 'Hypoglycemia'],
  [String.raw`hyperglyc(?:a)?emia`, 'Hyperglycemia'],
  [String.raw`polycystic ovary syndrome|pcos`, 'PCOS'],
  [String.raw`benign prostatic hyperplasia|bph`, 'Benign prostatic hyperplasia'],
].map(([source, label]) => [new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'giu'), label])

const NEGATION = /\b(?:no|not|denies|denied|without|negative for|ruled out|rule out|r\/o|absence of|free of|no evidence of|no history of|no signs of)\b(?:\W+\w+){0,5}\W*$/i
const FAMILY = /\b(?:family history|father|mother|brother|sister|sibling|grand(?:father|mother|parent)s?|parents?|aunt|uncle)\b/i

function clauseBefore(text, index) {
  const start = Math.max(text.lastIndexOf('\n', index - 1), text.lastIndexOf('.', index - 1), text.lastIndexOf(';', index - 1))
  return text.slice(start + 1, index)
}

function lineBefore(text, index) {
  return text.slice(text.lastIndexOf('\n', index - 1) + 1, index)
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
// For use mid-sentence: "Fasting glucose" -> "fasting glucose", but "HbA1c",
// "LDL cholesterol" and "COPD" keep their capitals.
const midSentence = (s) => (/^[A-Z][a-z]/.test(s) && !/^HbA1c/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

export function extractDiagnoses(text) {
  let working = text
  const found = []
  const seen = new Set()
  for (const [regex, label] of CONDITIONS) {
    regex.lastIndex = 0
    for (const match of working.matchAll(regex)) {
      const index = match.index
      const end = index + match[0].length
      working = working.slice(0, index) + ' '.repeat(match[0].length) + working.slice(end)
      if (NEGATION.test(clauseBefore(text, index)) || FAMILY.test(lineBefore(text, index))) continue
      const name = label || capitalize(match[0].replace(/\s+/g, ' ').toLowerCase())
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        found.push(name)
      }
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Medications mentioned
// ---------------------------------------------------------------------------
// Directory names that are also everyday words or lab analytes. They count as
// a medication only next to a dose or a prescribing word.
const AMBIGUOUS = new Set([
  'calcium', 'potassium', 'magnesium', 'sodium', 'iron', 'zinc', 'copper', 'gold', 'lithium', 'insulin',
  'vitamin d', 'vitamin b12', 'nasal', 'saline', 'alert', 'allergy', 'fleet', 'nix', 'soma', 'asa', 'gtn',
  'edex', 'oxygen', 'glucose', 'dextrose', 'caffeine', 'nicotine', 'water',
])
const MED_CUE = /\b(?:prescribed|prescription|rx|medications?|meds|started|starting|start|continue[sd]?|taking|takes|take|tablets?|tabs?|capsules?|dose|dosage|daily|twice|bid|tid|qid|prn|inhaler|injections?|therapy|regimen)\b/i
const DOSE = /^\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|units?|iu|%)(?:\s*\/\s*(?:day|dose|ml|kg|hr))?)(?![\p{L}])/iu
const FREQUENCY =
  /^\s*,?\s*((?:once|twice|three times|four times)(?:\s+(?:a|per)\s+(?:day|week)|\s+(?:daily|weekly))?|(?:every|q)\s*\d+\s*(?:hours?|hrs?|h)\b|daily|nightly|at bedtime|as needed|prn|bid|tid|qid|qd|qhs|weekly)\b/i

let medMatcherPromise = null

function loadMedicationMatcher() {
  medMatcherPromise ||= loadMedicationData().then((data) => {
    const toGeneric = new Map()
    for (const entry of data.directory) {
      toGeneric.set(entry.name.toLowerCase(), entry.name)
      for (const brand of entry.brand_names) {
        if (!toGeneric.has(brand.toLowerCase())) toGeneric.set(brand.toLowerCase(), entry.name)
      }
    }
    for (const [brand, generic] of data.brandToGeneric) {
      if (!toGeneric.has(brand)) toGeneric.set(brand, generic)
    }
    const names = [...toGeneric.keys()].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length)
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
    return {
      toGeneric,
      regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu'),
    }
  })
  medMatcherPromise.catch(() => {
    medMatcherPromise = null
  })
  return medMatcherPromise
}

export async function extractMedications(text) {
  const { toGeneric, regex } = await loadMedicationMatcher()
  const found = []
  const seen = new Set()
  regex.lastIndex = 0
  for (const match of text.matchAll(regex)) {
    const name = match[0].replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    const after = text.slice(match.index + match[0].length)
    if (/^\s*[:=]\s*\d/.test(after)) continue // "Calcium: 9.5 mg/dL" is a lab value
    const dose = DOSE.exec(after)
    const rest = dose ? after.slice(dose[0].length) : after
    const frequency = FREQUENCY.exec(rest)
    const line = text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index + match[0].length + 80).split('\n')[0]
    const cued = MED_CUE.test(line)
    if (!dose && !cued && (AMBIGUOUS.has(key) || key.length < 5)) continue
    const generic = toGeneric.get(key) || key
    if (seen.has(generic)) continue
    seen.add(generic)
    found.push([name, dose?.[1].replace(/\s+/g, ' '), frequency?.[1]].filter(Boolean).join(' '))
  }
  return found
}

// ---------------------------------------------------------------------------
// Follow-up / plan sentences
// ---------------------------------------------------------------------------
const FOLLOW_UP = /\b(?:follow[- ]?up|recheck|re-check|repeat|return|revisit|reassess|refer(?:ral|red)?|schedule[sd]?|monitor(?:ing)?|recommend(?:ed|s)?|advised?|in \d+ (?:days?|weeks?|months?))\b/i

export function extractFollowUp(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s && FOLLOW_UP.test(s))
    .map((s) => s.replace(/^(?:plan|follow[- ]?up|recommendations?|assessment)\s*:\s*/i, '').slice(0, 200))
    .slice(0, 4)
}

// ---------------------------------------------------------------------------
// Interpretation against general adult reference ranges
// ---------------------------------------------------------------------------
// level: 'high' | 'borderline' | 'low' | 'normal'; `note` is the clinical
// wording of the range the value falls in.
function interpret(key, raw, text) {
  if (key === 'blood_pressure') {
    const [s, d] = raw.split('/').map((v) => Number(v.trim()))
    if (!s || !d) return null
    const label = 'Blood pressure'
    const value = `${s}/${d} mmHg`
    if (s >= 180 || d >= 120) return { label, value, level: 'high', urgent: true, note: 'severe range, ≥180/120' }
    if (s >= 140 || d >= 90) return { label, value, level: 'high', note: 'stage 2 hypertension range' }
    if (s >= 130 || d >= 80) return { label, value, level: 'high', note: 'stage 1 hypertension range' }
    if (s >= 120) return { label, value, level: 'borderline', note: 'elevated' }
    if (s < 90 || d < 60) return { label, value, level: 'low', note: 'low' }
    return { label, value, level: 'normal', note: 'normal' }
  }

  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  switch (key) {
    case 'glucose': {
      const mmol = labUnit(text, 'glucose') === 'mmol/l'
      const mg = mmol ? v * 18.016 : v
      const fasting = /fasting/i.test(text)
      const label = fasting ? 'Fasting glucose' : 'Glucose'
      const value = mmol ? `${v} mmol/L` : `${v} mg/dL`
      if (mg < 70) return { label, value, level: 'low', note: 'below 70 mg/dL' }
      if (fasting) {
        if (mg >= 126) return { label, value, level: 'high', note: 'diabetes range for a fasting test, ≥126 mg/dL' }
        if (mg >= 100) return { label, value, level: 'borderline', note: 'prediabetes range for a fasting test, 100–125 mg/dL' }
      } else {
        if (mg >= 200) return { label, value, level: 'high', note: 'diabetes range for a random test, ≥200 mg/dL' }
        if (mg >= 140) return { label, value, level: 'borderline', note: 'above the usual range, ≥140 mg/dL' }
      }
      return { label, value, level: 'normal', note: 'normal' }
    }
    case 'hba1c': {
      const label = 'HbA1c'
      const value = `${v}%`
      if (v >= 6.5) return { label, value, level: 'high', note: 'diabetes range, ≥6.5%' }
      if (v >= 5.7) return { label, value, level: 'borderline', note: 'prediabetes range, 5.7–6.4%' }
      return { label, value, level: 'normal', note: 'normal' }
    }
    case 'total_cholesterol': {
      const label = 'Total cholesterol'
      const value = `${v} mg/dL`
      if (v >= 240) return { label, value, level: 'high', note: 'high, ≥240 mg/dL' }
      if (v >= 200) return { label, value, level: 'borderline', note: 'borderline high, 200–239 mg/dL' }
      return { label, value, level: 'normal', note: 'desirable' }
    }
    case 'ldl': {
      const label = 'LDL cholesterol'
      const value = `${v} mg/dL`
      if (v >= 190) return { label, value, level: 'high', note: 'very high, ≥190 mg/dL' }
      if (v >= 160) return { label, value, level: 'high', note: 'high, 160–189 mg/dL' }
      if (v >= 130) return { label, value, level: 'borderline', note: 'borderline high, 130–159 mg/dL' }
      if (v >= 100) return { label, value, level: 'normal', note: 'near optimal' }
      return { label, value, level: 'normal', note: 'optimal' }
    }
    case 'hdl': {
      const label = 'HDL cholesterol'
      const value = `${v} mg/dL`
      if (v < 40) return { label, value, level: 'low', note: 'low, <40 mg/dL' }
      if (v >= 60) return { label, value, level: 'normal', note: 'protective range, ≥60 mg/dL' }
      return { label, value, level: 'normal', note: 'acceptable' }
    }
    case 'creatinine': {
      const label = 'Creatinine'
      const value = `${v} mg/dL`
      if (v > 1.3) return { label, value, level: 'high', note: 'above the typical adult range, 0.6–1.3 mg/dL' }
      if (v < 0.6) return { label, value, level: 'low', note: 'below the typical adult range, 0.6–1.3 mg/dL' }
      return { label, value, level: 'normal', note: 'normal' }
    }
    case 'hemoglobin': {
      const label = 'Hemoglobin'
      const value = `${v} g/dL`
      if (v < 12) return { label, value, level: 'low', note: 'below the typical adult range, 12–17.5 g/dL' }
      if (v > 17.5) return { label, value, level: 'high', note: 'above the typical adult range, 12–17.5 g/dL' }
      return { label, value, level: 'normal', note: 'normal' }
    }
    case 'tsh': {
      const label = 'TSH'
      const value = `${v} mIU/L`
      if (v > 4.0) return { label, value, level: 'high', note: 'above the typical range, 0.4–4.0 mIU/L' }
      if (v < 0.4) return { label, value, level: 'low', note: 'below the typical range, 0.4–4.0 mIU/L' }
      return { label, value, level: 'normal', note: 'normal' }
    }
    default:
      return null
  }
}

function joinList(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const PLAIN = {
  high: 'higher than the usual range',
  borderline: 'borderline — slightly above the usual range',
  low: 'lower than the usual range',
  normal: 'within the usual range',
}

function patientSummary(findings, entities) {
  const { diagnoses, medications, follow_up: followUp } = entities
  if (!findings.length && !diagnoses.length && !medications.length) {
    return (
      'No lab values, diagnoses, or medications were recognized in this text, so there is nothing to ' +
      'summarize yet. Paste the results section of the report, or try the sample report.'
    )
  }
  const parts = []
  if (findings.some((f) => f.urgent)) {
    parts.push('A blood pressure reading this high needs prompt medical attention.')
  }
  if (findings.length) {
    parts.push(`This report includes ${findings.length} lab result${findings.length === 1 ? '' : 's'}.`)
    for (const level of ['high', 'borderline', 'low', 'normal']) {
      const group = findings.filter((f) => f.level === level)
      if (!group.length) continue
      const list = joinList(group.map((f) => `${midSentence(f.label)} (${f.value})`))
      parts.push(`${capitalize(list)} ${group.length === 1 ? 'is' : 'are'} ${PLAIN[level]}.`)
    }
  }
  if (diagnoses.length) parts.push(`The report mentions ${joinList(diagnoses.map(midSentence))}.`)
  if (medications.length) parts.push(`Medications listed: ${joinList(medications)}.`)
  if (followUp.length) parts.push(`Next steps noted in the report: ${followUp.join(' ')}`)
  parts.push(
    'These are general reference ranges, not a diagnosis — your doctor will explain what the results mean for you.',
  )
  return parts.join(' ')
}

function clinicalSummary(findings, entities) {
  const { diagnoses, medications, follow_up: followUp } = entities
  const parts = []
  if (findings.length) {
    parts.push(`Labs: ${findings.map((f) => `${f.label} ${f.value} (${f.note})`).join('; ')}.`)
    const flagged = findings.filter((f) => f.level !== 'normal').map((f) => f.label)
    parts.push(flagged.length ? `Outside reference range: ${flagged.join(', ')}.` : 'All extracted values within reference ranges.')
  }
  if (diagnoses.length) parts.push(`Documented: ${diagnoses.join('; ')}.`)
  if (medications.length) parts.push(`Medications: ${medications.join('; ')}.`)
  if (followUp.length) parts.push(`Plan: ${followUp.join(' ')}`)
  return parts.length ? parts.join(' ') : 'No structured findings were recognized in the submitted text.'
}

// Same shape as app/nlp/extraction.analyze_report.
export async function analyzeReport(text) {
  const labValues = extractLabValues(text)
  const entities = {
    diagnoses: extractDiagnoses(text),
    medications: await extractMedications(text),
    follow_up: extractFollowUp(text),
    lab_values: labValues,
  }
  const findings = Object.entries(labValues)
    .map(([key, raw]) => interpret(key, raw, text))
    .filter(Boolean)
  return {
    entities,
    patient_summary: patientSummary(findings, entities),
    clinical_summary: clinicalSummary(findings, entities),
  }
}
