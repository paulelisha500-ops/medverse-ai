import axios from 'axios'
import { storage } from './storage.js'

const client = axios.create({
  baseURL: '/api',
})

if (__BROWSER_EDITION__) {
  // No server in the browser edition: src/browser/ implements the API in
  // the page, and this adapter hands each request to it.
  client.defaults.adapter = (config) => import('../browser/server.js').then((api) => api.handle(config))
}

client.interceptors.request.use((config) => {
  const token = storage.get('medverse_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      storage.remove('medverse_token')
      storage.remove('medverse_user')
      if (__BROWSER_EDITION__) {
        if (!window.location.hash.startsWith('#/login')) {
          window.location.hash = '#/login'
          window.location.reload()
        }
      } else if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
