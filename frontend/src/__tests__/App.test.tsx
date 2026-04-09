import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, logout: vi.fn() }),
}))
vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard" />,
}))
vi.mock('../pages/PhotoWorkflowPage', () => ({
  default: () => <div data-testid="scan" />,
}))
vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login" />,
}))

describe('root URL routing', () => {
  it('unknown path redirects to /dashboard when authenticated', () => {
    window.history.pushState({}, '', '/some-unknown-path')
    render(<App />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('scan')).not.toBeInTheDocument()
  })

  it('unknown path on mobile width also redirects to /dashboard (not /scan)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    window.history.pushState({}, '', '/another-unknown-path')
    render(<App />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('scan')).not.toBeInTheDocument()
  })
})
