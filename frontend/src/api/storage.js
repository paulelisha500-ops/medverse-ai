// localStorage throws when site data is blocked (private mode, strict browser
// settings). Fall back to memory so login still works for the current session.
const memory = {}

export const storage = {
  get(key) {
    try {
      const value = localStorage.getItem(key)
      if (value !== null) return value
    } catch {
      // storage unavailable
    }
    return memory[key] ?? null
  },
  set(key, value) {
    memory[key] = value
    try {
      localStorage.setItem(key, value)
    } catch {
      // storage unavailable
    }
  },
  remove(key) {
    delete memory[key]
    try {
      localStorage.removeItem(key)
    } catch {
      // storage unavailable
    }
  },
}
