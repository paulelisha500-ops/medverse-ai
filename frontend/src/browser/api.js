// The API routes (backend/app/api/*.py), reimplemented over the browser
// database. Each handler keeps its FastAPI counterpart's status codes, error
// messages and response shapes; see server.js for how requests reach them.

import { emptyProfile, hashPassword, now, randomToken, read, transaction, verifyPassword } from './db.js'
import { HttpError, intParam, pyRound, validate } from './http.js'

const ACCESS_TOKEN_TTL_MS = 1440 * 60 * 1000 // ACCESS_TOKEN_EXPIRE_MINUTES

// ---------------------------------------------------------------------------
// deps.py
// ---------------------------------------------------------------------------
export function currentUser(headers) {
  const auth = headers.Authorization || headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  if (!match) throw new HttpError(401, 'Not authenticated')
  return read((db) => {
    const session = db.sessions.find((s) => s.token === match[1])
    const user = session && Date.parse(session.expires_at) > Date.now() && db.users.find((u) => u.id === session.user_id)
    if (!user || !user.is_active) throw new HttpError(401, 'Could not validate credentials')
    return user
  })
}

export function requireRoles(user, roles) {
  if (!roles.includes(user.role)) {
    throw new HttpError(403, `This action requires one of these roles: ${roles.join(', ')}`)
  }
}

// ---------------------------------------------------------------------------
// auth.py
// ---------------------------------------------------------------------------
const userOut = (u) => ({ id: u.id, email: u.email, full_name: u.full_name, phone: u.phone ?? null, role: u.role })

const USER_CREATE = {
  email: { type: 'email', required: true },
  password: {
    type: 'str',
    required: true,
    minLength: 6,
    maxBytes: 72,
    maxBytesMessage: 'must be 72 characters or fewer',
  },
  full_name: { type: 'str', required: true, strip: true, minLength: 1 },
}

function issueToken(tx, userId) {
  const token = randomToken()
  const t = Date.now()
  tx.db.sessions = tx.db.sessions.filter((s) => Date.parse(s.expires_at) > t)
  tx.db.sessions.push({ token, user_id: userId, expires_at: new Date(t + ACCESS_TOKEN_TTL_MS).toISOString() })
  return token
}

async function register({ body }) {
  const payload = validate(body, USER_CREATE)
  const hashed = await hashPassword(payload.password)
  return transaction((tx) => {
    if (tx.db.users.some((u) => u.email === payload.email)) {
      throw new HttpError(400, 'An account with this email already exists')
    }
    const user = tx.insert('users', {
      email: payload.email,
      hashed_password: hashed,
      full_name: payload.full_name,
      phone: null,
      role: 'patient',
      is_active: true,
      created_at: now(),
    })
    tx.insert('patient_profiles', emptyProfile(user.id))
    return { access_token: issueToken(tx, user.id), token_type: 'bearer', user: userOut(user) }
  })
}

async function createStaff({ body, user }) {
  requireRoles(user, ['admin'])
  const payload = validate(body, { ...USER_CREATE, role: { type: 'str', required: true } })
  if (!['doctor', 'admin'].includes(payload.role)) throw new HttpError(400, "role must be 'doctor' or 'admin'")
  const hashed = await hashPassword(payload.password)
  return transaction((tx) => {
    if (tx.db.users.some((u) => u.email === payload.email)) {
      throw new HttpError(400, 'An account with this email already exists')
    }
    const created = tx.insert('users', {
      email: payload.email,
      hashed_password: hashed,
      full_name: payload.full_name,
      phone: null,
      role: payload.role,
      is_active: true,
      created_at: now(),
    })
    return userOut(created)
  })
}

