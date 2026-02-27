import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n/LangContext'
import { fetchFollowups, submitSymptomCheckerTriage, fetchSuggestedFacilities } from '../services/api'

// ── Constants ──────────────────────────────────────────────────────────────
const PATIENT_TYPES = [
  { v: 'myself',   icon: '🧑', labelKey: 'checker.patient.myself' },
  { v: 'child',    icon: '👶', labelKey: 'checker.patient.child' },
  { v: 'elderly',  icon: '👴', labelKey: 'checker.patient.elderly' },
  { v: 'pregnant', icon: '🤰', labelKey: 'checker.patient.pregnant' },
]
const AGE_GROUPS = [
  { v: '0-5',   label: '0–5' },
  { v: '6-17',  label: '6–17' },
  { v: '18-59', label: '18–59' },
  { v: '60+',   label: '60+' },
]
const TRIMESTERS = [
  { v: 'T1', label: 'T1 (1–3 mo)' },
  { v: 'T2', label: 'T2 (4–6 mo)' },
  { v: 'T3', label: 'T3 (7–9 mo)' },
]
const COMMON_SYMPTOMS = [
  { v: 'fever',          icon: '🌡️', labelKey: 'checker.sym.fever' },
  { v: 'cough',          icon: '😮‍💨', labelKey: 'checker.sym.cough' },
  { v: 'cold',           icon: '🤧', labelKey: 'checker.sym.cold' },
  { v: 'headache',       icon: '🤕', labelKey: 'checker.sym.headache' },
  { v: 'stomach_pain',   icon: '🤢', labelKey: 'checker.sym.stomach_pain' },
  { v: 'chest_pain',     icon: '💔', labelKey: 'checker.sym.chest_pain' },
  { v: 'breathlessness', icon: '😮', labelKey: 'checker.sym.breathlessness' },
  { v: 'vomiting',       icon: '🤮', labelKey: 'checker.sym.vomiting' },
  { v: 'diarrhea',       icon: '🚽', labelKey: 'checker.sym.diarrhea' },
  { v: 'body_ache',      icon: '🦴', labelKey: 'checker.sym.body_ache' },
  { v: 'weakness',       icon: '😴', labelKey: 'checker.sym.weakness' },
  { v: 'rash',           icon: '🔴', labelKey: 'checker.sym.rash' },
]
const DURATIONS = [
  { v: 'today',    labelKey: 'checker.dur.today' },
  { v: '1-2days',  labelKey: 'checker.dur.1_2days' },
  { v: '3-7days',  labelKey: 'checker.dur.3_7days' },
  { v: 'week+',    labelKey: 'checker.dur.week_plus' },
]
const SEVERITIES = [
  { v: 'mild',     icon: '🟢', labelKey: 'checker.sev.mild' },
  { v: 'moderate', icon: '🟡', labelKey: 'checker.sev.moderate' },
  { v: 'severe',   icon: '🔴', labelKey: 'checker.sev.severe' },
]

// ── Sub-components ─────────────────────────────────────────────────────────
function Chip({ selected, onClick, children, color = 'green' }) {
  const colors = {
    green: selected ? 'border-green-500 bg-green-50 text-green-700 shadow-green-100' : 'border-gray-200 bg-white text-gray-700 hover:border-green-300',
    red:   selected ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700 hover:border-red-300',
    amber: selected ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300',
  }
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all duration-150 cursor-pointer ${colors[color]}`}
    >
      {children}
    </button>
  )
}

function UrgencyBadge({ urgency, t }) {
  const label = t ? (t(`urgency.${urgency}`) || urgency) : urgency
  const bg = { HIGH: 'bg-red-500', MEDIUM: 'bg-amber-500', LOW: 'bg-emerald-500' }[urgency] || 'bg-gray-400'
  return (
    <span className={`inline-block ${bg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
      {label}
    </span>
  )
}

