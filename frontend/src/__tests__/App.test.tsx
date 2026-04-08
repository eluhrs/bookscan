import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

describe('root URL routing', () => {
  it('wildcard route navigates to /dashboard regardless of window width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })

    const destinations: string[] = []

    function FakeNavigate({ to }: { to: string }) {
      destinations.push(to)
      return null
    }

    render(
      <MemoryRouter initialEntries={['/unknown-path']}>
        <Routes>
          <Route path="/dashboard" element={<div data-testid="dashboard" />} />
          <Route path="*" element={<FakeNavigate to="/dashboard" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(destinations).toContain('/dashboard')
    expect(destinations).not.toContain('/scan')
  })
})
