import { NavLink, Link } from 'react-router-dom'
import { useLang } from '../i18n/LangContext'
import { useAuth } from '../context/AuthContext'

const LANG_OPTIONS = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'hi', flag: '🇮🇳', label: 'हिंदी' },
  { code: 'mr', flag: '🇮🇳', label: 'मराठी' },
  { code: 'ta', flag: '🇮🇳', label: 'தமிழ்' },
  { code: 'te', flag: '🇮🇳', label: 'తెలుగు' },
]

export default function MobileMenu({ navLinks, onClose }) {
  const { lang, setLang, t } = useLang()
  const { user, profile, logout } = useAuth()

  const displayName = profile?.name || user?.displayName || 'User'
  const initials    = displayName.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div
      className="lg:hidden bg-white border-t border-gray-100 shadow-xl animate-slide-in-up"
      role="dialog"
      aria-label="Navigation menu"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">

        {/* Nav links */}
        {navLinks.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline transition-colors ${
                isActive
                  ? 'text-green-700 bg-green-50 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-green-700'
              }`
            }
          >
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-gray-100" />

        {/* Talk to AI — primary CTA */}
        <Link
          to="/chat"
          onClick={onClose}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-green-600 to-blue-600 no-underline shadow-sm"
        >
          🎙️ {t('nav.talkToAI')}
        </Link>

        {/* Auth section */}
        {user ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-50 min-w-0">
              <span className="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-700 truncate">{displayName}</p>
                <p className="text-xs text-green-500">{profile?.role || 'Patient'}</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); onClose() }}
              className="flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border-none cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            onClick={onClose}
            className="flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold text-green-700 border-2 border-green-500 hover:bg-green-50 no-underline transition-colors"
          >
            Login / Sign Up
          </Link>
        )}

        {/* Language selector */}
        <div className="mt-1 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-1 mb-2">Language</p>
          <div className="flex flex-wrap gap-2">
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onClick={() => setLang(opt.code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all cursor-pointer ${
                  lang === opt.code
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                }`}
              >
                {opt.flag} {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
