import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client.js'
import { storage } from '../api/storage.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = storage.get('medverse_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null // corrupt stored value — treat as signed out
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = storage.get('medverse_token')
    if (!token) {
      setLoading(false)
      return
    }
    client
      .get('/auth/me')
      .then((res) => {
        setUser(res.data)
        storage.set('medverse_user', JSON.stringify(res.data))
      })
      .catch(() => {
        storage.remove('medverse_token')
        storage.remove('medverse_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await client.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    storage.set('medverse_token', res.data.access_token)
    storage.set('medverse_user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  async function register(fullName, email, password) {
    const res = await client.post('/auth/register', {
      full_name: fullName,
      email,
      password,
    })
    storage.set('medverse_token', res.data.access_token)
    storage.set('medverse_user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  function logout() {
    storage.remove('medverse_token')
    storage.remove('medverse_user')
    setUser(null)
  }

  function updateUser(updated) {
    storage.set('medverse_user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
