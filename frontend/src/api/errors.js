/**
 * Turns an axios error from the API into a message that is safe to render.
 *
 * FastAPI sends `detail` in two shapes: a string for errors the handlers raise
 * themselves ("An account with this email already exists"), and an array of
 * `{ loc, msg, type }` objects when request validation fails. Rendering that
 * array directly as `{error}` throws — React can't render plain objects — and
 * with no boundary above it the whole page goes blank. A sign-up with
 * `test@localhost` did exactly that: the browser's email check accepts it and
 * the API's rejects it.
 */
export function apiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const messages = detail.map(describeValidationError).filter(Boolean)
    if (messages.length) return messages.join(' ')
  }

  return fallback
}

function describeValidationError(item) {
  if (!item || typeof item.msg !== 'string') return null
  // loc looks like ["body", "full_name"]; the last segment names the field.
  const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null
  const msg = item.msg.replace(/^Value error, /, '')
  if (typeof field !== 'string' || field === 'body') return sentence(msg)
  const label = field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  return sentence(`${label}: ${lowerFirst(msg)}`)
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1)
const sentence = (s) => (/[.!?]$/.test(s) ? s : `${s}.`)
