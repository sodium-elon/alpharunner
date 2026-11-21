import { afterEach, expect, it, vi } from 'vitest'
import { closeMockServer, initializeMockServer } from '../setup'
import { mockServer } from '../server'

vi.mock('../data', () => ({ isMockMode: () => true }))
vi.mock('../server', () => ({ mockServer: { listen: vi.fn(), close: vi.fn() } }))

afterEach(() => {
  delete (globalThis as typeof globalThis & { __mswListening?: boolean }).__mswListening
  vi.clearAllMocks()
})

it('uses MSW 3 frame warnings and starts interception only once', () => {
  initializeMockServer()
  initializeMockServer()
  expect(mockServer.listen).toHaveBeenCalledExactlyOnceWith({ onUnhandledFrame: 'warn' })
  closeMockServer()
  expect(mockServer.close).toHaveBeenCalledOnce()
})
