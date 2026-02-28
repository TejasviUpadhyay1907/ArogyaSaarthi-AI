import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import MobileMenu from './MobileMenu'
import { useLang } from '../i18n/LangContext'
import { useAuth } from '../context/AuthContext'

const LANG_OPTIONS = [
  { code: 'en', flag: '🇬🇧', label: 'EN', full: 'English' },
  { code: 'hi', flag: '🇮🇳', label: 'HI', full: 'हिंदी' },
  { code: 'mr', flag: '🇮🇳', label: 'MR', full: 'मराठी' },
  { code: 'ta', flag: '🇮🇳', label: 'TA', full: 'தமிழ்' },
  { code: 'te', flag: '🇮🇳', label: 'TE', full: 'తెలుగు' },
]

const PROTECTED = ['/chat', '/symptoms', '/appointment', '/nearby', '/dashboard']

// Shared control height — all right-side pills use this
const CTRL = 'h-9 flex items-center rounded-full transition-all duration-200 whitespace-nowrap'

const Chevron = ({ open }) => (
  <svg
    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    viewBox="0 0 24 24" fill="none" aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function useOutsideClick(ref, cb) {
  useEffect(() => {
    const fn = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) {
        cb()
      }
    }
    // Use mousedown but with a small delay to let onClick fire first
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, cb])
}

