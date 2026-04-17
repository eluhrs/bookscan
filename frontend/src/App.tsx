import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import PhotoWorkflowPage from './pages/PhotoWorkflowPage'
import DashboardPage from './pages/DashboardPage'
import ProfilerPage from './pages/ProfilerPage'

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/scan" element={<PhotoWorkflowPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profiler" element={<ProfilerPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
