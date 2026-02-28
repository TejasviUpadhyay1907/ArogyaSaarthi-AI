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

export default function MobileMenu({ navLinks, onClose, onProtectedClick }) {
  const { lang, setLang, t } = useLang()
  const { user, profile, logout } = useAuth()

  const displayName = profile?.name || user?.displayName || t('nav.user')
  const initials    = displayName.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div
      className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/70 shadow-lg"
      role="dialog"
      aria-label={t('nav.navigationMenu')}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">

        {/* Talk to AI CTA — top of menu */}
        {user ? (
          <Link
            to="/chat"
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white no-underline mb-1"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #0284c7 100%)', boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
          >
            <span aria-hidden="true">🎙️</span>
            {t('nav.talkToAI')}
          </Link>
        ) : (
          <Link
            to="/auth"
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white no-underline mb-1"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #0284c7 100%)', boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
          >
            <span aria-hidden="true">🔒</span>
            {t('nav.loginToUseAI')}
          </Link>
        )}

        {/* Nav links */}
        {navLinks.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={(e) => {
              onProtectedClick?.(e, l.to)
              if (user || !l.protected) onClose()
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13.5px] font-medium no-underline transition-colors ${
                isActive
                  ? 'text-green-700 bg-green-50 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <span className="flex-1">{l.label}</span>
            {l.protected && !user && (
              <span className="text-[10px] text-slate-400 font-semibold">🔒</span>
            )}
          </NavLink>
        ))}

        <div className="my-1.5 border-t border-slate-100" />

        {/* User section */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
              <span
                className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #16a34a, #0284c7)' }}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400">{profile?.role || t('nav.patient')}</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); onClose() }}
              className="flex-shrink-0 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors"
            >
              {t('nav.signOut')}
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            onClick={onClose}
            className="flex items-center justify-center px-4 py-2.5 rounded-xl text-[13.5px] font-semibold text-green-700 border border-green-300 hover:bg-green-50 no-underline transition-colors"
          >
            {t('nav.loginSignUp')}
          </Link>
        )}

        {/* Language selector */}
        <div className="mt-1 pt-2.5 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest px-1 mb-2">{t('nav.language')}</p>
          <div className="flex flex-wrap gap-1.5">
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onMouseDown={(e) => { 
                  e.preventDefault();
                  console.log('[MobileMenu] Lang clicked:', opt.code); 
                  setLang(opt.code);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
                  lang === opt.code
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden="true">{opt.flag}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
