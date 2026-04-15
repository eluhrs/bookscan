import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock URL.createObjectURL and URL.revokeObjectURL for tests
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()
