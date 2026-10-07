// Retrieval over the knowledge base, on the visitor's device.
//
// The API embeds app/rag/knowledge_base/health_topics.md with
// sentence-transformers/all-MiniLM-L6-v2 and searches it with FAISS. Here the
// passage embeddings come precomputed (scripts/export_browser_data.py, same
// model) and the question is embedded in the browser by Transformers.js
// running the ONNX build of that model, so the ranking matches the API's.
//
// There is no LLM in the browser, so answers are extractive: the sentences of
// the best passages that are closest to the question, quoted as written, with
// the passages listed as sources. If the model can't be downloaded (offline,
// blocked CDN) retrieval falls back to BM25 keyword search.

import { getModelStatus, setModelStatus } from './modelStatus.js'

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

// Cosine score below which a passage doesn't answer the question. Measured on
// this knowledge base: on-topic questions score 0.33-0.78 against their best
// passage, unrelated ones ("capital of France", "pizza recipe") 0.08-0.17.
const SEMANTIC_THRESHOLD = 0.25
// BM25 equivalent: at least one reasonably specific term has to match.
const LEXICAL_THRESHOLD = 2.0
// How long a question waits for a first-time model download before it is
// answered by keyword search instead (the download carries on regardless).
const MODEL_WAIT_MS = 30000
const RETRY_AFTER_MS = 60000
const ANSWER_CHAR_BUDGET = 650

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------
let kbPromise = null

function loadKnowledgeBase() {
  kbPromise ||= import('./data/knowledge-base.json').then(({ default: kb }) => {
    const bytes = Uint8Array.from(atob(kb.embeddings), (c) => c.charCodeAt(0))
    return {
      chunks: kb.chunks,
      dim: kb.dim,
      vectors: new Float32Array(bytes.buffer),
      // Titles count twice: they name the topic in the fewest words.
      lexical: new LexicalIndex(kb.chunks.map((c) => `${c.title} ${c.title} ${c.text}`)),
    }
  })
  kbPromise.catch(() => {
    kbPromise = null
  })
  return kbPromise
}

// ---------------------------------------------------------------------------
// Embedding model
// ---------------------------------------------------------------------------
let embedderPromise = null
let failedAt = 0

export function loadEmbedder() {
  if (embedderPromise) return embedderPromise
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) {
    return Promise.reject(new Error('embedding model unavailable'))
  }
  const files = new Map()
  setModelStatus({ state: 'loading', loaded: 0, total: 0 })
  embedderPromise = import(/* @vite-ignore */ TRANSFORMERS_URL)
    .then(({ pipeline, env }) => {
      env.allowLocalModels = false
      return pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8',
        progress_callback: (event) => {
          if (event.status !== 'progress' || !event.file) return
          files.set(event.file, { loaded: event.loaded || 0, total: event.total || 0 })
          let loaded = 0
          let total = 0
          for (const f of files.values()) {
            loaded += f.loaded
            total += f.total
          }
          setModelStatus({ state: 'loading', loaded, total })
        },
      })
    })
    .then((extractor) => {
      setModelStatus({ state: 'ready' })
      return extractor
    })
    .catch((err) => {
      embedderPromise = null
      failedAt = Date.now()
      setModelStatus({ state: 'unavailable' })
      throw err
    })
  return embedderPromise
}

// Starts the download in the background (the Assistant page calls this when
// it opens) without making anyone wait for it.
export function warmUp() {
  loadKnowledgeBase().catch(() => {})
  if (getModelStatus().state !== 'ready') loadEmbedder().catch(() => {})
}

async function embedderWithin(ms) {
  let timer
  try {
    return await Promise.race([
      loadEmbedder(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('model still loading')), ms)
      }),
    ])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function embed(extractor, texts) {
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  const dim = output.dims[output.dims.length - 1]
  return texts.map((_, i) => output.data.subarray(i * dim, (i + 1) * dim))
}

