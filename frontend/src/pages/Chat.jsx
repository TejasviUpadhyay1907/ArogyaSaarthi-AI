import { useState, useRef, useEffect } from 'react'
import { sendChat, executeAction, AuthError, NetworkError } from '../services/api'
import Logo from '../components/Logo'
import { useLang } from '../i18n/LangContext'

const URGENCY_COLORS = {
  HIGH:   { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-600',    badge: 'bg-red-500',    icon: '🚨' },
  MEDIUM: { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-600',  badge: 'bg-amber-500',  icon: '⚠️' },
  LOW:    { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-600', badge: 'bg-emerald-500', icon: '✅' },
}

function fmt(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

export default function Chat() {
  const { lang, t } = useLang()

  const [messages, setMessages] = useState(() => [
    { id: 1, role: 'ai', text: t('chat.welcome1') },
    { id: 2, role: 'ai', text: t('chat.welcome2') },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [recording, setRecording] = useState(false)
  const [aiBusy, setAiBusy]       = useState(false)
  const sessionIdRef   = useRef(null)
  const bottomRef      = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    setMessages([
      { id: 1, role: 'ai', text: t('chat.welcome1') },
      { id: 2, role: 'ai', text: t('chat.welcome2') },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const addMsg = (role, text, result = null) =>
    setMessages(m => [...m, { id: Date.now() + Math.random(), role, text, result }])

  const sendMessage = async (text = input.trim()) => {
    if (!text || loading) return
    setInput('')
    addMsg('user', text)
    setLoading(true)
    try {
      const data = await sendChat(text, lang, sessionIdRef.current)
      if (data.sessionId) sessionIdRef.current = data.sessionId

      // Show "AI busy" banner if Gemini fallback was used
      if (data.meta?.fallbackUsed) setAiBusy(true)
      else setAiBusy(false)

      const bubbleText = data.reply || data.explanation || t('chat.analysisComplete')
      const isTriage   = data.intent === 'SYMPTOMS'
      const isFacility = data.intent === 'REFINE_LOCATION' || data.intent === 'FACILITY_SEARCH' || data.intent === 'LOCATION_PROVIDED'
      const resultData = isTriage ? data : (isFacility && data.facilities?.length ? data : null)
      addMsg('ai', bubbleText, resultData)
    } catch (err) {
      if (err instanceof AuthError) {
        addMsg('ai', t('chat.authError') || 'Please log in to use the AI assistant. Your session may have expired.')
      } else if (err instanceof NetworkError) {
        addMsg('ai', t('chat.networkError') || 'Network issue — please check your connection and try again.')
      } else {
        addMsg('ai', t('chat.errorMsg'))
      }
      console.warn('[Chat] sendMessage error:', err.name, err.message)
    }
    setLoading(false)
  }

  // Called when a card action button is clicked
  const handleAction = async (actionId, payload = {}) => {
    if (loading) return
    setLoading(true)
    try {
      const data = await executeAction(actionId, payload, sessionIdRef.current, lang)
      const bubbleText = data.reply || t('chat.done')
      addMsg('ai', bubbleText, data)
    } catch (e) {
      addMsg('ai', e.message || t('chat.errorMsg'))
    }
    setLoading(false)
  }

  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert(t('chat.voiceNotSupported')); return }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    const rec = new SR()
    const langMap = { hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', en: 'en-IN' }
    rec.lang = langMap[lang] || 'en-IN'
    rec.interimResults = false
    rec.onresult = e => { setInput(e.results[0][0].transcript); setRecording(false) }
    rec.onerror  = () => setRecording(false)
    rec.onend    = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 50%, #f0fdf4 100%)', height: 'calc(100dvh - 112px)', minHeight: '400px' }}
    >
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2E8B57, transparent)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-20 right-0 w-64 h-64 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0077B6, transparent)', filter: 'blur(60px)' }} />

      <div className="relative z-10 flex items-center justify-end px-4 py-2 max-w-3xl w-full mx-auto">
        <span className="text-xs text-gray-400 font-medium">🔒 {t('chat.anonymous')}</span>
      </div>

      {aiBusy && (
        <div className="relative z-10 max-w-3xl w-full mx-auto px-4 pb-1">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            <span>⚡</span>
            <span>{t('chat.aiBusy') || 'AI is busy – showing basic guidance.'}</span>
            <button onClick={() => setAiBusy(false)} className="ml-auto text-amber-400 hover:text-amber-600 text-base leading-none" aria-label="Dismiss">×</button>
          </div>
        </div>
      )}

      <div
        className="relative z-10 flex-1 overflow-y-auto px-4 py-4 max-w-3xl w-full mx-auto flex flex-col gap-4"
        role="log" aria-live="polite"
      >
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex gap-3 items-end max-w-[92%] sm:max-w-[88%] animate-slide-in-up ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {msg.role === 'ai' && (
              <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}>
                <Logo size={22} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div
                className={`px-4 py-3 sm:px-5 sm:py-3.5 text-sm leading-relaxed shadow-sm transition-all break-words min-w-0 ${
                  msg.role === 'ai'
                    ? 'glass rounded-3xl rounded-tl-md text-gray-800'
                    : 'rounded-3xl rounded-tr-md text-white'
                }`}
                style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #2E8B57, #0d9488)' } : {}}
                dangerouslySetInnerHTML={{ __html: fmt(msg.text) }}
              />
              {msg.result && (
                <ResultCard result={msg.result} onAction={handleAction} />
              )}
              <div className={`text-[11px] text-gray-400 px-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.role === 'ai' ? 'ArogyaSaarthi AI' : t('chat.you')}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-end self-start animate-fade-in">
            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-md animate-avatar-pulse"
              style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}>
              <Logo size={22} />
            </div>
            <div className="glass rounded-3xl rounded-tl-md px-5 py-4 shadow-sm flex gap-1.5 items-center">
              {[0,1,2].map(i => (
                <span key={i} className="typing-dot w-2.5 h-2.5 bg-green-400 rounded-full block" />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="relative z-10 px-4 pb-3 pt-2 max-w-3xl w-full mx-auto">
        {recording && (
          <div className="flex items-center justify-center gap-1 mb-3 animate-fade-in">
            <span className="text-red-500 text-xs font-bold mr-2">🔴 {t('chat.listening')}</span>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="wave-bar w-1 bg-red-400 rounded-full" style={{ height: `${8 + i * 3}px` }} />
            ))}
          </div>
        )}
        <div className="glass rounded-3xl shadow-lg px-3 py-3 flex gap-3 items-center border border-white/60">
          <button
            onClick={toggleRecording}
            aria-label={recording ? t('chat.micStop') : t('chat.micStart')}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl text-white border-none cursor-pointer flex-shrink-0 transition-all duration-200 ${
              recording ? 'bg-red-500 animate-pulse-ring scale-110' : 'hover:scale-110 shadow-lg'
            }`}
            style={!recording ? { background: 'linear-gradient(135deg, #2E8B57, #0077B6)', boxShadow: '0 4px 20px rgba(46,139,87,0.35)' } : {}}
          >
            🎙️
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={t('chat.placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-700 placeholder-gray-400"
            aria-label={t('chat.placeholder')}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white border-none cursor-pointer flex-shrink-0 transition-all duration-200 disabled:opacity-35 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #0077B6, #0d9488)' }}
            aria-label={t('chat.sendAriaLabel')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ResultCard: renders the right card based on intent ────────────────────
function ResultCard({ result, onAction }) {
  const { t } = useLang()
  if (!result) return null

  const intent = result.intent || result.actionId

  // Emergency
  if (intent === 'EMERGENCY') {
    return (
      <div className="mt-1 bg-red-50 border border-red-300 rounded-2xl p-4 animate-scale-in shadow-sm">
        <div className="text-sm font-bold text-red-600">{result.reply}</div>
        <a href="tel:108" className="mt-2 inline-flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-red-600 transition-all">
          {t('card.callEmergency')}
        </a>
      </div>
    )
  }

  // Home tips
  if (intent === 'HOME_TIPS') {
    const tips = result.homeTips || []
    return (
      <div className="mt-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-scale-in shadow-sm space-y-2">
        <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{t('card.homeTipsTitle')}</div>
        <ul className="space-y-1.5">
          {tips.map((tip, i) => (
            <li key={i} className="text-xs text-gray-700 flex gap-2">{tip}</li>
          ))}
        </ul>
      </div>
    )
  }

  // Booking confirmation
  if (intent === 'BOOK_APPOINTMENT' && result.booking) {
    const b = result.booking
    return (
      <div className="mt-1 bg-emerald-50 border border-emerald-300 rounded-2xl p-4 animate-scale-in shadow-sm space-y-1">
        <div className="text-xs font-bold text-emerald-700">{t('card.appointmentConfirmed')}</div>
        <div className="text-xs text-gray-700">{t('card.doctor')}: <span className="font-semibold">{b.doctor?.name}</span></div>
        <div className="text-xs text-gray-700">{t('card.specialization')}: {b.doctor?.specialization}</div>
        <div className="text-xs text-gray-700">{t('card.date')}: <span className="font-semibold">{b.slot?.date}</span> at <span className="font-semibold">{b.slot?.time}</span></div>
        <div className="text-xs text-gray-500">{t('card.bookingId')}: #{b.appointmentId}</div>
      </div>
    )
  }

  // Doctors list
  if ((intent === 'SHOW_DOCTORS' || intent === 'BOOK_APPOINTMENT') && result.doctors?.length > 0) {
    return <DoctorsList doctors={result.doctors} onAction={onAction} />
  }

  // Slots list
  if (intent === 'SHOW_SLOTS' && result.slots?.length > 0) {
    return <SlotsList slots={result.slots} doctorId={result.doctorId} onAction={onAction} />
  }

  // Facility-only result
  if ((intent === 'REFINE_LOCATION' || intent === 'FACILITY_SEARCH' || intent === 'LOCATION_PROVIDED') && result.facilities?.length) {
    return <FacilitiesList facilities={result.facilities} onAction={onAction} />
  }

  // Triage result (SYMPTOMS)
  if (intent === 'SYMPTOMS') {
    return <TriageCard result={result} onAction={onAction} />
  }

  return null
}

// ── TriageCard ─────────────────────────────────────────────────────────────
function TriageCard({ result, onAction }) {
  const { t } = useLang()
  const [whyOpen, setWhyOpen] = useState(true)
  const card = result.triageCard
  if (!card || !URGENCY_COLORS[card.urgency]) return null

  const s = URGENCY_COLORS[card.urgency]
  const facilities = result.facilities || []

  return (
    <div className={`mt-1 ${s.bg} border ${s.border} rounded-2xl p-4 animate-scale-in shadow-sm space-y-3`}>

      {/* Urgency badge + time */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 ${s.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
          {s.icon} {card.urgencyLabel || t(`urgency.${card.urgency}`) || card.urgency}
        </span>
        <span className="text-xs text-gray-500 font-medium">{card.timeToAct}</span>
      </div>

      {/* Headline + care level */}
      <div>
        <div className={`font-bold text-sm ${s.text}`}>{card.headline}</div>
        {card.careLevel && (
          <span className="inline-block mt-1 text-[11px] bg-white/70 border border-gray-200 rounded-full px-2 py-0.5 text-gray-600 font-medium">
            {t(`careLevel.${card.careLevel}`) || card.careLevel}
          </span>
        )}
      </div>

      {/* Why + Watch For */}
      {(card.why?.length > 0 || card.watchFor?.length > 0) && (
        <div className="bg-white/60 rounded-xl p-3 space-y-2">
          <button
            onClick={() => setWhyOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 cursor-pointer bg-transparent border-none p-0"
          >
            <span>{whyOpen ? '▾' : '▸'}</span> {t('card.whyTitle')}
          </button>
          {whyOpen && (
            <div className="space-y-2 text-xs text-gray-700">
              {card.why?.length > 0 && (
                <ul className="space-y-1">
                  {card.why.map((w, i) => <li key={i} className="flex gap-1.5"><span className={s.text}>•</span>{w}</li>)}
                </ul>
              )}
              {card.watchFor?.length > 0 && (
                <div>
                  <div className="font-semibold text-orange-600 mb-1">⚠️ {t('card.watchFor')}</div>
                  <ul className="space-y-1">
                    {card.watchFor.map((w, i) => <li key={i} className="flex gap-1.5"><span className="text-orange-500">•</span>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — all wired to real handlers */}
      {card.actions?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {card.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => onAction(a.actionId, { careLevel: card.careLevel })}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border-none cursor-pointer transition-all hover:scale-105 ${
                a.priority === 'PRIMARY'
                  ? `${s.badge} text-white shadow-sm hover:opacity-90`
                  : 'bg-white/80 text-gray-700 border border-gray-200 hover:bg-white'
              }`}
            >
              {t(`action.${a.actionId}`) || a.label}
            </button>
          ))}
        </div>
      )}

      {/* Location ask prompt */}
      {result.nextStep === 'ASK_LOCATION' && facilities.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700 flex items-center gap-2">
          <span className="text-base">📍</span>
          <span>{result.nextQuestion || t('action.ASK_LOCATION')}</span>
        </div>
      )}

      {/* Facilities (when location already known) */}
      {facilities.length > 0 && (
        <FacilitiesList facilities={facilities} onAction={onAction} compact />
      )}
    </div>
  )
}

// ── FacilitiesList ─────────────────────────────────────────────────────────
function FacilitiesList({ facilities, onAction, compact = false }) {
  const { t } = useLang()
  return (
    <div className={`${compact ? '' : 'mt-1'} bg-blue-50 border border-blue-200 rounded-2xl p-4 animate-scale-in shadow-sm space-y-2`}>
      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{t('card.nearbyFacilities')}</div>
      {facilities.map(f => (
        <div key={f.id} className="bg-white/80 rounded-xl px-3 py-2 text-xs text-gray-700 flex justify-between items-start gap-2">
          <div>
            <span className="font-semibold">{f.name}</span>
            <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 font-medium">{t(`careLevel.${f.type}`) || f.type}</span>
            {f.address && <div className="text-gray-500 mt-0.5">{f.address}</div>}
            {f.phone && <div className="text-gray-400">📞 {f.phone}</div>}
          </div>
          <div className="text-right flex-shrink-0">
            {f.distanceKm && <div className="font-bold text-blue-600">{f.distanceKm} {t('card.km')}</div>}
            <div className="text-gray-400">{f.hours}</div>
          </div>
        </div>
      ))}
      <button
        onClick={() => onAction('SHOW_DOCTORS', {})}
        className="w-full text-xs font-bold text-blue-600 bg-white/70 border border-blue-200 rounded-xl py-2 hover:bg-white transition-all"
      >
        {t('card.viewDoctorsBook')}
      </button>
    </div>
  )
}

// ── DoctorsList ────────────────────────────────────────────────────────────
function DoctorsList({ doctors, onAction }) {
  const { t } = useLang()
  return (
    <div className="mt-1 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 animate-scale-in shadow-sm space-y-2">
      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{t('card.availableDoctors')}</div>
      {doctors.map(d => (
        <div key={d.id} className="bg-white/80 rounded-xl px-3 py-2 text-xs text-gray-700 flex justify-between items-center gap-2">
          <div>
            <div className="font-semibold">{d.name}</div>
            <div className="text-gray-500">{d.specialization}</div>
            <div className="text-gray-400">⭐ {d.rating} · {d.experienceYears} {t('card.yrsExp')}</div>
          </div>
          <button
            onClick={() => onAction('SHOW_SLOTS', { doctorId: d.id })}
            className="text-[11px] font-bold bg-indigo-500 text-white px-3 py-1.5 rounded-full hover:bg-indigo-600 transition-all flex-shrink-0"
          >
            {t('card.viewSlots')}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── SlotsList ──────────────────────────────────────────────────────────────
function SlotsList({ slots, doctorId, onAction }) {
  const { t } = useLang()
  // Group by date
  const byDate = slots.reduce((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  return (
    <div className="mt-1 bg-teal-50 border border-teal-200 rounded-2xl p-4 animate-scale-in shadow-sm space-y-3">
      <div className="text-xs font-semibold text-teal-600 uppercase tracking-wide">{t('card.availableSlots')}</div>
      {Object.entries(byDate).map(([date, daySlots]) => (
        <div key={date}>
          <div className="text-xs font-semibold text-gray-600 mb-1.5">{date}</div>
          <div className="flex flex-wrap gap-1.5">
            {daySlots.map(s => (
              <button
                key={s.id}
                onClick={() => onAction('BOOK_APPOINTMENT', { doctorId: doctorId || s.doctor_id, slotId: s.id })}
                className="text-[11px] font-bold bg-teal-500 text-white px-3 py-1.5 rounded-full hover:bg-teal-600 transition-all"
              >
                {s.slot_time}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
