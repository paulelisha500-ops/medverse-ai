import { useSyncExternalStore } from 'react'

// Download/readiness of the assistant's on-device embedding model, shared
// between the retrieval code (writer) and the Assistant page (reader). Kept
// apart from rag.js so reading the status never pulls in the model code.
//   state: 'idle' | 'loading' | 'ready' | 'unavailable'
let status = { state: 'idle', loaded: 0, total: 0 }
const listeners = new Set()

export function setModelStatus(next) {
  status = { ...status, ...next }
  listeners.forEach((listener) => listener())
}

export function getModelStatus() {
  return status
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useModelStatus() {
  return useSyncExternalStore(subscribe, getModelStatus)
}
