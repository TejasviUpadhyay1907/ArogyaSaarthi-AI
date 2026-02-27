import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  // Email/password users must verify email before accessing protected routes
  const isEmailProvider = user.providerData?.[0]?.providerId === 'password'
  if (isEmailProvider && !user.emailVerified) {
    return <Navigate to="/auth?unverified=1" replace />
  }

  return children
}
