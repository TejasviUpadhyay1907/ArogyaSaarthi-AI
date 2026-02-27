import { Routes, Route } from 'react-router-dom'
import { LangProvider } from './i18n/LangContext'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import EmergencyBar from './components/EmergencyBar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Chat from './pages/Chat'
import SymptomChecker from './pages/SymptomChecker'
import Appointment from './pages/Appointment'
import NearbyFacilities from './pages/NearbyFacilities'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './routes/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <div className="min-h-screen flex flex-col font-sans">
          <EmergencyBar />
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/"     element={<Home />} />
              <Route path="/auth" element={<AuthPage />} />

              {/* Protected — require login + verified email */}
              <Route path="/chat"        element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/symptoms"    element={<ProtectedRoute><SymptomChecker /></ProtectedRoute>} />
              <Route path="/appointment" element={<ProtectedRoute><Appointment /></ProtectedRoute>} />
              <Route path="/nearby"      element={<ProtectedRoute><NearbyFacilities /></ProtectedRoute>} />
              <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </LangProvider>
    </AuthProvider>
  )
}
