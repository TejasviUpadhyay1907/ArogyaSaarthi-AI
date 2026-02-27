import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps any route that requires authentication.
 * Rules:
 *  - Loading  → show spinner (avoid flash of redirect)
 *  - No user  → redirect to /auth with ?from= so we can return after login
 *  - Email/password user with unverified email → redirect to /auth?unverified=1
 *  - Otherwise → render children
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/auth?from=${encodeURIComponent(location.pathname)}`} replace />
  }

  // Email/password accounts must verify before accessing protected features
  const isEmailProvider = user.providerData?.[0]?.providerId === 'password'
  if (isEmailProvider && !user.emailVerified) {
    return <Navigate to="/auth?unverified=1" replace />
  }

  return children
}