function ActionBtn({ action, onAction, t }) {
  const isPrimary = action.priority === 'PRIMARY'
  const label = t ? (t(`action.${action.actionId}`) || action.label) : action.label
  return (
    <button
      onClick={() => onAction(action.actionId)}
      className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 cursor-pointer border-none ${
        isPrimary
          ? 'text-white hover:-translate-y-0.5 hover:shadow-lg'
          : 'border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400'
      }`}
      style={isPrimary ? { background: 'linear-gradient(135deg, #2E8B57, #0077B6)' } : {}}
    >
      {label}
    </button>
  )
}

function FacilitiesList({ facilities, t }) {
  if (!facilities?.length) return null
  return (
    <div className="mt-4 space-y-2">
      {facilities.map(f => (
        <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3 flex justify-between items-start gap-2">
          <div>
            <div className="font-semibold text-gray-800 text-sm">{f.name}</div>
            <div className="text-xs text-gray-500">{f.address} · {f.hours}</div>
            {f.phone && <div className="text-xs text-blue-600 mt-0.5">📞 {f.phone}</div>}
          </div>
          <div className="text-xs text-gray-400 whitespace-nowrap">{f.distanceKm} {t('card.km')}</div>
        </div>
      ))}
    </div>
  )
}

function TriageResultCard({ card, onAction, t }) {
  const colorMap = {
    HIGH:   { border: 'border-red-300',     bg: 'from-red-50 to-red-100/60',         text: 'text-red-700' },
    MEDIUM: { border: 'border-amber-300',   bg: 'from-amber-50 to-amber-100/60',     text: 'text-amber-700' },
    LOW:    { border: 'border-emerald-300', bg: 'from-emerald-50 to-green-100/60',   text: 'text-emerald-700' },
  }
  const c = colorMap[card.urgency] || colorMap.MEDIUM
  return (
    <div className={`bg-gradient-to-br ${c.bg} border-2 ${c.border} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <UrgencyBadge urgency={card.urgency} t={t} />
        <span className="text-xs text-gray-500 font-medium">{card.timeToAct}</span>
      </div>
      <div className={`font-bold text-base ${c.text} mb-3`}>{card.headline}</div>
      {card.why?.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t('sc.whyLabel')}</div>
          {card.why.map((w, i) => <div key={i} className="text-sm text-gray-700">• {w}</div>)}
        </div>
      )}
      {card.watchFor?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t('sc.watchForLabel')}</div>
          {card.watchFor.map((w, i) => <div key={i} className="text-sm text-gray-700">⚠ {w}</div>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {card.actions?.map(a => <ActionBtn key={a.actionId} action={a} onAction={onAction} t={t} />)}
      </div>
    </div>
  )
}

