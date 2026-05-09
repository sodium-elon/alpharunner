import { isMockMode } from './data'
import { mockServer } from './server'

// Called once at server startup — patches Node.js fetch so MSW intercepts requests
// globalThis guard prevents double-start when Vite HMR re-evaluates this module
export function initializeMockServer() {
  if (!isMockMode()) return
  if ((globalThis as any).__mswListening) return
  (globalThis as any).__mswListening = true
  mockServer.listen({ onUnhandledRequest: 'warn' })
}

export function closeMockServer() {
  mockServer.close()
}