async function login({ body }) {
  // OAuth2PasswordRequestForm: form fields `username` and `password`.
  const form = validate(body, { username: { type: 'str', required: true }, password: { type: 'str', required: true } })
  const user = read((db) => db.users.find((u) => u.email === form.username))
  if (!user || !(await verifyPassword(form.password, user.hashed_password))) {
    throw new HttpError(401, 'Incorrect email or password')
  }
  return transaction((tx) => ({ access_token: issueToken(tx, user.id), token_type: 'bearer', user: userOut(user) }))
}

function me({ user }) {
  requireRoles(user, ['admin', 'doctor', 'patient'])
  return userOut(user)
}

function updateMe({ body, user }) {
  const updates = validate(body, {
    full_name: { type: 'str' },
    email: { type: 'email' },
    phone: { type: 'str' },
  })
  return transaction((tx) => {
    const row = tx.db.users.find((u) => u.id === user.id)
    if (updates.email && updates.email !== row.email && tx.db.users.some((u) => u.email === updates.email)) {
      throw new HttpError(400, 'An account with this email already exists')
    }
    for (const [field, value] of Object.entries(updates)) {
      // full_name and email are NOT NULL columns; the API would fail the write.
      if (value === null && field !== 'phone') continue
      row[field] = value
    }
    return userOut(row)
  })
}

// ---------------------------------------------------------------------------
// patients.py
// ---------------------------------------------------------------------------
export function computeAge(dateOfBirth) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateOfBirth || '')
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dob = new Date(year, month - 1, day)
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return null
  const today = new Date()
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)
  return today.getFullYear() - year - (beforeBirthday ? 1 : 0)
}

export function computeBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null
  const heightM = heightCm / 100
  return pyRound(weightKg / (heightM * heightM), 1)
}

function profileOut(db, profile) {
  const user = db.users.find((u) => u.id === profile.user_id)
  const { id, user_id, ...fields } = profile
  return {
    id,
    user_id,
    ...fields,
    full_name: user ? user.full_name : null,
    email: user ? user.email : null,
    age: computeAge(profile.date_of_birth),
    bmi: computeBmi(profile.height_cm, profile.weight_kg),
  }
}

const PROFILE_UPDATE = {
  date_of_birth: { type: 'str' },
  gender: { type: 'str' },
  blood_group: { type: 'str' },
  allergies: { type: 'str' },
  height_cm: { type: 'float', ge: 30, le: 272 },
  weight_kg: { type: 'float', ge: 1, le: 500 },
  phone: { type: 'str' },
  address: { type: 'str' },
  emergency_contact_name: { type: 'str' },
  emergency_contact_phone: { type: 'str' },
  smoking_status: { type: 'str' },
  alcohol_use: { type: 'str' },
  chronic_conditions: { type: 'str' },
  family_history: { type: 'str' },
}

function listPatients({ user }) {
  requireRoles(user, ['admin', 'doctor'])
  return read((db) => db.patient_profiles.map((p) => profileOut(db, p)))
}

function getMyProfile({ user }) {
  requireRoles(user, ['patient'])
  return read((db) => {
    const profile = db.patient_profiles.find((p) => p.user_id === user.id)
    if (!profile) throw new HttpError(404, 'Patient profile not found')
    return profileOut(db, profile)
  })
}

function updateMyProfile({ body, user }) {
  requireRoles(user, ['patient'])
  const updates = validate(body, PROFILE_UPDATE)
  return transaction((tx) => {
    const profile = tx.db.patient_profiles.find((p) => p.user_id === user.id)
    if (!profile) throw new HttpError(404, 'Patient profile not found')
    Object.assign(profile, updates)
    return profileOut(tx.db, profile)
  })
}

function profileOr404(db, profileId) {
  const profile = db.patient_profiles.find((p) => p.id === profileId)
  if (!profile) throw new HttpError(404, 'Patient not found')
  return profile
}

function authorizePatientAccess(user, profile) {
  if (user.role === 'admin' || user.role === 'doctor') return
  if (user.role === 'patient' && user.id === profile.user_id) return
  throw new HttpError(403, "Not authorized to view this patient's records")
}

