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

// Routes that require login
const PROTECTED = ['/chat', '/symptoms', '/appointment', '/nearby', '/dashboard']

const ChevronIcon = ({ open }) => (
  <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function useOutsideClick(ref, cb) {
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) cb() }
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
  const [loginToast, setLoginToast] = useState(false)

  const langRef = useRef(null)
  const userRef = useRef(null)

  const closeLang = useCallback(() => setLangOpen(false), [])
  const closeUser = useCallback(() => setUserOpen(false), [])
  useOutsideClick(langRef, closeLang)
  useOutsideClick(userRef, closeUser)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Auto-dismiss login toast
  useEffect(() => {
    if (!loginToast) return
    const t = setTimeout(() => setLoginToast(false), 3000)
    return () => clearTimeout(t)
  }, [loginToast])

  const displayName = profile?.name || user?.displayName || 'User'
  const initials    = displayName.trim()[0]?.toUpperCase() ?? '?'
  const currentLang = LANG_OPTIONS.find(l => l.code === lang) || LANG_OPTIONS[0]

  // Intercept clicks on protected links when logged out
  const handleProtectedClick = (e, to) => {
    if (!user && PROTECTED.includes(to)) {
      e.preventDefault()
      setLoginToast(true)
      setTimeout(() => navigate(`/auth?from=${encodeURIComponent(to)}`), 1200)
    }
  }

  // All nav links — protected ones get the guard
  const navLinks = [
    { to: '/',            label: t('nav.home'),       icon: '🏠', end: true,  protected: false },
    { to: '/chat',        label: t('nav.chat'),        icon: '🤖', end: false, protected: true  },
    { to: '/symptoms',    label: t('nav.symptoms'),    icon: '🩺', end: false, protected: true  },
    { to: '/appointment', label: t('nav.appointment'), icon: '📅', end: false, protected: true  },
  ]

  return (
    <>
      {/* Login toast */}
      {loginToast && (
        <div
          role="alert"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-scale-in"
        >
          <span>🔒</span> Please login to continue
        </div>
      )}

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        {/* 3-column grid: [logo | center links | right actions] */}
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16"
          style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center' }}
        >

          {/* ── COL 1: Logo ── */}
          <Link to="/" className="flex items-center gap-2 no-underline group min-w-0" aria-label="ArogyaSaarthi AI home">
            <Logo size={34} />
            <div className="hidden sm:block leading-tight whitespace-nowrap">
              <span className="text-[14px] font-bold text-green-700 group-hover:text-green-600 transition-colors">ArogyaSaarthi</span>
              <span className="text-[14px] font-bold text-blue-600 group-hover:text-blue-500 transition-colors"> AI</span>
            </div>
          </Link>

          {/* ── COL 2: Center nav links (md+) ── */}
          <nav aria-label="Main navigation" className="hidden md:flex justify-self-center items-center">
            <ul className="flex items-center gap-1 list-none m-0 p-0">
              {navLinks.map(l => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.end}
                    onClick={(e) => handleProtectedClick(e, l.to)}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-full text-[13px] font-medium transition-all no-underline whitespace-nowrap ${
                        isActive
                          ? 'text-green-700 bg-green-50 font-semibold'
                          : 'text-gray-500 hover:text-green-700 hover:bg-green-50/70'
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── COL 3: Right actions ── */}
          <div className="justify-self-end flex items-center gap-2 min-w-0">

            {/* Talk to AI — only shown when logged in on desktop */}
            {user && (
              <Link
                to="/chat"
                className="hidden lg:flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold text-white bg-gradient-to-r from-green-600 to-blue-600 shadow-sm hover:shadow-md hover:-translate-y-px transition-all no-underline whitespace-nowrap"
              >
                <span aria-hidden="true">🎙️</span>
                <span>{t('nav.talkToAI')}</span>
              </Link>
            )}

            {/* Language dropdown — always visible */}
            <div className="relative hidden md:block" ref={langRef}>
              <button
                onClick={() => { setLangOpen(o => !o); setUserOpen(false) }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-green-50 hover:text-green-700 text-gray-600 text-[11px] font-semibold transition-colors border-none cursor-pointer whitespace-nowrap"
                aria-label={`Language: ${currentLang.full}`}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
              >
                <span aria-hidden="true">{currentLang.flag}</span>
                <span>{currentLang.label}</span>
                <ChevronIcon open={langOpen} />
              </button>
              {langOpen && (
                <ul role="listbox" aria-label="Select language"
                  className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 w-36 z-50 list-none p-0 m-0">
                  {LANG_OPTIONS.map(opt => (
                    <li key={opt.code} role="option" aria-selected={lang === opt.code}>
                      <button
                        onClick={() => { setLang(opt.code); setLangOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-none text-left ${
                          lang === opt.code ? 'bg-green-50 text-green-700' : 'bg-transparent text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span aria-hidden="true">{opt.flag}</span>
                        <span>{opt.full}</span>
                        {lang === opt.code && <span className="ml-auto text-green-500 text-xs" aria-hidden="true">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* User chip (logged in) or Login button */}
            {user ? (
              <div className="relative hidden md:block" ref={userRef}>
                <button
                  onClick={() => { setUserOpen(o => !o); setLangOpen(false) }}
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-green-50 hover:bg-green-100 text-green-700 text-[12px] font-semibold transition-colors border-none cursor-pointer min-w-0"
                  style={{ maxWidth: '148px' }}
                  aria-label="User menu" aria-expanded={userOpen} aria-haspopup="menu"
                >
                  <span className="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
                    {initials}
                  </span>
                  <span className="truncate max-w-[72px]">{displayName}</span>
                  <ChevronIcon open={userOpen} />
                </button>
                {userOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 w-44 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-50">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{displayName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{profile?.role || 'Patient'}</p>
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => { logout(); setUserOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer text-left transition-colors"
                    >
                      <span aria-hidden="true">🚪</span> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden md:inline-flex items-center px-4 py-1.5 rounded-full text-[12px] font-semibold text-green-700 border-2 border-green-500 hover:bg-green-50 transition-colors no-underline whitespace-nowrap"
              >
                Login
              </Link>
            )}

            {/* ── Mobile right: lang + avatar + hamburger ── */}
            <div className="flex md:hidden items-center gap-1.5">
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setLangOpen(o => !o)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold border-none cursor-pointer whitespace-nowrap"
                  aria-label={`Language: ${currentLang.full}`} aria-expanded={langOpen}
                >
                  <span aria-hidden="true">{currentLang.flag}</span>
                  <span>{currentLang.label}</span>
                </button>
                {langOpen && (
                  <ul role="listbox" className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 w-36 z-50 list-none p-0 m-0">
                    {LANG_OPTIONS.map(opt => (
                      <li key={opt.code} role="option" aria-selected={lang === opt.code}>
                        <button
                          onClick={() => { setLang(opt.code); setLangOpen(false) }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-none text-left ${
                            lang === opt.code ? 'bg-green-50 text-green-700' : 'bg-transparent text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span aria-hidden="true">{opt.flag}</span>
                          <span>{opt.full}</span>
                          {lang === opt.code && <span className="ml-auto text-green-500 text-xs" aria-hidden="true">✓</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {user && (
                <Link
                  to="/dashboard"
                  className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold no-underline"
                  aria-label={`${displayName}'s dashboard`}
                >
                  {initials}
                </Link>
              )}

              <button
                onClick={() => setMobileOpen(o => !o)}
                className="flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-gray-100 bg-transparent border-none cursor-pointer transition-colors gap-1.5"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                <span className={`block w-5 h-0.5 bg-gray-700 rounded transition-all duration-200 origin-center ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block w-5 h-0.5 bg-gray-700 rounded transition-all duration-200 ${mobileOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block w-5 h-0.5 bg-gray-700 rounded transition-all duration-200 origin-center ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
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
