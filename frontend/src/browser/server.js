// An axios adapter that answers the app's /api requests inside the page.
//
// In the browser edition (vite --mode browser) api/client.js routes every
// request here instead of over the network. Each request is matched against
// the route table in api.js; responses and errors come back as axios would
// deliver them from the FastAPI server, so pages and error handling run
// unchanged.

import { AxiosError } from 'axios'
import { currentUser, routes } from './api.js'
import { ready } from './db.js'
import { HttpError, STATUS_TEXT } from './http.js'

const compiled = routes.map(([method, path, handler, options = {}]) => {
  const keys = []
  const source = path.replace(/:(\w+)/g, (_, key) => {
    keys.push(key)
    return '([^/]+)'
  })
  return { method, pattern: new RegExp(`^${source}/?$`), keys, handler, options }
})

function headerMap(headers) {
  const plain = headers && typeof headers.toJSON === 'function' ? headers.toJSON() : { ...(headers || {}) }
  const map = {}
  for (const [name, value] of Object.entries(plain)) {
    if (value !== undefined && value !== null) map[name.toLowerCase()] = String(value)
  }
  return map
}

function parseBody(data, headers) {
  if (data === undefined || data === null || data === '') return null
  if (typeof data !== 'string') return data
  if ((headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(data))
  }
  try {
    return JSON.parse(data)
  } catch {
    throw new HttpError(422, [{ type: 'json_invalid', loc: ['body', 0], msg: 'JSON decode error', input: {} }])
  }
}

async function dispatch(config) {
  await ready()
  const method = (config.method || 'get').toUpperCase()
  const url = new URL(String(config.url || '').replace(/^\/api(?=\/)/, ''), 'http://medverse.local')
  const query = { ...Object.fromEntries(url.searchParams), ...(config.params || {}) }

  let pathMatched = false
  for (const route of compiled) {
    const match = route.pattern.exec(url.pathname)
    if (!match) continue
    pathMatched = true
    if (route.method !== method) continue

    const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]))
    const headers = headerMap(config.headers)
    // Like FastAPI, authentication is checked before the body is parsed.
    const user = route.options.public ? null : currentUser({ authorization: headers.authorization })
    const body = parseBody(config.data, headers)
    return route.handler({ params, query, body, headers, user })
  }
  throw pathMatched ? new HttpError(405, 'Method Not Allowed') : new HttpError(404, 'Not Found')
}

export async function handle(config) {
  try {
    const data = await dispatch(config)
    return {
      data: data === undefined ? null : structuredClone(data),
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config,
      request: {},
    }
  } catch (err) {
    const error = err instanceof HttpError ? err : new HttpError(500, 'Internal Server Error')
    if (!(err instanceof HttpError)) console.error('[MedVerse browser API]', err)
    const response = {
      data: { detail: error.detail },
      status: error.status,
      statusText: STATUS_TEXT[error.status] || 'Error',
      headers: { 'content-type': 'application/json' },
      config,
      request: {},
    }
    throw new AxiosError(
      `Request failed with status code ${error.status}`,
      error.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    )
  }
}
