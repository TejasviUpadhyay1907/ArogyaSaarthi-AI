const BASE_URL = import.meta.env.VITE_API_URL || ''

// Chat endpoint — preserves session memory for context-aware routing
export async function sendChat(message, language = 'en', sessionId = null) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, sessionId }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Card button action executor — routes to real backend tools
export async function executeAction(actionId, payload = {}, sessionId = null, language = 'en') {
  const res = await fetch(`${BASE_URL}/api/chat/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionId, payload, sessionId, language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error: ${res.status}`)
  }
  return res.json()
}

// Legacy triage endpoint (Symptom Checker page still uses this)
export async function triageSymptoms(text, language = 'hi') {
  const res = await fetch(`${BASE_URL}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Symptom Checker — fetch dynamic follow-up questions
export async function fetchFollowups(selectedSymptoms, ageGroup, duration, severity, language = 'en') {
  const res = await fetch(`${BASE_URL}/api/symptom-checker/followups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedSymptoms, ageGroup, duration, severity, language }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Symptom Checker — submit full payload and get triage card
export async function submitSymptomCheckerTriage(payload) {
  const res = await fetch(`${BASE_URL}/api/symptom-checker/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Symptom Checker — fetch suggested facilities by careLevel + location
export async function fetchSuggestedFacilities(careLevel, locationText, language = 'en') {
  const params = new URLSearchParams({ careLevel, language })
  if (locationText) params.set('locationText', locationText)
  const res = await fetch(`${BASE_URL}/api/facilities/suggested?${params}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getMetrics() {
  const res = await fetch(`${BASE_URL}/metrics`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Nearby facilities — real-world pincode lookup via OSM/Overpass
export async function fetchNearbyFacilities(pincode) {
  const res = await fetch(`${BASE_URL}/api/facilities/nearby?pincode=${encodeURIComponent(pincode)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error: ${res.status}`)
  }
  return res.json()
}
