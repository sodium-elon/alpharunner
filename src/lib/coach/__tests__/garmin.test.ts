import { writeFile, access } from 'node:fs/promises'
import { expect, it, vi } from 'vitest'
import { GarminGateway } from '../garmin'

it('preserves bounded exit diagnostics without leaking command output or credential-bearing errors', async () => {
  const privateText = 'profile=private token=secret password=hidden ENV=credential'
  const execute = async () => { throw Object.assign(new Error(privateText), { code: 75, stdout: privateText, stderr: privateText }) }
  const gateway = new GarminGateway({ executable: '/private/executable', tokenStore: '/private/tokens', execute })
  await expect(gateway.findActivities('2026-10-04')).rejects.toThrow('Garmin command failed: auth check (exit=75)')
  try { await gateway.findActivities('2026-10-04') } catch (error) {
    expect(String(error)).not.toContain(privateText)
    expect(String(error)).not.toContain('/private')
  }
})

it('reports a real missing executable as ENOENT rather than a generic auth failure', async () => {
  const gateway = new GarminGateway({ executable: '/nonexistent-coach-fixture/garmin-cli', tokenStore: '/private/tokens' })
  await expect(gateway.findActivities('2026-10-04')).rejects.toThrow('Garmin command failed: auth check (error=ENOENT)')
})

it('distinguishes killed subprocesses with an allowlisted signal and bounded metadata', async () => {
  const execute = async () => { throw { code: null, signal: 'SIGTERM', killed: true, message: 'secret', stdout: 'private profile', stderr: 'token' } }
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  await expect(gateway.findActivities('2026-10-04')).rejects.toThrow('Garmin command failed: auth check (signal=SIGTERM killed=true)')
})

