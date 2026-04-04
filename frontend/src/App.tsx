import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import { useBreakpoint } from './hooks/useBreakpoint'
import LoginPage from './pages/LoginPage'
import ScanPage from './pages/ScanPage'

// Placeholder — implemented in Task 17
function DashboardPage() { return <div>Dashboard coming soon</div> }

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth()
  const { isMobile } = useBreakpoint()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to={isMobile ? '/scan' : '/dashboard'} replace />} />
    </Routes>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