function getPatient({ params, user }) {
  const id = intParam(params.id, 'profile_id')
  // Staff can ask the assistant about the patient from this page, so start
  // fetching the on-device model now, as the assistant page does.
  if (user.role !== 'patient') warmUpAssistant()
  return read((db) => {
    const profile = profileOr404(db, id)
    authorizePatientAccess(user, profile)
    return profileOut(db, profile)
  })
}

function updatePatient({ params, body, user }) {
  requireRoles(user, ['admin', 'doctor'])
  const id = intParam(params.id, 'profile_id')
  const updates = validate(body, PROFILE_UPDATE)
  return transaction((tx) => {
    const profile = profileOr404(tx.db, id)
    Object.assign(profile, updates)
    return profileOut(tx.db, profile)
  })
}

const recordOut = (r) => ({ id: r.id, type: r.type, title: r.title, details: r.details ?? null, date: r.date })
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)

function listRecords({ params, user }) {
  const id = intParam(params.id, 'profile_id')
  return read((db) => {
    const profile = profileOr404(db, id)
    authorizePatientAccess(user, profile)
    return db.medical_record_entries.filter((r) => r.patient_id === id).sort(byDateDesc).map(recordOut)
  })
}

function addRecord({ params, body, user }) {
  requireRoles(user, ['admin', 'doctor'])
  const id = intParam(params.id, 'profile_id')
  const payload = validate(body, {
    type: { type: 'str', required: true, strip: true, minLength: 1 },
    title: { type: 'str', required: true, strip: true, minLength: 1 },
    details: { type: 'str' },
  })
  return transaction((tx) => {
    profileOr404(tx.db, id)
    const entry = tx.insert('medical_record_entries', {
      patient_id: id,
      type: payload.type,
      title: payload.title,
      details: payload.details ?? null,
      date: now(),
    })
    return recordOut(entry)
  })
}

// ---------------------------------------------------------------------------
// assistant.py
// ---------------------------------------------------------------------------
// The record summary the API adds to its LLM prompt, as separate lines so
// the on-device assistant can quote the ones that bear on the question.
function patientRecord(requester, patientId) {
  if (!['doctor', 'admin'].includes(requester.role) && requester.id !== patientId) {
    throw new HttpError(403, "Not authorized to use this patient's context")
  }
  return read((db) => {
    const profile = db.patient_profiles.find((p) => p.user_id === patientId)
    if (!profile) throw new HttpError(404, 'Patient not found')
    const owner = db.users.find((u) => u.id === patientId)
    const records = db.medical_record_entries
      .filter((r) => r.patient_id === profile.id)
      .sort(byDateDesc)
      .slice(0, 8)
    const age = computeAge(profile.date_of_birth)
    const bmi = computeBmi(profile.height_cm, profile.weight_kg)
    const lines = [
      ...records.map((r) => `${r.title} (${r.type})${r.details ? `: ${r.details}` : ''}`),
      profile.allergies && `Allergies: ${profile.allergies}`,
      profile.chronic_conditions && `Chronic conditions: ${profile.chronic_conditions}`,
      profile.family_history && `Family history: ${profile.family_history}`,
      profile.smoking_status && `Smoking: ${profile.smoking_status}`,
      profile.alcohol_use && `Alcohol use: ${profile.alcohol_use}`,
      age !== null && `Age: ${age}`,
      bmi !== null && `BMI: ${bmi}`,
    ].filter(Boolean)
    const own = requester.id === patientId
    return { heading: own ? 'From your record:' : `From ${owner ? owner.full_name : 'this patient'}'s record:`, lines }
  })
}

