import { defineConfig } from 'vitest/config'

// Unit tests must not boot TanStack Start or Nitro from the app's Vite config.
export default defineConfig({
  test: { environment: 'node' },
})
