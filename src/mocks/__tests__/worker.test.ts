import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('serves the worker shipped by the installed MSW version', () => {
  const publishedWorker = new URL('../../../public/mockServiceWorker.js', import.meta.url)
  const installedWorker = new URL('../../../node_modules/msw/lib/mockServiceWorker.js', import.meta.url)
  expect(readFileSync(publishedWorker, 'utf8')).toBe(readFileSync(installedWorker, 'utf8'))
})
