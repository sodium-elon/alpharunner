import { writeFile, access } from 'node:fs/promises'
import { expect, it, vi } from 'vitest'
import { GarminGateway } from '../garmin'

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
