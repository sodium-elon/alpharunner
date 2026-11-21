import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { createServerFn } from '@tanstack/react-start'

// Exercise the actual registration against Start's builder without importing
// route modules (and therefore without booting DB, router, or app plugins).
it.each([
  ['run.$runId.tsx', 'getRunDetail'],
  ['shoes.$shoeId.tsx', 'getShoeDetail'],
])('%s registers its detail input validator with the installed Start API', (file, name) => {
  const source = readFileSync(new URL(`../routes/${file}`, import.meta.url), 'utf8')
  const registration = source.slice(source.indexOf(`const ${name} =`), source.indexOf('.handler(async'))
  const script = ts.transpile(`${registration}\nglobalThis.registered = ${name}`, { target: ts.ScriptTarget.ES2024 })
  const context = createContext({ createServerFn })
  runInContext(script, context)
  expect(context.registered.options.validator('fixture-id')).toBe('fixture-id')
})
