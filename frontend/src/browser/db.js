// The browser edition's database: one JSON document in localStorage, laid
// out like the SQL tables in app/db/models.py (integer ids, the same column
// names, ISO-8601 UTC timestamps).
//
// Every write reads the stored copy, applies the change and saves it back in
// the same synchronous turn, so two open tabs can't interleave half-applied
// updates. If localStorage is unavailable (blocked site data, some private
// modes) the database lives in memory for the session instead.

import seedData from './data/seed.json'
import { HttpError } from './http.js'

const KEY = 'medverse_browser_db'
const VERSION = 1

export const TABLES = [
  'users',
  'patient_profiles',
  'medical_record_entries',
  'chat_messages',
  'risk_assessments',
  'report_summaries',
  'appointments',
  'medication_reminders',
  'medication_logs',
  'sessions',
]

let memoryCopy = null
let seeding = null

function readStored() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw)
      if (db && db.version === VERSION) return db
    }
  } catch {
    // unavailable or corrupt; fall through to the in-memory copy
  }
  return memoryCopy ? structuredClone(memoryCopy) : null
}

function writeStored(db) {
  memoryCopy = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new HttpError(507, "This browser's storage for MedVerse is full. Clear some old data and try again.")
    }
    // Storage blocked entirely: keep going in memory.
  }
}

export const now = () => new Date().toISOString()

function insertRow(db, table, row) {
  const id = (db.seq[table] || 0) + 1
  db.seq[table] = id
  const record = { id, ...row }
  db[table].push(record)
  return record
}

async function createSeededDb() {
  const db = { version: VERSION, seq: {} }
  for (const table of TABLES) db[table] = []

  const hashes = await Promise.all(seedData.users.map((u) => hashPassword(u.password)))
  const created = {}
  seedData.users.forEach((u, i) => {
    created[u.role] = insertRow(db, 'users', {
      email: u.email,
      hashed_password: hashes[i],
      full_name: u.full_name,
      phone: null,
      role: u.role,
      is_active: true,
      created_at: now(),
    })
  })
  const profile = insertRow(db, 'patient_profiles', {
    ...emptyProfile(created.patient.id),
    ...seedData.patient_profile,
  })
  for (const r of seedData.records) {
    insertRow(db, 'medical_record_entries', {
      patient_id: profile.id,
      type: r.type,
      title: r.title,
      details: r.details,
      date: now(),
    })
  }
  return db
}

export function emptyProfile(userId) {
  return {
    user_id: userId,
    date_of_birth: null,
    gender: null,
    blood_group: null,
    allergies: null,
    height_cm: null,
    weight_kg: null,
    phone: null,
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    smoking_status: null,
    alcohol_use: null,
    chronic_conditions: null,
    family_history: null,
  }
}

// Seeds on first use, like the API's lifespan run_seed(). Seeding hashes the
// built-in accounts' passwords (async), so it happens once up front rather
// than inside a transaction.
export async function ready() {
  if (readStored()) return
  seeding ||= createSeededDb().then((db) => {
    if (!readStored()) writeStored(db)
  })
  try {
    await seeding
  } finally {
    seeding = null
  }
}

// Synchronous read-modify-write. `fn` gets a mutable copy plus helpers; the
// copy is saved only if `fn` returns without throwing.
export function transaction(fn) {
  const db = readStored()
  if (!db) throw new HttpError(500, 'Local database is not initialised')
  const tx = {
    db,
    insert: (table, row) => insertRow(db, table, row),
    changed: false,
  }
  const result = fn(tx)
  writeStored(db)
  return result
}

export function read(fn) {
  const db = readStored()
  if (!db) throw new HttpError(500, 'Local database is not initialised')
  return fn(db)
}

// ---------------------------------------------------------------------------
// Passwords: PBKDF2-SHA256 through WebCrypto. Like the API's bcrypt, only the
// first 72 bytes of a password count.
// ---------------------------------------------------------------------------
const PBKDF2_ITERATIONS = 210000
const MAX_PASSWORD_BYTES = 72

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password).slice(0, MAX_PASSWORD_BYTES),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256)
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(bits)}`
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split('$')
  if (scheme !== 'pbkdf2_sha256') return false
  const bits = new Uint8Array(await derive(password, fromB64(salt), Number(iterations)))
  const expected = fromB64(hash)
  if (bits.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i]
  return diff === 0
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
