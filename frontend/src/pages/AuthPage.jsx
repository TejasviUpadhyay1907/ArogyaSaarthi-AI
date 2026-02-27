import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reload,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// ── dev logger ────────────────────────────────────────────────────────────────
const isDev = import.meta.env.DEV
const log = (...a) => { if (isDev) console.log('[Auth]', ...a) }

// ── constants ─────────────────────────────────────────────────────────────────
const RESEND_COOLDOWN = 60

const FIREBASE_ERRORS = {
  'auth/email-already-in-use': 'This email is already registered. Try logging in.',
  'auth/invalid-email':        'Invalid email address.',
  'auth/weak-password':        'Password must be at least 6 characters.',
  'auth/user-not-found':       'No account found with this email.',
  'auth/wrong-password':       'Incorrect password.',
  'auth/invalid-credential':   'Incorrect email or password.',
  'auth/too-many-requests':    'Too many attempts. Please wait a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/user-disabled':        'This account has been disabled.',
}
const friendlyError = (e) => FIREBASE_ERRORS[e?.code] || e?.message || 'Something went wrong.'

// ── cooldown hook ─────────────────────────────────────────────────────────────
function useCooldown(seconds) {
  const [left, setLeft] = useState(0)
  const timer = useRef(null)
  const start = useCallback(() => {
    setLeft(seconds)
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      setLeft(p => { if (p <= 1) { clearInterval(timer.current); return 0 } return p - 1 })
    }, 1000)
  }, [seconds])
  useEffect(() => () => clearInterval(timer.current), [])
  return [left, start]
}

// ── shared input ──────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, autoComplete, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-gray-50"
      />
    </div>
  )
}

// ── password input with show/hide toggle ──────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    // Eye open — password visible
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    // Eye with slash — password hidden
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function PasswordField({ label, value, onChange, placeholder, autoComplete, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer p-0.5 rounded disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  )
}

