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
it('discovers only completed activities on the exact requested calendar date', async () => {
  const execute = vi.fn(async (_: string, args: string[]) => JSON.stringify(args.includes('check') ? { status: 'ok', profile: {} } : { calendarItems: [
    { itemType: 'activity', date: '2026-10-02', id: 123, title: 'Sprint' },
    { itemType: 'fbtAdaptiveWorkout', date: '2026-10-02', id: 999, title: 'Sprint' },
    { itemType: 'activity', date: '2026-10-03', id: 456, title: 'Base' },
  ] }))
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
    if (command[1] === 'calendar') return JSON.stringify({ calendarItems: [] })
    return JSON.stringify([])
  })
  const gateway = new GarminGateway({ executable: '/fake/garmin-cli', tokenStore: '/fake/tokens', execute })
  const result = await gateway.fetchActivity('123', '2026-10-03')
  expect(result.activity.listItem.activityId).toBe(123)
  expect(execute.mock.calls.every(([, args]) => args[0] === '--tokenstore' && args[1] === '/fake/tokens')).toBe(true)
  await expect(access(stagePath)).rejects.toThrow()
})