async function chat({ body, user }) {
  const payload = validate(body, {
    message: { type: 'str', required: true, strip: true, minLength: 1 },
    patient_id: { type: 'int' },
  })
  const record = payload.patient_id ? patientRecord(user, payload.patient_id) : null

  const { answerQuestion } = await import('./rag.js')
  let result
  try {
    result = await answerQuestion(payload.message, { record, audience: user.role === 'patient' ? 'patient' : 'staff' })
  } catch {
    throw new HttpError(502, 'The AI assistant is temporarily unavailable. Please try again in a moment.')
  }

  transaction((tx) => {
    tx.insert('chat_messages', { user_id: user.id, role: 'user', content: payload.message, sources: null, created_at: now() })
    tx.insert('chat_messages', {
      user_id: user.id,
      role: 'assistant',
      content: result.answer,
      sources: result.sources,
      created_at: now(),
    })
  })
  return result
}

// Starts fetching the on-device model without waiting for it, so it's usually
// ready by the time the first question is typed.
function warmUpAssistant() {
  import('./rag.js')
    .then((rag) => rag.warmUp())
    .catch(() => {})
}

async function chatHistory({ user }) {
  // Opening the assistant is the cue to start fetching the model.
  warmUpAssistant()
  return read((db) =>
    db.chat_messages
      .filter((m) => m.user_id === user.id)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id))
      .map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
  )
}

// ---------------------------------------------------------------------------
// reports.py
// ---------------------------------------------------------------------------
async function analyzeReportRoute({ body, user }) {
  const payload = validate(body, { text: { type: 'str', required: true, strip: true, minLength: 1 } })
  const { analyzeReport } = await import('./reports.js')
  let result
  try {
    result = await analyzeReport(payload.text)
  } catch {
    throw new HttpError(502, 'Report analysis is temporarily unavailable. Please try again in a moment.')
  }
  const saved = transaction((tx) =>
    tx.insert('report_summaries', {
      user_id: user.id,
      raw_text: payload.text,
      entities: result.entities,
      patient_summary: result.patient_summary,
      clinical_summary: result.clinical_summary,
      created_at: now(),
    }),
  )
  return {
    id: saved.id,
    entities: result.entities,
    patient_summary: result.patient_summary,
    clinical_summary: user.role === 'patient' ? null : result.clinical_summary,
  }
}

function listReports({ user }) {
  return read((db) =>
    db.report_summaries
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
      .map((r) => ({
        id: r.id,
        entities: r.entities,
        patient_summary: r.patient_summary,
        clinical_summary: user.role === 'patient' ? null : r.clinical_summary,
        created_at: r.created_at,
      })),
  )
}

// ---------------------------------------------------------------------------
// risk.py
// ---------------------------------------------------------------------------
async function assessRisk({ body, user }) {
  const payload = validate(body, {
    age: { type: 'float', required: true, ge: 1, le: 120 },
    bmi: { type: 'float', required: true, ge: 10, le: 70 },
    systolic_bp: { type: 'float', required: true, ge: 70, le: 250 },
    glucose: { type: 'float', required: true, ge: 40, le: 500 },
    cholesterol: { type: 'float', required: true, ge: 80, le: 500 },
    smoker: { type: 'bool', notNull: true },
    family_history: { type: 'bool', notNull: true },
    activity_level: { type: 'int', required: true, ge: 0, le: 2 },
  })
  const inputs = { smoker: false, family_history: false, ...payload }
  const { assess } = await import('./risk.js')
  const result = assess(inputs)
  transaction((tx) =>
    tx.insert('risk_assessments', {
      user_id: user.id,
      inputs,
      diabetes_risk_pct: result.diabetes_risk_pct,
      heart_disease_risk_pct: result.heart_disease_risk_pct,
      created_at: now(),
    }),
  )
  return result
}

// ---------------------------------------------------------------------------
// medications.py
// ---------------------------------------------------------------------------
async function checkMedicationsRoute({ body }) {
  const payload = validate(body, { medications: { type: 'list', required: true, items: 'str', maxItems: 10 } })
  const { checkMedications } = await import('./medications.js')
  return checkMedications(payload.medications)
}

