import { expect, it, vi } from 'vitest'
import { dispatchCoachCommand } from '../commands'
import { createCoachServices } from '../service'
import type { CoachEnvironment } from '../environment'
import type { PostgresRepository } from '../repository'

const row = { runId: 'fixture-run', date: '2026-10-04', activityId: '24606992273', distanceKm: '16.96', durationSeconds: 5342, paceSecPerKm: 315, shoeId: 'fixture-shoe', brand: 'Qiaodan', model: 'Leili 2.0', evidence: 'Power source: validated Stryd stream' }
function fixture(rows: typeof row[]) {
  const sql = { unsafe: vi.fn().mockResolvedValue(rows) }
  const transaction = vi.fn(), close = vi.fn()
  const gateway = { findActivities: vi.fn(), fetchActivity: vi.fn(), fetchContext: vi.fn() }
  const runner = vi.fn()
  const handlers = createCoachServices({ stateRoot: '/not-written-fixture-state', garminExecutable: '/unused', garminTokenStore: '/unused' } as CoachEnvironment, {
    runner, gateway: gateway as never,
    openRepository: () => ({ sql, close, transaction }) as unknown as PostgresRepository,
  })
  return { sql, transaction, close, gateway, runner, handlers }
}
it('answers a dated factual lookup from current SQL data with no import or Garmin/Jev work', async () => {
  const f = fixture([row])
  const out = await dispatchCoachCommand(['run-summary', '--date', row.date], f.handlers) as any
  expect(out.status).toBe('found')
  expect(out.run.runId).toBe(row.runId)
  expect(out.run.shoeId).toBe(row.shoeId)
  expect(out.run.powerSource).toBe('stryd')
  expect(out.run.averageSpeedKmh).toBe(Number((Number(row.distanceKm) * 3600 / row.durationSeconds).toFixed(2)))
  expect(f.sql.unsafe).toHaveBeenCalledTimes(1)
  expect(f.sql.unsafe.mock.calls[0][1]).toEqual([row.date])
  expect(f.sql.unsafe.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/i)
  expect(f.transaction).not.toHaveBeenCalled()
  expect(f.close).toHaveBeenCalledTimes(1)
  expect(f.gateway.fetchActivity).not.toHaveBeenCalled()
  expect(f.gateway.fetchContext).not.toHaveBeenCalled()
  expect(f.runner).not.toHaveBeenCalled()
})
it.each([['not_found', []], ['ambiguous', [row, { ...row, runId: 'second-run', activityId: '24606992274' }]]] as const)('reports %s instead of assuming a different run', async (status, rows) => {
  const f = fixture([...rows])
  const out = await dispatchCoachCommand(['run-summary', '--date', row.date], f.handlers) as any
  expect(out.status).toBe(status)
  expect(out.run).toBeUndefined()
  expect(f.sql.unsafe).toHaveBeenCalledTimes(1)
  expect(f.transaction).not.toHaveBeenCalled()
})