// ── submit button ─────────────────────────────────────────────────────────────
function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-green-600 to-blue-600 hover:opacity-90 transition-opacity disabled:opacity-60 border-none cursor-pointer shadow-md"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, setProfile } = useAuth()

  const [tab, setTab]           = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [name, setName]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  // Unverified state — set when login detects unverified email
  const [unverifiedUser, setUnverifiedUser] = useState(null)
  const [checkingVerified, setCheckingVerified] = useState(false)
  const [resendCooldown, startResendCooldown] = useCooldown(RESEND_COOLDOWN)

  // Redirect if already verified and logged in
  useEffect(() => {
    if (user?.emailVerified) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  // Handle redirect from ProtectedRoute with ?unverified=1
  useEffect(() => {
    if (searchParams.get('unverified')) {
      setTab('login')
      setError('Please verify your email before accessing the app.')
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        setUnverifiedUser(auth.currentUser)
      }
    }
  }, [searchParams])

  const clear = () => { setError(''); setInfo('') }

  const switchTab = (t) => {
    setTab(t); clear()
    setUnverifiedUser(null)
    setPassword(''); setConfirmPw(''); setName('')
  }

  // ── Firestore profile ─────────────────────────────────────────────────────
  const saveProfile = async (uid, data) => {
    const ref = doc(db, 'users', uid)
    await setDoc(ref, { ...data, lastLoginAt: serverTimestamp() }, { merge: true })
    const snap = await getDoc(ref)
    setProfile(snap.data())
    log('Profile saved:', uid, snap.data())
  }

  // ── SIGNUP ────────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault(); clear()
    if (!name.trim())          return setError('Please enter your full name.')
    if (password !== confirmPw) return setError('Passwords do not match.')
    if (password.length < 6)   return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      log('Account created:', cred.user.uid)
      await updateProfile(cred.user, { displayName: name.trim() })
      await sendEmailVerification(cred.user)
      log('Verification email sent to:', email.trim())
      await saveProfile(cred.user.uid, {
        uid: cred.user.uid,
        name: name.trim(),
        email: email.trim(),
        role: 'patient',
        createdAt: serverTimestamp(),
      })
      startResendCooldown()
      setInfo(`Verification email sent to ${email.trim()}. Please verify before logging in.`)
      setTab('login')
      setPassword(''); setConfirmPw(''); setName('')
    } catch (err) {
      log('Signup error:', err.code, err.message)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault(); clear()
    setUnverifiedUser(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      log('Login, emailVerified:', cred.user.emailVerified)
      if (!cred.user.emailVerified) {
        setUnverifiedUser(cred.user)
        setError('Email not verified. Check your inbox and click the verification link.')
        setLoading(false)
        return
      }
      await saveProfile(cred.user.uid, { lastLoginAt: serverTimestamp() })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      log('Login error:', err.code, err.message)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── RESEND VERIFICATION ───────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return
    const target = unverifiedUser || auth.currentUser
    if (!target) return setError('Please log in first, then resend.')
    setLoading(true); clear()
    try {
      await sendEmailVerification(target)
      log('Verification resent to:', target.email)
      startResendCooldown()
      setInfo(`Verification email sent to ${target.email}. Check your inbox and spam folder.`)
    } catch (err) {
      log('Resend error:', err.code, err.message)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── "I VERIFIED" ──────────────────────────────────────────────────────────
  const handleCheckVerified = async () => {
    const target = unverifiedUser || auth.currentUser
    if (!target) return setError('Please log in first.')
    setCheckingVerified(true); clear()
    try {
      await reload(target)
      log('Reloaded, emailVerified:', target.emailVerified)
      if (target.emailVerified) {
        await saveProfile(target.uid, { lastLoginAt: serverTimestamp() })
        navigate('/dashboard', { replace: true })
      } else {
        setError('Email not verified yet. Click the link in your inbox, then try again.')
      }
    } catch (err) {
      log('Reload error:', err.code, err.message)
      setError(friendlyError(err))
    } finally {
      setCheckingVerified(false)
    }
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email.trim()) return setError('Enter your email address above first.')
    setLoading(true); clear()
    try {
      await sendPasswordResetEmail(auth, email.trim())
      log('Password reset sent to:', email.trim())
      setInfo('Password reset link sent. Check your inbox.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-800">ArogyaSaarthi AI</h1>
          <p className="text-sm text-gray-500 mt-1">Your AI Health Navigator</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {['login', 'signup'].map(t => (
              <button
                key={t} onClick={() => switchTab(t)}
                className={`flex-1 py-4 text-sm font-semibold transition-colors border-none cursor-pointer ${
                  tab === t
                    ? 'text-green-700 bg-green-50 border-b-2 border-green-500'
                    : 'text-gray-500 bg-white hover:bg-gray-50'
                }`}
              >
                {t === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                <span className="flex-shrink-0 mt-px">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Info */}
            {info && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700">
                <span className="flex-shrink-0 mt-px">✅</span>
                <span>{info}</span>
              </div>
            )}

            {/* Unverified inline actions */}
            {unverifiedUser && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                <p className="text-sm font-semibold text-blue-800">📧 Email not verified</p>
                <p className="text-xs text-blue-700">
                  Check <strong>{unverifiedUser.email}</strong> — also check your spam folder.
                </p>
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    onClick={handleResend}
                    disabled={loading || resendCooldown > 0}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 text-white disabled:opacity-50 border-none cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
                  </button>
                  <button
                    onClick={handleCheckVerified}
                    disabled={checkingVerified || loading}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-600 text-white disabled:opacity-50 border-none cursor-pointer hover:bg-green-700 transition-colors"
                  >
                    {checkingVerified ? 'Checking…' : 'I verified ✓'}
                  </button>
                </div>
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field
                  label="Email" type="email" value={email}
                  onChange={v => { setEmail(v); setUnverifiedUser(null) }}
                  placeholder="you@example.com" autoComplete="email" disabled={loading}
                />
                <PasswordField
                  label="Password" value={password}
                  onChange={setPassword} placeholder="Your password"
                  autoComplete="current-password" disabled={loading}
                />
                <SubmitBtn loading={loading} label="Login →" loadingLabel="Signing in…" />
                <div className="flex justify-between text-xs pt-1">
                  <button
                    type="button" onClick={handleForgotPassword} disabled={loading}
                    className="text-blue-600 hover:underline bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                  {!unverifiedUser && (
                    <button
                      type="button" onClick={handleResend}
                      disabled={loading || resendCooldown > 0}
                      className="text-gray-500 hover:underline bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification'}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ── SIGNUP FORM ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <Field
                  label="Full Name" value={name} onChange={setName}
                  placeholder="Your full name" autoComplete="name" disabled={loading}
                />
                <Field
                  label="Email" type="email" value={email} onChange={setEmail}
                  placeholder="you@example.com" autoComplete="email" disabled={loading}
                />
                <PasswordField
                  label="Password" value={password} onChange={setPassword}
                  placeholder="Min 6 characters" autoComplete="new-password" disabled={loading}
                />
                <PasswordField
                  label="Confirm Password" value={confirmPw} onChange={setConfirmPw}
                  placeholder="Repeat password" autoComplete="new-password" disabled={loading}
                />
                <SubmitBtn loading={loading} label="Create Account →" loadingLabel="Creating account…" />
              </form>
            )}

            {/* Switch tab */}
            <p className="text-center text-xs text-gray-400 pt-2">
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}
                className="text-green-600 font-semibold hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                {tab === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          🔒 Secured by Firebase · No health data stored
        </p>
      </div>
    </div>
  )
}
