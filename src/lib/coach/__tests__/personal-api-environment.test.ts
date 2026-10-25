import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { loadCoachEnvironment } from '../environment'
import { createCoachServices } from '../service'
import { dispatchCoachCommand } from '../commands'
import type { PostgresRepository } from '../repository'

it('propagates the privately loaded project env file through the real service subprocess boundary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'coach-personal-api-'))
  try {
    const executable = join(root, 'garmin-cli'), calls = join(root, 'calls.jsonl'), projectEnv = join(root, 'project.env')
    await writeFile(executable, `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
const result = args.includes('check') ? { status: 'ok', profile: {} }
  : args.includes('list') ? [{ activityId: 123, startTimeLocal: '2026-10-02', activityName: 'Run' }]
  : { activityId: 123, activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-02' } };
console.log(JSON.stringify(result));
`, { mode: 0o700 })
    await writeFile(projectEnv, `GARMIN_TOKEN=fixture-private-token\nCOACH_GARMIN_CLI=${executable}\nCOACH_GARMIN_TOKENS=/fixture/tokens\nCOACH_STATE_DIR=${join(root, 'tasks')}\n`)
    const environment = await loadCoachEnvironment({ projectEnv, sharedEnv: join(root, 'absent'), processEnv: {} })
    const sql = { unsafe: vi.fn(async () => [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', brand: 'Adidas', model: 'Boston 13', variant: null, status: 'active', role: 'daily', category: null, notes: null }]) }
    const runner = vi.fn()
    const services = createCoachServices(environment, { runner, openRepository: () => ({ sql, close: async () => {} }) as unknown as PostgresRepository })
    const prepared = await dispatchCoachCommand(['prepare', '--date', '2026-10-02', '--term', 'Adidas Boston 13', '--user-request', 'Prepare only'], services)
    expect(prepared).toMatchObject({ status: 'awaiting_confirmation', task: { activityId: '123', date: '2026-10-02' } })
    const recorded = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[])
    expect(recorded).toHaveLength(3)
    for (const args of recorded) expect(args.slice(0, 4)).toEqual(['--tokenstore', '/fixture/tokens', '--env-file', projectEnv])
    expect(JSON.stringify(recorded)).not.toContain('fixture-private-token')
    expect(JSON.stringify(environment)).not.toContain('fixture-private-token')
    expect(runner).not.toHaveBeenCalled()
  } finally { await rm(root, { recursive: true, force: true }) }
})
