/**
 * API service for ArogyaSaarthi AI
 * All protected calls attach Firebase ID token via Authorization: Bearer header.
 */
import { auth } from '../firebase'

const BASE = import.meta.env.VITE_API_URL || ''

/** Custom error classes for better error handling */
export class AuthError extends Error {
  constructor(msg) { super(msg); this.name = 'AuthError' }
}
export class NetworkError extends Error {
  constructor(msg) { super(msg); this.name = 'NetworkError' }
}
export class ServerError extends Error {
  constructor(msg, status) { super(msg); this.name = 'ServerError'; this.status = status }
}

async function getToken() {
  const user = auth.currentUser
  if (!user) throw new AuthError('Not authenticated')
  return user.getIdToken()
}

async function authPost(path, body) {
  let token
  try { token = await getToken() }
  catch (e) { throw new AuthError(e.message || 'Not authenticated') }
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (res.status === 401) { const e = await res.json().catch(() => ({})); throw new AuthError(e.error || 'Session expired') }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new ServerError(e.error || `Request failed: ${res.status}`, res.status) }
    return res.json()
  } catch (e) {
    if (e instanceof AuthError || e instanceof ServerError) throw e
    if (e.name === 'AbortError') throw new NetworkError('Request timed out')
    throw new NetworkError('Could not connect to server')
  } finally { clearTimeout(tm) }
}

async function authGet(path) {
  let token
  try { token = await getToken() }
  catch (e) { throw new AuthError(e.message || 'Not authenticated') }
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
    if (res.status === 401) { const e = await res.json().catch(() => ({})); throw new AuthError(e.error || 'Session expired') }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new ServerError(e.error || `Request failed: ${res.status}`, res.status) }
    return res.json()
  } catch (e) {
    if (e instanceof AuthError || e instanceof ServerError) throw e
    if (e.name === 'AbortError') throw new NetworkError('Request timed out')
    throw new NetworkError('Could not connect to server')
  } finally { clearTimeout(tm) }
}

export async function sendChat(message, language = 'en', sessionId = null) {
  return authPost('/api/chat', { message, language, sessionId })
}
export async function executeAction(actionId, payload = {}, sessionId = null, language = 'en') {
  return authPost('/api/chat/action', { actionId, payload, sessionId, language })
}
export async function fetchFollowups(symptoms, ageGroup, duration, severity, language = 'en') {
  return authPost('/api/symptom-checker/followups', { symptoms, ageGroup, duration, severity, language })
}
export async function submitSymptomCheckerTriage(data) {
  return authPost('/api/symptom-checker/triage', data)
}
export async function fetchSuggestedFacilities(careLevel, location, language = 'en') {
  return authPost('/api/symptom-checker/facilities', { careLevel, location, language })
}
export async function fetchNearbyFacilities(pincode) {
  return authGet(`/api/facilities/nearby?pincode=${encodeURIComponent(pincode)}`)
}