const activity = {
  listItem: { activityId: 123, activityName: 'Base', startTimeLocal: '2026-10-03 18:35:18' },
  detail: { activityId: 123, activityTypeDTO: { typeKey: 'treadmill_running' }, summaryDTO: { startTimeLocal: '2026-10-03T18:35:18', startTimeGMT: '2026-10-03T16:35:18', distance: 5000, duration: 1800 } },
  splits: { lapDTOs: [] }, hrZones: [],
}
it('discovers completed activities by exact local date through Personal API list, never calendar', async () => {
  const execute = vi.fn(async (_: string, args: string[]) => {
    if (args.includes('check')) return JSON.stringify({ status: 'ok', profile: {} })
    if (args.includes('get')) return JSON.stringify({ activityId: 123, activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-02T10:00:00' } })
    expect(args.slice(2)).toEqual(['activities', 'list', '--start-date', '2026-10-02', '--end-date', '2026-10-02', '--activity-type', 'running', '--limit', '100', '--start', '0'])
    return JSON.stringify([
      { activityId: 123, startTimeLocal: '2026-10-02T10:00:00', activityName: 'Sprint' },
      { activityId: 456, startTimeLocal: '2026-10-03T10:00:00', activityName: 'Base' },
      { activityId: 'not-numeric', startTimeLocal: '2026-10-02T10:00:00' },
    ])
  })
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  expect(await gateway.findActivities('2026-10-02')).toEqual([{ activityId: '123', date: '2026-10-02', title: 'Sprint' }])
})

it('verifies explicit activity/date before staging and removes its own temporary file', async () => {
  let stagePath = ''
  const execute = vi.fn(async (_executable: string, args: string[]) => {
    const command = args.slice(2)
    if (command[0] === 'auth') return JSON.stringify({ status: 'ok', profile: { verified: true } })
    if (command[0] === 'stage') {
      stagePath = command[command.indexOf('--out') + 1]
      await writeFile(stagePath, JSON.stringify({ activities: [activity] }))
      return 'staged'
    }
    if (command[1] === 'get') return JSON.stringify(activity.detail)
    if (command[1] === 'details') return JSON.stringify({ activityId: 123, metricDescriptors: [], activityDetailMetrics: [] })
    if (command[1] === 'sleep') return JSON.stringify({ dailySleepDTO: { sleepTimeSeconds: 28800 } })
    return JSON.stringify([])
  })
  const gateway = new GarminGateway({ executable: '/fake/garmin-cli', tokenStore: '/fake/tokens', execute })
  const result = await gateway.fetchActivity('123', '2026-10-03')
  expect(result.activity.listItem.activityId).toBe(123)
  expect(result.context).toEqual({ calendar: [], readiness: null, sleep: { dailySleepDTO: { sleepTimeSeconds: 28800 } }, errors: ['calendar unavailable: Personal API does not support planned workouts', 'readiness unavailable: Personal API does not support training readiness'] })
  expect(execute.mock.calls.some(([, args]) => args.includes('fitness'))).toBe(false)
  expect(execute.mock.calls.every(([, args]) => args[0] === '--tokenstore' && args[1] === '/fake/tokens')).toBe(true)
  await expect(access(stagePath)).rejects.toThrow()
})

it('excludes strength without mistaking a mixed-sport day for multiple runs', async () => {
  const details: Record<string, unknown> = {
    '13': { activityId: 13, activityTypeDTO: { typeKey: 'strength_training' }, summaryDTO: { startTimeLocal: '2026-10-14T20:22:22' } },
    '18': { activityId: 18, activityTypeDTO: { typeKey: 'treadmill_running' }, summaryDTO: { startTimeLocal: '2026-10-14T20:52:05' } },
  }
  const execute = async (_: string, args: string[]) => JSON.stringify(args.includes('check') ? { status: 'ok', profile: {} }
    : args.includes('get') ? details[args.at(-1)!] : [
      { startTimeLocal: '2026-10-14', activityId: 13, activityName: 'Recovery' },
      { startTimeLocal: '2026-10-14', activityId: 18, activityName: 'Strength' },
    ])
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  expect(await gateway.findActivities('2026-10-14')).toEqual([{ activityId: '18', date: '2026-10-14', title: 'Strength' }])
})

it('paginates completed activities and deduplicates IDs before detail verification', async () => {
  const row = { activityId: 1, startTimeLocal: '2026-10-14', activityName: 'Run' }
  const execute = vi.fn(async (_: string, args: string[]) => JSON.stringify(args.includes('check') ? { status: 'ok', profile: {} }
    : args.includes('get') ? { activityId: Number(args.at(-1)), activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-14T10:00:00' } }
      : args.at(-1) === '0' ? Array.from({ length: 100 }, () => row) : [row, { ...row, activityId: 2 }]))
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  expect((await gateway.findActivities('2026-10-14')).map(a => a.activityId)).toEqual(['1', '2'])
  expect(execute.mock.calls.filter(([, args]) => args.includes('list')).map(([, args]) => args.at(-1))).toEqual(['0', '100'])
  expect(execute.mock.calls.filter(([, args]) => args.includes('get'))).toHaveLength(2)
})

it('fails closed at ten full pages rather than treating a partial search as unique', async () => {
  let pages = 0
  const execute = vi.fn(async (_: string, args: string[]) => {
    if (args.includes('check')) return JSON.stringify({ status: 'ok', profile: {} })
    if (++pages > 10) throw new Error('test pagination safety stop')
    return JSON.stringify(Array.from({ length: 100 }, () => ({ activityId: 1, startTimeLocal: '2026-10-14' })))
  })
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  await expect(gateway.findActivities('2026-10-14')).rejects.toThrow('Garmin activity search exceeded its bounded page limit')
  expect(pages).toBe(10)
})

it('preserves genuine ambiguity between two completed running activities', async () => {
  const execute = async (_: string, args: string[]) => JSON.stringify(args.includes('check') ? { status: 'ok', profile: {} }
    : args.includes('get') ? { activityId: Number(args.at(-1)), activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-14T10:00:00' } }
      : [1, 2].map(activityId => ({ startTimeLocal: '2026-10-14', activityId, activityName: 'Run' })))
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  expect((await gateway.findActivities('2026-10-14')).map(a => a.activityId)).toEqual(['1', '2'])
})

it.each([
  { activityId: 999, activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-14T10:00:00' } },
  { activityId: 1, activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-10-13T10:00:00' } },
])('rejects mismatched list/detail identity or date', async detail => {
  const execute = async (_: string, args: string[]) => JSON.stringify(args.includes('check') ? { status: 'ok', profile: {} }
    : args.includes('get') ? detail : [{ startTimeLocal: '2026-10-14', activityId: 1 }])
  const gateway = new GarminGateway({ executable: '/fake', tokenStore: '/tokens', execute })
  await expect(gateway.findActivities('2026-10-14')).rejects.toThrow('Garmin activity identity or date changed')
})
