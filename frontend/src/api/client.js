import axios from 'axios'
import { storage } from './storage.js'

const client = axios.create({
  baseURL: '/api',
})

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
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
