import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import { loadCoachEnvironment } from '../environment'

vi.mock('node:os', async importOriginal => ({
  ...await importOriginal<typeof import('node:os')>(),
  homedir: () => '/nonexistent-coach-test-home',
}))

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
it('loads a configured shared credential path without depending on terminal HOME', async () => {
  const root = await mkdtemp(join(tmpdir(), 'coach-env-')); dirs.push(root)
  const projectEnv = join(root, 'project.env'), sharedEnv = join(root, 'real-shared.env')
  await writeFile(projectEnv, `COACH_SHARED_ENV=${sharedEnv}\nCOACH_GARMIN_CLI=/real/pinned/garmin-cli\nCOACH_GARMIN_TOKENS=/real/pinned/tokens\nCOACH_STATE_DIR=/real/pinned/tasks\n`)
  await writeFile(sharedEnv, 'TYPESAFE_API_KEY=fixture-shared-only\n')
  const env = await loadCoachEnvironment({ projectEnv, processEnv: {} })
  expect(env.apiKey).toBe('fixture-shared-only')
  expect(env.garminExecutable).toBe('/real/pinned/garmin-cli')
  expect(env.garminTokenStore).toBe('/real/pinned/tokens')
  expect(env.stateRoot).toBe('/real/pinned/tasks')
  expect(JSON.stringify(env.diagnostics)).not.toContain('fixture-shared-only')
})

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
