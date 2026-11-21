import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { loadConfigFromFile } from 'vite'

it('loads the separate Storybook config using native TypeScript paths', async () => {
  const configFile = fileURLToPath(new URL('../../.storybook/vite.config.ts', import.meta.url))
  const result = await loadConfigFromFile({ command: 'build', mode: 'test' }, configFile)
  expect(result?.config.resolve?.tsconfigPaths).toBe(true)
})