async function drugDirectory() {
  const { loadMedicationData } = await import('./medications.js')
  return { drugs: (await loadMedicationData()).directory }
}

async function conversionFamiliesRoute() {
  const { conversionFamilies } = await import('./medications.js')
  return { families: await conversionFamilies() }
}

async function convertRoute({ body }) {
  const payload = validate(body, {
    family: { type: 'str', required: true },
    from_drug: { type: 'str', required: true },
    to_drug: { type: 'str', required: true },
    dose_mg: { type: 'float', required: true, gt: 0, le: 10000 },
  })
  const { convertDose } = await import('./medications.js')
  return convertDose(payload.family, payload.from_drug, payload.to_drug, payload.dose_mg)
}

// ---------------------------------------------------------------------------
// dashboard.py
// ---------------------------------------------------------------------------
function dashboardStats({ user }) {
  return read((db) => {
    const userChats = (id) => db.chat_messages.filter((m) => m.role === 'user' && (id === undefined || m.user_id === id)).length
    if (user.role === 'admin') {
      const byType = new Map()
      for (const r of db.medical_record_entries) byType.set(r.type, (byType.get(r.type) || 0) + 1)
      return {
        role: 'admin',
        total_patients: db.patient_profiles.length,
        total_doctors: db.users.filter((u) => u.role === 'doctor').length,
        total_chats: userChats(),
        total_reports_analyzed: db.report_summaries.length,
        total_risk_assessments: db.risk_assessments.length,
        records_by_type: [...byType.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([type, count]) => ({ type, count })),
      }
    }
    if (user.role === 'doctor') {
      return {
        role: 'doctor',
        total_patients: db.patient_profiles.length,
        total_reports_analyzed: db.report_summaries.filter((r) => r.user_id === user.id).length,
        total_chats: userChats(user.id),
      }
    }
    const profile = db.patient_profiles.find((p) => p.user_id === user.id)
    const lastRisk = db.risk_assessments
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))[0]
    return {
      role: 'patient',
      record_count: profile ? db.medical_record_entries.filter((r) => r.patient_id === profile.id).length : 0,
      total_chats: userChats(user.id),
      total_reports_analyzed: db.report_summaries.filter((r) => r.user_id === user.id).length,
      last_risk_assessment: lastRisk
        ? { diabetes_risk_pct: lastRisk.diabetes_risk_pct, heart_disease_risk_pct: lastRisk.heart_disease_risk_pct }
        : null,
    }
  })
}

// ---------------------------------------------------------------------------
// appointments.py
// ---------------------------------------------------------------------------
function appointmentOut(db, appt, viewer) {
  const patient = db.users.find((u) => u.id === appt.patient_id)
  const doctor = db.users.find((u) => u.id === appt.doctor_id)
  return {
    id: appt.id,
    patient_id: appt.patient_id,
    doctor_id: appt.doctor_id,
    patient_name: patient ? patient.full_name : null,
    doctor_name: doctor ? doctor.full_name : null,
    scheduled_at: appt.scheduled_at,
    reason: appt.reason ?? null,
    status: appt.status,
    notes: viewer.role === 'patient' ? null : appt.notes ?? null,
    created_at: appt.created_at,
  }
}

function listDoctors() {
  return read((db) => db.users.filter((u) => u.role === 'doctor').map((d) => ({ id: d.id, full_name: d.full_name })))
}

