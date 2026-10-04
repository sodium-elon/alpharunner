import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCoachServices } from '../service'
import { dispatchCoachCommand } from '../commands'
import type { CoachEnvironment } from '../environment'
import type { PostgresRepository } from '../repository'

it('prepares a pinned date, activity and exact shoe without importing or querying Jev', async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'coach-services-'))
  try {
    const sql = { unsafe: vi.fn(async (_query: string) => [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', brand: 'Adidas', model: 'Boston 13', variant: null, status: 'active', role: 'daily', category: null, notes: null }]) }
    const runner = vi.fn()
    const services = createCoachServices({ stateRoot: stateDirectory, garminExecutable: '/unused', garminTokenStore: '/unused' } as CoachEnvironment, {
      runner, gateway: { findActivities: async () => [{ activityId: '123', date: '2026-10-02', title: 'Sprint' }] } as never,
      openRepository: () => ({ sql, close: async () => {}, transaction: vi.fn() } as PostgresRepository),
    })
    const prepared = await dispatchCoachCommand(['prepare', '--date', '2026-10-02', '--term', 'Adidas Boston 13', '--user-request', 'Import with Boston 13'], services) as { task: { id: string; facts: unknown }; status: string }
    expect(prepared.status).toBe('awaiting_confirmation')
    expect(prepared.task).toMatchObject({ date: '2026-10-02', activityId: '123', shoeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
    expect(runner).not.toHaveBeenCalled()
    expect(sql.unsafe.mock.calls).toHaveLength(1)
    expect(sql.unsafe.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE/i)
  } finally { await rm(stateDirectory, { recursive: true, force: true }) }
})
it('never invokes persistence from a route classification or an unconfirmed import', async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'coach-services-'))
  try {
    const openRepository = vi.fn()
    const services = createCoachServices({ stateRoot: stateDirectory, garminExecutable: '/unused', garminTokenStore: '/unused' } as CoachEnvironment, { openRepository })
    const created = await dispatchCoachCommand(['task-create', '--date', '2026-10-02', '--activity-id', '123', '--shoe-id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '--user-request', 'prepare only'], services) as {id:string}
    await expect(dispatchCoachCommand(['import-task','--task-id',created.id,'--coaching-file','/not-read'],services)).rejects.toThrow(/confirmation/i)
    expect(openRepository).not.toHaveBeenCalled()
  } finally { await rm(stateDirectory, { recursive: true, force: true }) }
})
