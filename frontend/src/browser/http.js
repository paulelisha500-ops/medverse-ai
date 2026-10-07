// HTTP-shaped errors and request validation for the in-browser API.
//
// Handlers throw HttpError exactly where the FastAPI routes raise
// HTTPException, and validate() reproduces the 422 bodies pydantic produces,
// so the pages (and api/errors.js) can't tell the two backends apart.

export class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : 'Request validation failed')
    this.status = status
    this.detail = detail
  }
}

export const STATUS_TEXT = {
  200: 'OK',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  507: 'Insufficient Storage',
}

// ---------------------------------------------------------------------------
// Field specs, mirroring app/schemas.py:
//   { type: 'str' | 'int' | 'float' | 'bool' | 'email' | 'datetime' | 'list',
//     required, notNull (has a default but isn't Optional), strip (NonEmptyStr),
//     minLength, maxBytes,
//     ge, le, gt, maxItems, items }
// validate() returns only the fields the request actually sent — the
// equivalent of model_dump(exclude_unset=True) — with defaults left to the
// caller.
// ---------------------------------------------------------------------------

export function validate(body, spec, root = 'body') {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : null
  if (!input) {
    throw new HttpError(422, [{ type: 'missing', loc: [root], msg: 'Field required', input: null }])
  }
  const errors = []
  const out = {}
  for (const [field, rule] of Object.entries(spec)) {
    const loc = [root, field]
    if (!(field in input)) {
      if (rule.required) errors.push({ type: 'missing', loc, msg: 'Field required', input })
      continue
    }
    const value = input[field]
    if (value === null || value === undefined) {
      if (rule.required || rule.notNull) {
        errors.push({ type: `${rule.type}_type`, loc, msg: typeMessage(rule.type), input: value })
      } else {
        out[field] = null
      }
      continue
    }
    const result = coerce(value, rule)
    if (result.error) errors.push({ ...result.error, loc, input: value })
    else out[field] = result.value
  }
  if (errors.length) throw new HttpError(422, errors)
  return out
}

function typeMessage(type) {
  return {
    str: 'Input should be a valid string',
    email: 'Input should be a valid string',
    int: 'Input should be a valid integer',
    float: 'Input should be a valid number',
    bool: 'Input should be a valid boolean',
    datetime: 'Input should be a valid datetime',
    list: 'Input should be a valid list',
  }[type]
}

function coerce(value, rule) {
  switch (rule.type) {
    case 'str':
      return coerceString(value, rule)
    case 'email':
      return coerceEmail(value)
    case 'int':
    case 'float':
      return coerceNumber(value, rule)
    case 'bool':
      return coerceBool(value)
    case 'datetime':
      return coerceDatetime(value)
    case 'list':
      return coerceList(value, rule)
    default:
      throw new Error(`unknown field type ${rule.type}`)
  }
}

function coerceString(value, rule) {
  if (typeof value !== 'string') {
    return { error: { type: 'string_type', msg: 'Input should be a valid string' } }
  }
  const v = rule.strip ? value.trim() : value
  if (rule.minLength && v.length < rule.minLength) {
    const n = rule.minLength
    return {
      error: { type: 'string_too_short', msg: `String should have at least ${n} character${n === 1 ? '' : 's'}` },
    }
  }
  if (rule.maxBytes && new TextEncoder().encode(v).length > rule.maxBytes) {
    return { error: { type: 'value_error', msg: `Value error, ${rule.maxBytesMessage}` } }
  }
  return { value: v }
}

function coerceNumber(value, rule) {
  let n = value
  if (typeof value === 'string') {
    if (!value.trim() || Number.isNaN(Number(value))) {
      return {
        error: rule.type === 'int'
          ? { type: 'int_parsing', msg: 'Input should be a valid integer, unable to parse string as an integer' }
          : { type: 'float_parsing', msg: 'Input should be a valid number, unable to parse string as a number' },
      }
    }
    n = Number(value)
  }
  if (typeof n === 'boolean') n = n ? 1 : 0
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return { error: { type: `${rule.type}_type`, msg: typeMessage(rule.type) } }
  }
  if (rule.type === 'int' && !Number.isInteger(n)) {
    return { error: { type: 'int_from_float', msg: 'Input should be a valid integer, got a number with a fractional part' } }
  }
  if (rule.gt !== undefined && !(n > rule.gt)) {
    return { error: { type: 'greater_than', msg: `Input should be greater than ${rule.gt}` } }
  }
  if (rule.ge !== undefined && n < rule.ge) {
    return { error: { type: 'greater_than_equal', msg: `Input should be greater than or equal to ${rule.ge}` } }
  }
  if (rule.le !== undefined && n > rule.le) {
    return { error: { type: 'less_than_equal', msg: `Input should be less than or equal to ${rule.le}` } }
  }
  return { value: n }
}

