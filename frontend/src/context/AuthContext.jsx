import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, reload } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Always reload to get fresh emailVerified status
        try { await reload(firebaseUser) } catch {}
        setUser(firebaseUser)
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
          setProfile(snap.exists() ? snap.data() : null)
        } catch {
          setProfile(null)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setProfile(null)
  }

  // Force-refresh user object (e.g. after email verification)
  const reloadUser = async () => {
    if (!auth.currentUser) return
    await reload(auth.currentUser)
    setUser({ ...auth.currentUser })
    try {
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid))
      setProfile(snap.exists() ? snap.data() : null)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, setProfile, reloadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