function createAppointment({ body, user }) {
  const payload = validate(body, {
    doctor_id: { type: 'int', required: true },
    patient_id: { type: 'int' },
    scheduled_at: { type: 'datetime', required: true },
    reason: { type: 'str' },
  })
  return transaction((tx) => {
    const doctor = tx.db.users.find((u) => u.id === payload.doctor_id && u.role === 'doctor')
    if (!doctor) throw new HttpError(404, 'Doctor not found')
    let patientId
    let status
    if (user.role === 'patient') {
      patientId = user.id
      status = 'requested'
    } else {
      if (!payload.patient_id) throw new HttpError(400, 'patient_id is required when staff books an appointment')
      const patient = tx.db.users.find((u) => u.id === payload.patient_id && u.role === 'patient')
      if (!patient) throw new HttpError(404, 'Patient not found')
      patientId = patient.id
      status = 'confirmed'
    }
    const appt = tx.insert('appointments', {
      patient_id: patientId,
      doctor_id: doctor.id,
      scheduled_at: payload.scheduled_at,
      reason: payload.reason ?? null,
      status,
      notes: null,
      created_at: now(),
    })
    return appointmentOut(tx.db, appt, user)
  })
}

function listAppointments({ user }) {
  return read((db) =>
    db.appointments
      .filter((a) => (user.role === 'patient' ? a.patient_id === user.id : user.role === 'doctor' ? a.doctor_id === user.id : true))
      .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : a.id - b.id))
      .map((a) => appointmentOut(db, a, user)),
  )
}

function updateAppointment({ params, body, user }) {
  if (!['admin', 'doctor'].includes(user.role)) throw new HttpError(403, 'Not authorized to update appointments')
  const id = intParam(params.id, 'appointment_id')
  const updates = validate(body, {
    status: { type: 'str' },
    notes: { type: 'str' },
    scheduled_at: { type: 'datetime' },
  })
  return transaction((tx) => {
    const appt = tx.db.appointments.find((a) => a.id === id)
    if (!appt) throw new HttpError(404, 'Appointment not found')
    if (user.role === 'doctor' && appt.doctor_id !== user.id) {
      throw new HttpError(403, 'Not authorized to update this appointment')
    }
    for (const [field, value] of Object.entries(updates)) {
      // status and scheduled_at are NOT NULL columns.
      if (value === null && field !== 'notes') continue
      appt[field] = value
    }
    return appointmentOut(tx.db, appt, user)
  })
}

// ---------------------------------------------------------------------------
// reminders.py
// ---------------------------------------------------------------------------
const PROGRESS_WINDOW_DAYS = 7

const reminderOut = (r) => ({
  id: r.id,
  medication_name: r.medication_name,
  dosage: r.dosage ?? null,
  frequency: r.frequency ?? null,
  start_date: r.start_date ?? null,
  active: r.active,
  created_at: r.created_at,
})

function createReminder({ body, user }) {
  requireRoles(user, ['patient'])
  const payload = validate(body, {
    medication_name: { type: 'str', required: true },
    dosage: { type: 'str' },
    frequency: { type: 'str' },
    start_date: { type: 'str' },
  })
  return transaction((tx) =>
    reminderOut(
      tx.insert('medication_reminders', {
        user_id: user.id,
        medication_name: payload.medication_name,
        dosage: payload.dosage ?? null,
        frequency: payload.frequency ?? null,
        start_date: payload.start_date ?? null,
        active: true,
        created_at: now(),
      }),
    ),
  )
}

function listReminders({ user }) {
  requireRoles(user, ['patient'])
  return read((db) =>
    db.medication_reminders
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => Number(b.active) - Number(a.active) || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
      .map(reminderOut),
  )
}

function ownReminder(db, user, id) {
  const reminder = db.medication_reminders.find((r) => r.id === id && r.user_id === user.id)
  if (!reminder) throw new HttpError(404, 'Reminder not found')
  return reminder
}

function updateReminder({ params, body, user }) {
  requireRoles(user, ['patient'])
  const id = intParam(params.id, 'reminder_id')
  const updates = validate(body, {
    medication_name: { type: 'str' },
    dosage: { type: 'str' },
    frequency: { type: 'str' },
    active: { type: 'bool' },
  })
  return transaction((tx) => {
    const reminder = ownReminder(tx.db, user, id)
    for (const [field, value] of Object.entries(updates)) {
      if (value === null && (field === 'medication_name' || field === 'active')) continue
      reminder[field] = value
    }
    return reminderOut(reminder)
  })
}

