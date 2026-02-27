/**
 * API service for ArogyaSaarthi AI
 * All protected calls attach Firebase ID token via Authorization: Bearer header.
 */
import { auth } from '../firebase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

/** Get current user Firebase ID token */
async function getToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

/** Authenticated POST */
async function authPost(path, body) {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

/** Authenticated GET */
async function authGet(path) {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Chat
export async function sendChat(text, language = 'en', sessionId = null) {
  return authPost('/api/chat', { text, language, sessionId })
}

export async function executeAction(actionId, payload = {}, sessionId = null, language = 'en') {
  return authPost('/api/chat/action', { actionId, payload, sessionId, language })
}

// Symptom Checker
export async function fetchFollowups(symptoms, ageGroup, duration, severity, language = 'en') {
  return authPost('/api/symptom-checker/followups', { symptoms, ageGroup, duration, severity, language })
}

export async function submitSymptomCheckerTriage(data) {
  return authPost('/api/symptom-checker/triage', data)
}

export async function fetchSuggestedFacilities(careLevel, location, language = 'en') {
  return authPost('/api/symptom-checker/facilities', { careLevel, location, language })
}

// Nearby Facilities
export async function fetchNearbyFacilities(pincode) {
  return authGet(`/api/facilities/nearby?pincode=${encodeURIComponent(pincode)}`)
}
