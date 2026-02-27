import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LangContext'

const ROLE_ICONS = { Patient: '🧑‍⚕️', Doctor: '👨‍⚕️', Admin: '🛡️' }

export default function Dashboard() {
  const { user, profile, logout } = useAuth()
  const { t } = useLang()

  const displayName = profile?.name || user?.displayName || 'User'
  const role        = profile?.role || 'Patient'
  const phone       = profile?.phone
  const email       = profile?.email || user?.email

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            {ROLE_ICONS[role] || '🧑'}
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {t('dashboard.hello').replace('{name}', displayName)}
          </h1>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 mb-6">
            {role}
          </span>

          {/* Info */}
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6">
            {email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📧</span>
                <span>{email}</span>
                {user?.emailVerified && <span className="ml-auto text-green-500 text-xs font-semibold">{t('dashboard.verified')}</span>}
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📱</span>
                <span>{phone}</span>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link to="/chat" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-green-50 hover:bg-green-100 transition-colors no-underline">
              <span className="text-2xl">🎙️</span>
              <span className="text-xs font-semibold text-green-700">{t('dashboard.aiChat')}</span>
            </Link>
            <Link to="/symptoms" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-colors no-underline">
              <span className="text-2xl">🩺</span>
              <span className="text-xs font-semibold text-blue-700">{t('dashboard.symptomCheck')}</span>
            </Link>
            <Link to="/nearby" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-teal-50 hover:bg-teal-100 transition-colors no-underline">
              <span className="text-2xl">📍</span>
              <span className="text-xs font-semibold text-teal-700">{t('dashboard.nearbyFacilities')}</span>
            </Link>
            <Link to="/appointment" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors no-underline">
              <span className="text-2xl">📅</span>
              <span className="text-xs font-semibold text-orange-700">{t('dashboard.appointments')}</span>
            </Link>
          </div>

          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors border-none cursor-pointer"
          >
            {t('dashboard.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