function logReminder({ params, body, user }) {
  requireRoles(user, ['patient'])
  const id = intParam(params.id, 'reminder_id')
  const payload = validate(body, { status: { type: 'str', required: true } })
  return transaction((tx) => {
    const reminder = ownReminder(tx.db, user, id)
    if (!['taken', 'skipped'].includes(payload.status)) {
      throw new HttpError(400, "status must be 'taken' or 'skipped'")
    }
    tx.insert('medication_logs', { reminder_id: reminder.id, taken_at: now(), status: payload.status })
    return { ok: true }
  })
}

function reminderProgress({ user }) {
  requireRoles(user, ['patient'])
  return read((db) => {
    const since = new Date(Date.now() - PROGRESS_WINDOW_DAYS * 86400 * 1000).toISOString()
    let totalTaken = 0
    let totalLogged = 0
    const reminders = db.medication_reminders
      .filter((r) => r.user_id === user.id)
      .map((reminder) => {
        const logs = db.medication_logs.filter((l) => l.reminder_id === reminder.id && l.taken_at >= since)
        const taken = logs.filter((l) => l.status === 'taken').length
        const skipped = logs.filter((l) => l.status === 'skipped').length
        const total = taken + skipped
        totalTaken += taken
        totalLogged += total
        return {
          reminder_id: reminder.id,
          medication_name: reminder.medication_name,
          taken_count: taken,
          skipped_count: skipped,
          adherence_pct: total ? pyRound((taken / total) * 100, 1) : 0.0,
        }
      })
    return { reminders, overall_adherence_pct: totalLogged ? pyRound((totalTaken / totalLogged) * 100, 1) : 0.0 }
  })
}

// ---------------------------------------------------------------------------
// Route table. Order matters where paths overlap (/patients/me/profile must
// win over /patients/:id), exactly as in the FastAPI routers.
// ---------------------------------------------------------------------------
export const routes = [
  ['GET', '/health', () => ({ status: 'ok' }), { public: true }],

  ['POST', '/auth/register', register, { public: true }],
  ['POST', '/auth/create-staff', createStaff],
  ['POST', '/auth/login', login, { public: true }],
  ['GET', '/auth/me', me],
  ['PUT', '/auth/me', updateMe],

  ['GET', '/patients', listPatients],
  ['GET', '/patients/me/profile', getMyProfile],
  ['PUT', '/patients/me/profile', updateMyProfile],
  ['GET', '/patients/:id', getPatient],
  ['PUT', '/patients/:id', updatePatient],
  ['GET', '/patients/:id/records', listRecords],
  ['POST', '/patients/:id/records', addRecord],

  ['POST', '/assistant/chat', chat],
  ['GET', '/assistant/history', chatHistory],

  ['POST', '/reports/analyze', analyzeReportRoute],
  ['GET', '/reports', listReports],

  ['POST', '/risk/assess', assessRisk],

  ['POST', '/medications/check', checkMedicationsRoute],
  ['GET', '/medications/directory', drugDirectory],
  ['GET', '/medications/conversion-families', conversionFamiliesRoute],
  ['POST', '/medications/convert', convertRoute],

  ['GET', '/dashboard/stats', dashboardStats],

  ['GET', '/appointments/doctors', listDoctors],
  ['POST', '/appointments', createAppointment],
  ['GET', '/appointments', listAppointments],
  ['PATCH', '/appointments/:id', updateAppointment],

  ['POST', '/reminders', createReminder],
  ['GET', '/reminders', listReminders],
  ['GET', '/reminders/progress', reminderProgress],
  ['PATCH', '/reminders/:id', updateReminder],
  ['POST', '/reminders/:id/log', logReminder],
]