export default function Navbar() {
  const { lang, setLang, t } = useLang()
  const { user, profile, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen,   setLangOpen]   = useState(false)
  const [userOpen,   setUserOpen]   = useState(false)
  const [toast,      setToast]      = useState(false)

  const langRef = useRef(null)
  const userRef = useRef(null)

  const closeLang = useCallback(() => setLangOpen(false), [])
  const closeUser = useCallback(() => setUserOpen(false), [])

  useOutsideClick(langRef, closeLang)
  useOutsideClick(userRef, closeUser)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(false), 3000)
    return () => clearTimeout(id)
  }, [toast])

  const displayName = profile?.name || user?.displayName || t('nav.user')
  const initials    = displayName.trim()[0]?.toUpperCase() ?? '?'
  const currentLang = LANG_OPTIONS.find(l => l.code === lang) ?? LANG_OPTIONS[0]

  const handleProtectedClick = (e, to) => {
    if (!user && PROTECTED.includes(to)) {
      e.preventDefault()
      setToast(true)
      setTimeout(() => navigate(`/auth?from=${encodeURIComponent(to)}`), 1200)
    }
  }

  const navLinks = [
    { to: '/',            label: t('nav.home'),       end: true,  protected: false },
    { to: '/chat',        label: t('nav.chat'),        end: false, protected: true  },
    { to: '/symptoms',    label: t('nav.symptoms'),    end: false, protected: true  },
    { to: '/appointment', label: t('nav.appointment'), end: false, protected: true  },
  ]

  return (
    <>
      {/* Login toast */}
      {toast && (
        <div
          role="alert"
          className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[100] bg-gray-900/95 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 backdrop-blur-sm"
        >
          <span className="text-base">🔒</span>
          {t('nav.loginToContinue')}
        </div>
      )}

      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16"
          style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0' }}
        >

          {/* ── COL 1: Brand ── */}
          <Link
            to="/"
            className="flex items-center gap-3 no-underline group flex-shrink-0"
            aria-label="ArogyaSaarthi AI home"
          >
            <Logo size={32} />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[13px] font-semibold text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors">
                ArogyaSaarthi
                <span
                  className="ml-1 font-bold"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #0284c7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  AI
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">{t('nav.tagline')}</span>
            </div>
          </Link>

          {/* ── COL 2: Center nav ── */}
          <nav aria-label="Main navigation" className="hidden md:flex justify-self-center">
            <ul className="flex items-center gap-0.5 list-none m-0 p-0">
              {navLinks.map(l => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.end}
                    onClick={(e) => handleProtectedClick(e, l.to)}
                    className={({ isActive }) =>
                      `px-3.5 py-2 rounded-full text-[13px] font-medium transition-all duration-150 no-underline whitespace-nowrap select-none ${
                        isActive
                          ? 'text-green-700 bg-green-50 font-semibold shadow-[inset_0_0_0_1px_rgba(22,163,74,0.15)]'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── COL 3: Right controls ── */}
          <div className="justify-self-end flex items-center gap-1.5">

            {/* Talk to AI — desktop, logged-in only */}
            {user && (
              <Link
                to="/chat"
                className={`hidden lg:flex gap-1.5 px-4 text-[12.5px] font-semibold text-white no-underline ${CTRL}`}
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #0284c7 100%)', boxShadow: '0 1px 4px rgba(22,163,74,0.25)' }}
              >
                <span aria-hidden="true" className="text-sm">🎙️</span>
                {t('nav.talkToAI')}
              </Link>
            )}

            {/* Language pill — desktop */}
            <div className="relative hidden md:block" ref={langRef}>
              <button
                onClick={() => { setLangOpen(o => !o); setUserOpen(false) }}
                className={`gap-1.5 px-3 text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer ${CTRL}`}
                aria-label={`Language: ${currentLang.full}`}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
              >
                <span aria-hidden="true">{currentLang.flag}</span>
                <span>{currentLang.label}</span>
                <Chevron open={langOpen} />
              </button>

              {langOpen && (
                <ul
                  role="listbox"
                  aria-label={t('nav.selectLanguage')}
                  className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 w-38 z-50 list-none p-0 m-0 overflow-hidden"
                  style={{ minWidth: '148px' }}
                >
                  {LANG_OPTIONS.map(opt => (
                    <li key={opt.code} role="option" aria-selected={lang === opt.code}>
                      <button
                        onMouseDown={(e) => { 
                          e.preventDefault(); // Prevent focus change
                          console.log('[Navbar] Desktop lang clicked:', opt.code); 
                          setLang(opt.code); 
                          setLangOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-none text-left ${
                          lang === opt.code
                            ? 'bg-green-50 text-green-700'
                            : 'bg-transparent text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span aria-hidden="true">{opt.flag}</span>
                        <span>{opt.full}</span>
                        {lang === opt.code && (
                          <span className="ml-auto text-green-500 text-xs" aria-hidden="true">✓</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* User menu or Login — desktop */}
            {user ? (
              <div className="relative hidden md:block" ref={userRef}>
                <button
                  onClick={() => { setUserOpen(o => !o); setLangOpen(false) }}
                  className={`gap-2 pl-1.5 pr-3 text-[12px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer min-w-0 ${CTRL}`}
                  style={{ maxWidth: '160px' }}
                  aria-label={t('nav.userMenu')}
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #0284c7)' }}
                  >
                    {initials}
                  </span>
                  <span className="truncate max-w-[68px]">{displayName}</span>
                  <Chevron open={userOpen} />
                </button>

                {userOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 overflow-hidden"
                    style={{ minWidth: '176px' }}
                  >
                    <div className="px-4 py-3 border-b border-slate-50">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{profile?.role || t('nav.patient')}</p>
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => { logout(); setUserOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer text-left transition-colors"
                    >
                      <span aria-hidden="true">🚪</span>
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className={`hidden md:flex px-4 text-[12.5px] font-semibold text-green-700 border border-green-300 hover:bg-green-50 hover:border-green-400 no-underline ${CTRL}`}
              >
                {t('nav.login')}
              </Link>
            )}

            {/* ── Mobile right: lang flag + avatar + hamburger ── */}
            <div className="flex md:hidden items-center gap-1">

              {/* Language flag only on mobile */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setLangOpen(o => !o)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm cursor-pointer transition-colors"
                  aria-label={`Language: ${currentLang.full}`}
                  aria-expanded={langOpen}
                >
                  {currentLang.flag}
                </button>
                {langOpen && (
                  <ul
                    role="listbox"
                    className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 list-none p-0 m-0 overflow-hidden"
                    style={{ minWidth: '148px' }}
                  >
                    {LANG_OPTIONS.map(opt => (
                      <li key={opt.code} role="option" aria-selected={lang === opt.code}>
                        <button
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            console.log('[Navbar] Mobile lang clicked:', opt.code); 
                            setLang(opt.code); 
                            setLangOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-none text-left ${
                            lang === opt.code
                              ? 'bg-green-50 text-green-700'
                              : 'bg-transparent text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span aria-hidden="true">{opt.flag}</span>
                          <span>{opt.full}</span>
                          {lang === opt.code && (
                            <span className="ml-auto text-green-500 text-xs" aria-hidden="true">✓</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Avatar (logged in) */}
              {user && (
                <div
                  className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #0284c7)' }}
                  aria-label={displayName}
                >
                  {initials}
                </div>
              )}

              {/* Hamburger */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="flex flex-col justify-center items-center w-9 h-9 rounded-full hover:bg-slate-100 bg-transparent border border-slate-200 cursor-pointer transition-colors gap-[5px]"
                aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                <span className={`block w-4 h-[1.5px] bg-slate-700 rounded-full transition-all duration-200 origin-center ${mobileOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
                <span className={`block w-4 h-[1.5px] bg-slate-700 rounded-full transition-all duration-200 ${mobileOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block w-4 h-[1.5px] bg-slate-700 rounded-full transition-all duration-200 origin-center ${mobileOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
              </button>
            </div>

          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu">
          <MobileMenu
            navLinks={navLinks}
            onClose={() => setMobileOpen(false)}
            onProtectedClick={handleProtectedClick}
          />
        </div>
      )}
    </>
  )
}
