import { isMockMode } from './data'
import { mockServer } from './server'

type MockGlobalState = typeof globalThis & {
  __mswListening?: boolean
}

// Called once at server startup — patches Node.js fetch so MSW intercepts requests
// globalThis guard prevents double-start when Vite HMR re-evaluates this module
export function initializeMockServer() {
  if (!isMockMode()) return

  const mockGlobal = globalThis as MockGlobalState

  if (mockGlobal.__mswListening) return
  mockGlobal.__mswListening = true
  mockServer.listen({ onUnhandledRequest: 'warn' })
}

export function closeMockServer() {
  mockServer.close()
}