function dot(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

// ---------------------------------------------------------------------------
// Keyword fallback (BM25)
// ---------------------------------------------------------------------------
const STOPWORDS = new Set(
  ('a about above after again against all also am an and any are as at be because been before being below between ' +
    'both but by can could did do does doing down during each either few for from further get got had has have having ' +
    'he her here hers herself him himself his how i if in into is it its itself just let me more most much my myself ' +
    'no nor not now of off on once only or other our ours ourselves out over own same she should so some such than ' +
    'that the their theirs them themselves then there these they this those through to too under until up us very was ' +
    'we were what when where which while who whom why will with would you your yours yourself yourselves ' +
    'explain tell know want need like look looks mean means please thing things way ways really').split(' '),
)

const SYNONYMS = {
  sugar: ['glucose'],
  bp: ['blood', 'pressure'],
  flu: ['influenza'],
  influenza: ['flu'],
  cholesterol: ['lipid'],
  lipid: ['cholesterol'],
  sad: ['depression'],
  depressed: ['depression'],
  tired: ['fatigue'],
  htn: ['hypertension'],
  kidney: ['renal'],
  a1c: ['hba1c'],
}

function stem(word) {
  let w = word
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`
  else if (w.length > 4 && /(?:ch|sh|ss|x|z)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1)
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

export function tokenize(text) {
  const words = String(text).toLowerCase().match(/[a-z0-9]+/g) || []
  return words.filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w))).map(stem)
}

function queryTerms(text) {
  const words = String(text).toLowerCase().match(/[a-z0-9]+/g) || []
  const extra = words.flatMap((w) => SYNONYMS[w] || [])
  return [...new Set(tokenize([...words, ...extra].join(' ')))]
}

class LexicalIndex {
  constructor(docs) {
    this.tf = docs.map((doc) => {
      const counts = new Map()
      for (const t of tokenize(doc)) counts.set(t, (counts.get(t) || 0) + 1)
      return counts
    })
    this.lengths = this.tf.map((counts) => [...counts.values()].reduce((a, b) => a + b, 0))
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length)
    this.df = new Map()
    for (const counts of this.tf) for (const t of counts.keys()) this.df.set(t, (this.df.get(t) || 0) + 1)
  }

  idf(term) {
    const n = this.df.get(term) || 0
    const N = this.tf.length
    return Math.log(1 + (N - n + 0.5) / (n + 0.5))
  }

  score(terms) {
    const k1 = 1.5
    const b = 0.75
    return this.tf.map((counts, i) => {
      let total = 0
      for (const t of terms) {
        const f = counts.get(t)
        if (!f) continue
        total += (this.idf(t) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.lengths[i]) / this.avgLength))
      }
      return total
    })
  }
}

// ---------------------------------------------------------------------------
// Retrieval + extractive answers
// ---------------------------------------------------------------------------
function topIndices(scores, k) {
  return scores
    .map((score, i) => [score, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, i]) => i)
}

async function retrieve(question, topK) {
  const kb = await loadKnowledgeBase()
  const extractor = await embedderWithin(MODEL_WAIT_MS)
  if (extractor) {
    try {
      const [queryVector] = await embed(extractor, [question])
      const scores = kb.chunks.map((_, i) => dot(queryVector, kb.vectors.subarray(i * kb.dim, (i + 1) * kb.dim)))
      return {
        mode: 'semantic',
        extractor,
        queryVector,
        threshold: SEMANTIC_THRESHOLD,
        results: topIndices(scores, topK).map((i) => ({ ...kb.chunks[i], score: scores[i] })),
      }
    } catch {
      // inference failed — answer by keyword instead
    }
  }
  const scores = kb.lexical.score(queryTerms(question))
  return {
    mode: 'lexical',
    threshold: LEXICAL_THRESHOLD,
    results: topIndices(scores, topK).map((i) => ({ ...kb.chunks[i], score: scores[i] })),
  }
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9("'“])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function lexicalSimilarity(terms, text) {
  if (!terms.length) return 0
  const tokens = new Set(tokenize(text))
  return terms.filter((t) => tokens.has(t)).length / terms.length
}

async function scoreTexts(texts, retrieval, question) {
  if (retrieval.mode === 'semantic') {
    try {
      const vectors = await embed(retrieval.extractor, texts)
      return vectors.map((v) => dot(retrieval.queryVector, v))
    } catch {
      // fall through to keyword overlap
    }
  }
  const terms = queryTerms(question)
  return texts.map((t) => lexicalSimilarity(terms, t))
}

async function extractAnswer(question, passages, retrieval) {
  const best = passages[0].score
  const margin = retrieval.mode === 'semantic' ? 0.12 : best * 0.5
  const used = passages.filter((p, i) => i === 0 || p.score >= best - margin).slice(0, 3)

  const sentences = used.flatMap((p, pi) => splitSentences(p.text).map((text, si) => ({ text, pi, si })))
  const similarity = await scoreTexts(sentences.map((s) => s.text), retrieval, question)
  sentences.forEach((s, i) => {
    // Mostly the sentence's own match, nudged towards the better passages.
    const passageWeight = 1 - s.pi * 0.08
    s.score = similarity[i] * passageWeight
  })

  const ranked = [...sentences].sort((a, b) => b.score - a.score)
  const floor = ranked[0].score - (retrieval.mode === 'semantic' ? 0.12 : ranked[0].score * 0.5)
  const chosen = []
  let length = 0
  for (const s of ranked) {
    if (chosen.length >= 3 || s.score < floor) break
    if (chosen.length && length + s.text.length > ANSWER_CHAR_BUDGET) continue
    chosen.push(s)
    length += s.text.length
  }
  if (!chosen.some((s) => s.pi === 0)) {
    chosen.push(sentences.filter((s) => s.pi === 0).sort((a, b) => b.score - a.score)[0])
  }

  // Back in reading order, one paragraph per passage.
  chosen.sort((a, b) => a.pi - b.pi || a.si - b.si)
  const paragraphs = []
  for (const s of chosen) {
    const last = paragraphs[paragraphs.length - 1]
    if (last && last.pi === s.pi) last.text += ` ${s.text}`
    else paragraphs.push({ pi: s.pi, text: s.text })
  }
  // Sources are the passages the answer actually quotes.
  return { paragraphs: paragraphs.map((p) => p.text), quoted: paragraphs.map((p) => used[p.pi]) }
}

// Lines from the patient's record that bear on the question.
async function relevantRecordLines(question, lines, retrieval) {
  if (!lines.length) return []
  const terms = queryTerms(question)
  const overlap = lines.map((line) => lexicalSimilarity(terms, line))
  let semantic = null
  if (retrieval.mode === 'semantic') {
    try {
      semantic = (await embed(retrieval.extractor, lines)).map((v) => dot(retrieval.queryVector, v))
    } catch {
      semantic = null
    }
  }
  return lines
    .map((line, i) => ({ line, score: overlap[i] + (semantic ? Math.max(0, semantic[i] - 0.2) : 0), hit: overlap[i] > 0 || (semantic && semantic[i] >= 0.45) }))
    .filter((x) => x.hit)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.line)
}

const NOT_COVERED =
  "I couldn't find that in the MedVerse knowledge base, so I won't guess. It covers common conditions, lab tests, " +
  'medications, mental health, and healthy living — try asking about one of those.'

/**
 * Answers `question` from the knowledge base (and, when given, the patient's
 * record). Returns { answer, sources } shaped like the API's ChatResponse.
 *
 * record: { heading, lines } — the record summary the API would hand its LLM.
 */
export async function answerQuestion(question, { record = null, audience = 'patient' } = {}) {
  const retrieval = await retrieve(question, 4)
  const passages = retrieval.results.filter((r) => r.score >= retrieval.threshold)

  const parts = []
  let quoted = []
  if (record) {
    const lines = await relevantRecordLines(question, record.lines, retrieval)
    if (lines.length) parts.push(`${record.heading}\n${lines.map((l) => `• ${l}`).join('\n')}`)
  }
  if (passages.length) {
    const extract = await extractAnswer(question, passages, retrieval)
    parts.push(...extract.paragraphs)
    quoted = extract.quoted
  } else {
    parts.push(NOT_COVERED)
  }
  parts.push(
    audience === 'patient'
      ? 'This is general health information, not a diagnosis. For advice about your own health, talk to a licensed healthcare professional.'
      : 'Reference information from the MedVerse knowledge base — not a substitute for clinical judgment.',
  )

  return {
    answer: parts.join('\n\n'),
    sources: quoted.map((p) => ({ title: p.title, snippet: p.text.slice(0, 220) })),
  }
}
