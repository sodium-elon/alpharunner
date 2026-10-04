import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { loadCoachEnvironment } from '../environment'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
it('uses the existing shared Jev key without copying or exposing it in diagnostics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'coach-env-')); dirs.push(root)
  const projectEnv = join(root, 'project.env'), sharedEnv = join(root, 'typesafe.env')
  await writeFile(projectEnv, 'DATABASE_URL=postgres://fake.invalid/db\n')
  await writeFile(sharedEnv, 'TYPESAFE_API_KEY=fixture-only\n')
  const env = await loadCoachEnvironment({ projectEnv, sharedEnv, processEnv: {} })
  expect(env.apiKey).toBe('fixture-only')
  expect(env.databaseUrl).toBe('postgres://fake.invalid/db')
  expect(env.diagnostics).toEqual({ database: true, typesafe: true, openrouter: false })
})
