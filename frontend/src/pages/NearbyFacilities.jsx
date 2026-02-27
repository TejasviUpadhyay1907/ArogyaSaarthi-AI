import { useState, useRef } from 'react'
import { useLang } from '../i18n/LangContext'
import { fetchNearbyFacilities } from '../services/api'

const TYPE_ICONS = {
  hospital: '🏥',
  clinic: '🏨',
  doctor: '👨‍⚕️',
  pharmacy: '💊',
  health: '🩺',
  centre: '🩺',
}
const TYPE_COLORS = {
  hospital: 'bg-red-100 text-red-700',
  clinic: 'bg-blue-100 text-blue-700',
  doctor: 'bg-indigo-100 text-indigo-700',
  pharmacy: 'bg-green-100 text-green-700',
  health: 'bg-teal-100 text-teal-700',
  centre: 'bg-teal-100 text-teal-700',
}

function typeIcon(type) { return TYPE_ICONS[type] || '🏥' }
function typeColor(type) { return TYPE_COLORS[type] || 'bg-gray-100 text-gray-600' }

function FacilityCard({ facility, t }) {
  const typeLabel = t(`nearby.types.${facility.type}`) || facility.type
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl flex-shrink-0">{typeIcon(facility.type)}</span>
          <div className="min-w-0">
            <div className="font-bold text-gray-800 text-sm leading-snug truncate">{facility.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${typeColor(facility.type)}`}>
                {typeLabel}
              </span>
              {facility.emergency && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                  🚨 {t('nearby.emergency')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-extrabold text-green-600">{facility.distanceKm}</div>
          <div className="text-[11px] text-gray-400">{t('nearby.km')}</div>
        </div>
      </div>

      {/* Address */}
      {facility.address && (
        <div className="text-xs text-gray-500 flex gap-1.5">
          <span className="flex-shrink-0">📍</span>
          <span>{facility.address}</span>
        </div>
      )}

      {/* Opening hours */}
      {facility.openingHours && (
        <div className="text-xs text-gray-500 flex gap-1.5">
          <span className="flex-shrink-0">🕐</span>
          <span>{t('nearby.hours')}: {facility.openingHours}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap mt-1">
        <a
          href={facility.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors no-underline"
        >
          🗺️ {t('nearby.openMaps')}
        </a>
        {facility.phone && (
          <a
            href={`tel:${facility.phone}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors no-underline"
          >
            📞 {t('nearby.callNow')}
          </a>
        )}
      </div>
    </div>
  )
}

export default function NearbyFacilities() {
  const { t } = useLang()
  const [pincode, setPincode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)   // { pincode, area, facilities, count, message }
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleSearch = async (pin = pincode.trim()) => {
    if (!pin) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await fetchNearbyFacilities(pin)
      setResult(data)
    } catch (err) {
      setError(err.message || t('nearby.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSearch() }

  const tryPin = (pin) => { setPincode(pin); handleSearch(pin) }

  return (
    <div
      className="min-h-screen py-10 px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 60%, #f0fdf4 100%)' }}
    >
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2E8B57, transparent)', filter: 'blur(70px)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0077B6, transparent)', filter: 'blur(60px)' }} />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest mb-3">
            {t('nearby.badge')}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {t('nearby.title')}{' '}
            <span className="bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              {t('nearby.titleSpan')}
            </span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">{t('nearby.sub')}</p>
        </div>

        {/* Search box */}
        <div className="glass rounded-3xl p-5 shadow-xl border border-white/60 mb-6">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={handleKey}
              placeholder={t('nearby.inputPlaceholder')}
              className="flex-1 bg-white/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
              aria-label={t('nearby.inputPlaceholder')}
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || pincode.length < 6}
              className="px-6 py-3 rounded-2xl text-white font-bold text-sm disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer border-none flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #2E8B57, #0077B6)' }}
            >
              {loading ? '⏳' : '🔍'} {loading ? t('nearby.searching') : t('nearby.searchBtn')}
            </button>
          </div>

          {/* Quick-try pincodes */}
          {!result && !loading && (
            <div className="mt-3 text-xs text-gray-400 text-center">
              <span className="mr-1">{t('nearby.tryPincodes').split('·')[0].replace('Try:', '').trim() ? t('nearby.tryPincodes').split(':')[0] + ':' : ''}</span>
              {[['110001', 'Delhi'], ['400001', 'Mumbai'], ['600001', 'Chennai'], ['500001', 'Hyderabad'], ['411001', 'Pune']].map(([pin, city]) => (
                <button
                  key={pin}
                  onClick={() => tryPin(pin)}
                  className="mx-1 underline text-blue-500 hover:text-blue-700 cursor-pointer bg-transparent border-none text-xs"
                >
                  {pin} ({city})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="w-12 h-8 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm font-semibold text-red-700">{error}</div>
            <a href="tel:104" className="mt-3 inline-block text-xs font-bold text-white bg-red-500 px-4 py-2 rounded-full hover:bg-red-600 transition-colors no-underline">
              📞 Call 104 Helpline
            </a>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div>
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="text-sm font-semibold text-gray-700">
                📍 {t('nearby.resultsFor')} <span className="text-green-700 font-bold">{result.pincode}</span>
                {result.area && <span className="text-gray-500 font-normal"> — {result.area}</span>}
              </div>
              {result.count > 0 && (
                <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">
                  {result.count} {t('nearby.facilitiesFound')}
                </span>
              )}
            </div>

            {/* No results */}
            {result.count === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">🗺️</div>
                <div className="text-sm font-semibold text-amber-800">{result.message || t('nearby.noResults')}</div>
                <a href="tel:104" className="mt-4 inline-block text-xs font-bold text-white bg-amber-500 px-4 py-2 rounded-full hover:bg-amber-600 transition-colors no-underline">
                  📞 Call 104 Helpline
                </a>
              </div>
            )}

            {/* Facility cards */}
            {result.facilities?.length > 0 && (
              <div className="space-y-4">
                {result.facilities.map(f => (
                  <FacilityCard key={f.id} facility={f} t={t} />
                ))}
                <p className="text-center text-xs text-gray-400 pt-2">
                  Data from OpenStreetMap contributors · Distances are approximate
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
