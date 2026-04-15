import { useState, FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { theme } from '../styles/theme'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colors.surface,
        padding: '1rem',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: theme.colors.bg,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: '2rem',
          boxShadow: theme.shadow.card,
        }}
      >
        <h1
          style={{
            margin: '0 0 0.25rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          BookScan
        </h1>
        <p style={{ margin: '0 0 1.5rem', color: theme.colors.muted, fontSize: '0.9rem' }}>
          Sign in to your inventory
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: '0.4rem',
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                fontSize: '0.95rem',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                outline: 'none',
                fontFamily: theme.font.sans,
              }}
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                fontSize: '0.95rem',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                outline: 'none',
                fontFamily: theme.font.sans,
              }}
            />
          </div>
          {error && (
            <p
              style={{
                color: theme.colors.danger,
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.7rem',
              fontSize: '0.95rem',
              fontWeight: 500,
              background: loading ? theme.colors.muted : theme.colors.text,
              color: '#fff',
              border: 'none',
              borderRadius: theme.radius.sm,
              cursor: loading ? 'default' : 'pointer',
              fontFamily: theme.font.sans,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
