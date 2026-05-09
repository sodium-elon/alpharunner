import { StartClient } from '@tanstack/react-start/client'
import { isMockMode } from './mocks/data'

if (isMockMode()) {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'warn' })
}

export default function App() {
  return <StartClient />
}