// ── Step 1: Context ────────────────────────────────────────────────────────
function Step1({ state, setState, t }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-bold text-gray-600 mb-2">{t('sc.whoFor')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PATIENT_TYPES.map(p => (
            <button
              key={p.v}
              onClick={() => setState(s => ({ ...s, patient: p.v }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 font-semibold text-sm transition-all cursor-pointer ${
                state.patient === p.v
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
              }`}
            >
              <span className="text-3xl">{p.icon}</span>
              <span className="text-xs">{t(p.labelKey)}</span>
              {state.patient === p.v && <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-gray-600 mb-2">{t('sc.ageGroup')}</div>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map(a => (
            <Chip key={a.v} selected={state.ageGroup === a.v} onClick={() => setState(s => ({ ...s, ageGroup: a.v }))}>
              {a.label}
            </Chip>
          ))}
        </div>
      </div>

      {state.patient === 'pregnant' && (
        <div>
          <div className="text-sm font-bold text-gray-600 mb-2">{t('sc.trimester')}</div>
          <div className="flex flex-wrap gap-2">
            {TRIMESTERS.map(tr => (
              <Chip key={tr.v} selected={state.trimester === tr.v} onClick={() => setState(s => ({ ...s, trimester: s.trimester === tr.v ? null : tr.v }))}>
                {tr.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Symptoms ───────────────────────────────────────────────────────
function Step2({ state, setState, lang, t }) {
  const [search, setSearch] = useState('')
  const [listening, setListening] = useState(false)
  const recogRef = useRef(null)

  const toggleSymptom = (v) => {
    setState(s => ({
      ...s,
      selectedSymptoms: s.selectedSymptoms.includes(v)
        ? s.selectedSymptoms.filter(x => x !== v)
        : [...s.selectedSymptoms, v],
    }))
  }

  const filtered = search
    ? COMMON_SYMPTOMS.filter(s => t(s.labelKey).toLowerCase().includes(search.toLowerCase()))
    : COMMON_SYMPTOMS

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : lang === 'ta' ? 'ta-IN' : lang === 'te' ? 'te-IN' : 'en-IN'
    r.onresult = (e) => {
      const text = e.results[0][0].transcript.toLowerCase()
      COMMON_SYMPTOMS.forEach(s => {
        if (text.includes(s.v.replace('_', ' ')) || text.includes(t(s.labelKey).toLowerCase())) {
          setState(prev => ({
            ...prev,
            selectedSymptoms: prev.selectedSymptoms.includes(s.v) ? prev.selectedSymptoms : [...prev.selectedSymptoms, s.v],
          }))
        }
      })
      setListening(false)
    }
    r.onend = () => setListening(false)
    recogRef.current = r
    r.start()
    setListening(true)
  }

  return (
    <div className="space-y-5">
      {/* Search + voice */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('sc.searchPlaceholder')}
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-400"
        />
        <button
          onClick={startVoice}
          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
            listening ? 'border-red-400 bg-red-50 animate-pulse' : 'border-gray-200 bg-white hover:border-green-400'
          }`}
          title={t('sc.voiceInput')}
        >
          🎙️
        </button>
      </div>

      {/* Symptom chips */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {filtered.map(s => (
          <button
            key={s.v}
            onClick={() => toggleSymptom(s.v)}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
              state.selectedSymptoms.includes(s.v)
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
            }`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className="text-center leading-tight">{t(s.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Selected pill row */}
      {state.selectedSymptoms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.selectedSymptoms.map(v => {
            const s = COMMON_SYMPTOMS.find(x => x.v === v)
            return (
              <span key={v} className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {s?.icon} {t(s?.labelKey || v)}
                <button onClick={() => toggleSymptom(v)} className="ml-0.5 text-green-500 hover:text-red-500 cursor-pointer">×</button>
              </span>
            )
          })}
        </div>
      )}

      {/* Duration */}
      <div>
        <div className="text-sm font-bold text-gray-600 mb-2">{t('sc.duration')}</div>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map(d => (
            <Chip key={d.v} selected={state.duration === d.v} onClick={() => setState(s => ({ ...s, duration: d.v }))}>
              {t(d.labelKey)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div>
        <div className="text-sm font-bold text-gray-600 mb-2">{t('sc.severity')}</div>
        <div className="flex gap-3">
          {SEVERITIES.map(sv => (
            <button
              key={sv.v}
              onClick={() => setState(s => ({ ...s, severity: sv.v }))}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer ${
                state.severity === sv.v
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
              }`}
            >
              <span className="text-lg">{sv.icon}</span>
              {t(sv.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Dynamic Follow-ups ─────────────────────────────────────────────
function Step3({ questions, loading, answers, setAnswers, t }) {
  const completeness = questions.length > 0
    ? Math.round((Object.keys(answers).length / questions.length) * 100)
    : 0
  const confidence = completeness >= 80 ? 'high' : completeness >= 40 ? 'medium' : 'low'
  const confColor = { high: 'text-green-600', medium: 'text-amber-600', low: 'text-gray-400' }[confidence]
  const confLabel = {
    high: t('sc.confidenceHigh'),
    medium: t('sc.confidenceMedium'),
    low: t('sc.confidenceLow'),
  }[confidence]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
        <div className="text-sm text-gray-500 font-medium">{t('sc.aiTailoring')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 italic">{t('sc.aiGenerated')}</div>
        <div className={`text-xs font-bold ${confColor}`}>{confLabel}</div>
      </div>

      {questions.map(q => (
        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-800 mb-3">{q.question}</div>

          {q.type === 'yesno' && (
            <div className="flex gap-3">
              {['yes', 'no'].map(v => (
                <button
                  key={v}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: v }))}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    answers[q.id] === v
                      ? v === 'yes' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {v === 'yes' ? t('sc.yes') : t('sc.no')}
                </button>
              ))}
            </div>
          )}

          {q.type === 'choice' && (
            <div className="flex flex-wrap gap-2">
              {q.options?.map(opt => (
                <Chip
                  key={opt.value}
                  selected={answers[q.id] === opt.value}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: opt.value }))}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          )}

          {q.type === 'slider' && (
            <div className="space-y-1">
              <input
                type="range"
                min={q.min || 1}
                max={q.max || 10}
                value={answers[q.id] || q.min || 1}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: parseInt(e.target.value) }))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{q.min || 1}</span>
                <span className="font-bold text-green-600">{answers[q.id] || q.min || 1}</span>
                <span>{q.max || 10}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 4: Result ─────────────────────────────────────────────────────────
function Step4({ triageCard, loading, onAction, locationInput, setLocationInput, onLocationSubmit, facilities, facilityLoading, t }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
        <div className="text-sm text-gray-500 font-medium">{t('sc.analyzingSymptoms')}</div>
      </div>
    )
  }
  if (!triageCard) return null

  return (
    <div className="space-y-4">
      <TriageResultCard card={triageCard} onAction={onAction} t={t} />

      {/* Location input for MEDIUM/HIGH */}
      {(triageCard.urgency === 'HIGH' || triageCard.urgency === 'MEDIUM') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-sm font-bold text-blue-700 mb-2">{t('sc.findFacility')}</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              placeholder={t('sc.locationPlaceholder')}
              className="flex-1 border border-blue-200 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              onKeyDown={e => e.key === 'Enter' && onLocationSubmit()}
            />
            <button
              onClick={onLocationSubmit}
              className="px-4 py-1.5 rounded-full text-white text-sm font-bold cursor-pointer border-none"
              style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}
            >
              {t('sc.searchBtn')}
            </button>
          </div>
          {facilityLoading && <div className="text-xs text-blue-500 mt-2">{t('sc.findingFacilities')}</div>}
          <FacilitiesList facilities={facilities} t={t} />
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SymptomChecker() {
  const { t, lang } = useLang()

  const [step, setStep] = useState(1)
  const [animKey, setAnimKey] = useState(0)

  // Step 1 state
  const [ctx, setCtx] = useState({ patient: null, ageGroup: null, trimester: null })
  // Step 2 state
  const [sym, setSym] = useState({ selectedSymptoms: [], duration: null, severity: null })
  // Step 3 state
  const [questions, setQuestions] = useState([])
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupAnswers, setFollowupAnswers] = useState({})
  // Step 4 state
  const [triageCard, setTriageCard] = useState(null)
  const [triageLoading, setTriageLoading] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [facilities, setFacilities] = useState([])
  const [facilityLoading, setFacilityLoading] = useState(false)

  const TOTAL = 4
  const progress = (step / TOTAL) * 100

  const goNext = async () => {
    if (step === 2) {
      // Fetch follow-up questions before showing step 3
      setStep(3)
      setAnimKey(k => k + 1)
      setFollowupLoading(true)
      try {
        const data = await fetchFollowups(sym.selectedSymptoms, ctx.ageGroup, sym.duration, sym.severity, lang || 'en')
        setQuestions(data.questions || [])
      } catch {
        setQuestions([])
      } finally {
        setFollowupLoading(false)
      }
      return
    }
    if (step === 3) {
      // Submit triage
      setStep(4)
      setAnimKey(k => k + 1)
      setTriageLoading(true)
      try {
        const data = await submitSymptomCheckerTriage({
          patient: ctx.patient,
          ageGroup: ctx.ageGroup,
          trimester: ctx.trimester,
          selectedSymptoms: sym.selectedSymptoms,
          duration: sym.duration,
          severity: sym.severity,
          followupAnswers,
          language: lang || 'en',
        })
        setTriageCard(data.triageCard)
      } catch {
        setTriageCard(null)
      } finally {
        setTriageLoading(false)
      }
      return
    }
    if (step < TOTAL) {
      setStep(s => s + 1)
      setAnimKey(k => k + 1)
    }
  }

  const goBack = () => {
    if (step > 1) { setStep(s => s - 1); setAnimKey(k => k + 1) }
  }

  const reset = () => {
    setStep(1); setAnimKey(k => k + 1)
    setCtx({ patient: null, ageGroup: null, trimester: null })
    setSym({ selectedSymptoms: [], duration: null, severity: null })
    setQuestions([]); setFollowupAnswers({})
    setTriageCard(null); setFacilities([]); setLocationInput('')
  }

  const handleAction = async (actionId) => {
    if (actionId === 'CALL_108') {
      window.open('tel:108')
    } else if (actionId === 'FIND_FACILITY') {
      // scroll to location input
      document.getElementById('location-input-sc')?.focus()
    }
    // Other actions handled inline
  }

  const handleLocationSubmit = async () => {
    if (!locationInput.trim()) return
    setFacilityLoading(true)
    try {
      const data = await fetchSuggestedFacilities(triageCard?.careLevel || 'PHC', locationInput, lang || 'en')
      setFacilities(data.facilities || [])
    } catch {
      setFacilities([])
    } finally {
      setFacilityLoading(false)
    }
  }

  // Step validation
  const canNext = () => {
    if (step === 1) return !!ctx.patient && !!ctx.ageGroup
    if (step === 2) return sym.selectedSymptoms.length > 0 && !!sym.duration && !!sym.severity
    if (step === 3) return true // follow-ups optional
    return false
  }

  const STEP_TITLES = Array.isArray(t('sc.stepTitles')) ? t('sc.stepTitles') : ['Context', 'Symptoms', 'Follow-up', 'Result']
  const STEP_EMOJIS = ['👤', '🩺', '🤖', '📋']

  const stepOfLabel = (t('sc.stepOf') || 'Step {step} of {total}')
    .replace('{step}', step).replace('{total}', TOTAL)

  return (
    <div
      className="min-h-screen py-10 px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 60%, #f0fdf4 100%)' }}
    >
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2E8B57, transparent)', filter: 'blur(70px)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0077B6, transparent)', filter: 'blur(60px)' }} />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block bg-green-100 text-green-700 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest mb-3">
            {t('checker.label')}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {t('checker.title')}{' '}
            <span className="bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              {t('checker.titleSpan')}
            </span>
          </h1>
          <p className="text-gray-500 mt-1.5 text-sm">{t('checker.sub')}</p>
        </div>

        {step <= TOTAL && (
          <>
            {/* Step dots */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-300 ${
                  i + 1 === step ? 'w-8 h-2.5 bg-gradient-to-r from-green-500 to-teal-500'
                  : i + 1 < step ? 'w-2.5 h-2.5 bg-green-400'
                  : 'w-2.5 h-2.5 bg-gray-200'
                }`} />
              ))}
            </div>

            {/* Progress bar */}
            <div className="flex justify-between text-xs text-gray-400 font-semibold mb-1.5 px-1">
              <span>{stepOfLabel}</span>
              <span>{Math.round(progress)}% {t('sc.complete')}</span>
            </div>
            <div className="h-2 bg-white/70 rounded-full mb-7 overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2E8B57, #0d9488, #0077B6)' }}
              />
            </div>

            {/* Card */}
            <div key={animKey} className="glass rounded-3xl p-6 sm:p-8 shadow-xl border border-white/60 animate-scale-in">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{STEP_EMOJIS[step - 1]}</span>
                <h2 className="text-xl font-bold text-gray-800">{STEP_TITLES[step - 1]}</h2>
              </div>

              {step === 1 && <Step1 state={ctx} setState={setCtx} t={t} />}
              {step === 2 && <Step2 state={sym} setState={setSym} lang={lang || 'en'} t={t} />}
              {step === 3 && (
                <Step3
                  questions={questions}
                  loading={followupLoading}
                  answers={followupAnswers}
                  setAnswers={setFollowupAnswers}
                  t={t}
                />
              )}
              {step === 4 && (
                <Step4
                  triageCard={triageCard}
                  loading={triageLoading}
                  onAction={handleAction}
                  locationInput={locationInput}
                  setLocationInput={setLocationInput}
                  onLocationSubmit={handleLocationSubmit}
                  facilities={facilities}
                  facilityLoading={facilityLoading}
                  t={t}
                />
              )}

              {/* Nav buttons */}
              {step < 4 && (
                <div className="flex justify-between mt-8 gap-3">
                  <button
                    onClick={goBack}
                    disabled={step === 1}
                    className="px-6 py-2.5 rounded-full border-2 border-gray-200 bg-white text-gray-600 font-semibold text-sm hover:border-gray-300 disabled:opacity-25 transition-all cursor-pointer"
                  >
                    {t('sc.back')}
                  </button>
                  <button
                    onClick={goNext}
                    disabled={!canNext()}
                    className="px-8 py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-35 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer border-none"
                    style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}
                  >
                    {step === 3 ? t('sc.getGuidance') : t('sc.next')}
                  </button>
                </div>
              )}

              {step === 4 && !triageLoading && (
                <div className="flex flex-wrap gap-3 mt-6 justify-center">
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-sm no-underline hover:-translate-y-0.5 hover:shadow-xl transition-all"
                    style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}
                  >
                    {t('sc.talkToAI')}
                  </Link>
                  <button
                    onClick={reset}
                    className="px-5 py-2.5 rounded-full border-2 border-gray-300 bg-white text-gray-600 font-semibold text-sm hover:border-gray-400 transition-all cursor-pointer"
                  >
                    {t('sc.startOver')}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
