import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

const DOCTOR_EMOJIS = ['👨‍⚕️', '👩‍⚕️', '👨‍⚕️', '👩‍⚕️']
const DOCTOR_SLOTS = [
  ['9:00 AM', '10:30 AM', '2:00 PM', '4:00 PM'],
  ['9:30 AM', '11:00 AM', '3:00 PM', '5:00 PM'],
  ['10:00 AM', '12:00 PM', '2:30 PM', '4:30 PM'],
  ['9:00 AM', '11:30 AM', '1:00 PM', '3:30 PM'],
]

export default function Appointment() {
  const { t } = useLang()
  const [selected, setSelected] = useState(null)
  const [slot, setSlot]         = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  // Doctors come from i18n — fully translated names + specializations
  const doctors = t('appointment.doctors')

  const confirm = () => { if (selected !== null && slot) setConfirmed(true) }
  const reset   = () => { setSelected(null); setSlot(null); setConfirmed(false) }

  const yearsExpLabel = (years) =>
    t('appointment.yearsExp').replace('{years}', years)

  if (confirmed) {
    const doc = Array.isArray(doctors) ? doctors[selected] : null
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 max-w-md w-full text-center animate-fade-in-up">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">{t('appointment.confirmedTitle')}</h2>
          <p className="text-gray-500 mb-6">{t('appointment.confirmedSub')}</p>
          {doc && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3 min-w-0">
                <span className="text-3xl flex-shrink-0">{DOCTOR_EMOJIS[selected]}</span>
                <div className="min-w-0">
                  <div className="font-bold text-gray-800 truncate">{doc.name}</div>
                  <div className="text-sm text-blue-600 font-semibold truncate">{doc.spec}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600"><span className="font-semibold">{t('appointment.timeSlot')}:</span> {slot}</div>
              <div className="text-sm text-gray-600 mt-1"><span className="font-semibold">{t('appointment.date')}:</span> {t('appointment.tomorrow')}</div>
            </div>
          )}
          <p className="text-xs text-gray-400 mb-6">{t('appointment.ashaNote')}</p>
          <button onClick={reset} className="px-8 py-3 rounded-full bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold cursor-pointer border-none hover:-translate-y-0.5 hover:shadow-lg transition-all">
            {t('appointment.bookAnother')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide mb-2">{t('appointment.label')}</span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {t('appointment.title')} <span className="text-green-600">{t('appointment.titleSpan')}</span>
          </h1>
          <p className="text-gray-500 mt-1">{t('appointment.sub')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          {Array.isArray(doctors) && doctors.map((doc, idx) => (
            <div key={idx} onClick={() => { setSelected(idx); setSlot(null) }}
              className={`bg-white rounded-3xl p-6 border-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${
                selected === idx ? 'border-green-500 shadow-lg shadow-green-100' : 'border-gray-100 shadow-sm'
              }`}>
              <div className="flex items-center gap-3 mb-5 min-w-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-3xl flex-shrink-0">
                  {DOCTOR_EMOJIS[idx]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-800 truncate">{doc.name}</div>
                  <div className="text-sm text-blue-600 font-semibold truncate">{doc.spec}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ⭐ {doc.rating} · {yearsExpLabel(doc.years)}
                  </div>
                </div>
                {selected === idx && <span className="ml-auto text-green-500 text-xl flex-shrink-0">✓</span>}
              </div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{t('appointment.availableSlots')}</div>
              <div className="flex flex-wrap gap-2">
                {DOCTOR_SLOTS[idx].map(s => (
                  <button key={s} onClick={e => { e.stopPropagation(); setSelected(idx); setSlot(s) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all cursor-pointer ${
                      slot === s && selected === idx
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:bg-green-50'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected !== null && slot && Array.isArray(doctors) && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-md max-w-md mx-auto text-center animate-fade-in-up">
            <h3 className="font-bold text-gray-800 mb-1">{t('appointment.confirmTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{doctors[selected]?.name}</strong> {t('appointment.confirmAt')} <strong>{slot}</strong>
            </p>
            <button onClick={confirm}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold text-base cursor-pointer border-none hover:-translate-y-0.5 hover:shadow-lg transition-all">
              {t('appointment.confirmBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