const TRUE_STRINGS = new Set(['1', 'on', 't', 'true', 'y', 'yes'])
const FALSE_STRINGS = new Set(['0', 'off', 'f', 'false', 'n', 'no'])

function coerceBool(value) {
  if (typeof value === 'boolean') return { value }
  if (value === 0 || value === 1) return { value: value === 1 }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (TRUE_STRINGS.has(v)) return { value: true }
    if (FALSE_STRINGS.has(v)) return { value: false }
  }
  return { error: { type: 'bool_parsing', msg: 'Input should be a valid boolean, unable to interpret input' } }
}

// Naive datetimes are taken as UTC, like schemas._to_naive_utc.
function coerceDatetime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/.test(value)) {
    return { error: { type: 'datetime_from_date_parsing', msg: 'Input should be a valid datetime' } }
  }
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const date = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(date.getTime())) {
    return { error: { type: 'datetime_from_date_parsing', msg: 'Input should be a valid datetime' } }
  }
  return { value: date.toISOString() }
}

function coerceList(value, rule) {
  if (!Array.isArray(value)) return { error: { type: 'list_type', msg: 'Input should be a valid list' } }
  if (rule.maxItems !== undefined && value.length > rule.maxItems) {
    return {
      error: {
        type: 'too_long',
        msg: `List should have at most ${rule.maxItems} item${rule.maxItems === 1 ? '' : 's'} after validation, not ${value.length}`,
      },
    }
  }
  if (rule.items === 'str' && value.some((v) => typeof v !== 'string')) {
    return { error: { type: 'string_type', msg: 'Input should be a valid string' } }
  }
  return { value: [...value] }
}

// A practical subset of what email-validator (pydantic's EmailStr) enforces,
// with its wording. Like EmailStr, the domain is lower-cased; the local part
// is kept as typed.
function coerceEmail(value) {
  if (typeof value !== 'string') return { error: { type: 'string_type', msg: 'Input should be a valid string' } }
  const reason = emailProblem(value)
  if (reason) return { error: { type: 'value_error', msg: `value is not a valid email address: ${reason}` } }
  const at = value.lastIndexOf('@')
  return { value: `${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}` }
}

function emailProblem(email) {
  const at = email.lastIndexOf('@')
  if (at === -1) return 'An email address must have an @-sign.'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!local) return 'There must be something before the @-sign.'
  if (!domain) return 'There must be something after the @-sign.'
  if (/\s/.test(email)) return 'The email address contains invalid characters (whitespace).'
  if (local.length > 64) return 'The email address is too long before the @-sign.'
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return 'The part before the @-sign is not valid.'
  }
  if (!domain.includes('.')) return 'The part after the @-sign is not valid. It should have a period.'
  const labels = domain.split('.')
  if (labels.some((l) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(l))) {
    return 'The part after the @-sign is not valid.'
  }
  if (!/^[A-Za-z]{2,63}$/.test(labels[labels.length - 1]) && !/^xn--/.test(labels[labels.length - 1])) {
    return 'The part after the @-sign is not valid. It is not within a valid top-level domain.'
  }
  return null
}

// Path parameters typed `int` in the routes.
export function intParam(raw, name) {
  if (!/^[+-]?\d+$/.test(raw)) {
    throw new HttpError(422, [
      {
        type: 'int_parsing',
        loc: ['path', name],
        msg: 'Input should be a valid integer, unable to parse string as an integer',
        input: raw,
      },
    ])
  }
  return Number(raw)
}

// Python's round(x, n), so numbers match the API's to the last digit. Both
// round the exact binary value (0.075 is really 0.07499…, so it rounds to
// 0.07); where toFixed breaks an exact tie away from zero (35.25 -> 35.3),
// Python rounds to even (35.2).
export function pyRound(x, digits = 0) {
  if (!Number.isFinite(x)) return x
  const abs = Math.abs(x)
  const exact = abs.toFixed(Math.min(100, digits + 60))
  const point = exact.indexOf('.')
  const kept = exact.slice(0, point + 1 + digits)
  const tail = exact.slice(point + 1 + digits)
  let magnitude = Number(abs.toFixed(digits))
  if (/^50*$/.test(tail) && Number(kept.replace('.', '').slice(-1)) % 2 === 0) magnitude = Number(kept)
  return x < 0 ? -magnitude : magnitude
}
