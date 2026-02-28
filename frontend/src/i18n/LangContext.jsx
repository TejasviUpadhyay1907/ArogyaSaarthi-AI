import { createContext, useContext, useState, useCallback } from 'react'
import en from './en.json'
import hi from './hi.json'
import mr from './mr.json'
import ta from './ta.json'
import te from './te.json'

const LANGS = { en, hi, mr, ta, te }

const LangContext = createContext(null)

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj)
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en')

  const setLang = useCallback((l) => {
    console.log('[LangContext] setLang called:', l)
    localStorage.setItem('lang', l)
    setLangState(l)
  }, [])

  // Don't memoize t - create a new function every render
  // This ensures components always get fresh translations
  const t = (key) => {
    const translations = LANGS[lang] || LANGS.en
    const val = getNestedValue(translations, key)
    if (val !== null) return val
    // fallback to English
    return getNestedValue(LANGS.en, key) ?? key
  }

  console.log('[LangContext] Render - Current language:', lang)

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
