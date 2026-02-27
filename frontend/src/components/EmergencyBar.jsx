import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

export default function EmergencyBar() {
  const { t } = useLang()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop / tablet: single compact row */}
        <div className="hidden sm:flex items-center justify-between h-9 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold whitespace-nowrap opacity-90">
              🚨 {t('emergency.question')}
            </span>
            <a
              href="tel:108"
              className="flex-shrink-0 bg-white/20 hover:bg-white/35 text-white text-xs font-bold px-3 py-0.5 rounded-full transition-colors no-underline"
            >
              📞 108
            </a>
            <a
              href="tel:104"
              className="flex-shrink-0 bg-white/20 hover:bg-white/35 text-white text-xs font-bold px-3 py-0.5 rounded-full transition-colors no-underline"
            >
              📞 104
            </a>
            <span className="text-xs opacity-70 truncate hidden md:block">
              {t('emergency.warning')}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-white/60 hover:text-white text-base leading-none bg-transparent border-none cursor-pointer p-0 transition-colors"
            aria-label="Dismiss emergency bar"
          >
            ✕
          </button>
        </div>

        {/* Mobile: two-line compact */}
        <div className="sm:hidden py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold whitespace-nowrap">🚨 Emergency:</span>
              <a href="tel:108" className="bg-white/20 hover:bg-white/35 text-white text-xs font-bold px-2.5 py-0.5 rounded-full no-underline">108</a>
              <a href="tel:104" className="bg-white/20 hover:bg-white/35 text-white text-xs font-bold px-2.5 py-0.5 rounded-full no-underline">104</a>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer p-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-xs opacity-60 mt-0.5 leading-tight">{t('emergency.warning')}</p>
        </div>
      </div>
    </div>
  )
}
