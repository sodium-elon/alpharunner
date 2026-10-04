import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { GarminStagedActivity } from '../../../scripts/garmin/types'

const executeFile = promisify(execFile)
export type GarminExecutor = (executable: string, args: string[]) => Promise<string>
const defaultExecute: GarminExecutor = async (executable, args) => {
  const { stdout } = await executeFile(executable, args, { timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
  return stdout
}
export interface GarminEvidence {
  activity: GarminStagedActivity
  details: Record<string, unknown>
  context: { calendar: Record<string, unknown>[]; readiness: unknown; sleep: unknown; errors: string[] }
}

// A fixed, bounded data-fetch workflow. No generated scripts, shell commands,
// retired MCP, or model-selected Garmin endpoints.
export class GarminGateway {
  constructor(private readonly options: { executable: string; tokenStore: string; execute?: GarminExecutor }) {}

  private async run(args: string[]): Promise<string> {
    try { return await (this.options.execute ?? defaultExecute)(this.options.executable, ['--tokenstore', this.options.tokenStore, ...args]) }
    catch { throw new Error(`Garmin command failed: ${args.slice(0, 2).join(' ')}`) }
  }
  private async json(args: string[]): Promise<unknown> {
    try { return JSON.parse(await this.run(args)) }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('Garmin command failed:')) throw error
      throw new Error(`Garmin returned invalid JSON: ${args.slice(0, 2).join(' ')}`)
    }
  }

  async findActivities(date: string): Promise<Array<{ activityId: string; date: string; title: string }>> {
    z.iso.date().parse(date)
    const auth = await this.json(['auth', 'check']) as { status?: string; profile?: unknown }
    if (auth.status !== 'ok' || !auth.profile) throw new Error('Garmin authentication is not valid')
    const day = new Date(`${date}T00:00:00Z`)
    const calendar = await this.json(['fitness', 'calendar', String(day.getUTCFullYear()), String(day.getUTCMonth())])
    const items = calendar && typeof calendar === 'object' && Array.isArray((calendar as { calendarItems?: unknown }).calendarItems) ? (calendar as { calendarItems: Record<string, unknown>[] }).calendarItems : []
    return items.filter(item => item.itemType === 'activity' && String(item.date).slice(0, 10) === date && /^[1-9]\d*$/.test(String(item.id))).map(item => ({ activityId: String(item.id), date, title: String(item.title ?? '') }))
  }
  async fetchActivity(activityId: string, expectedDate: string): Promise<GarminEvidence> {
    if (!/^\d+$/.test(activityId)) throw new Error('A numeric Garmin activity ID is required')
    z.iso.date().parse(expectedDate)
    const auth = await this.json(['auth', 'check']) as { status?: string; profile?: unknown }
    if (auth.status !== 'ok' || !auth.profile) throw new Error('Garmin authentication is not valid; use the canonical auth recovery workflow')
    const detail = await this.json(['activities', 'get', activityId]) as { activityId?: number; summaryDTO?: { startTimeLocal?: string } }
    if (String(detail.activityId) !== activityId || detail.summaryDTO?.startTimeLocal?.slice(0, 10) !== expectedDate) throw new Error('Garmin activity ID and local date do not match the confirmed task')

    const root = await mkdtemp(join(tmpdir(), `coach-garmin-${activityId}-`)), stagedPath = join(root, 'stage.json')
    try {
      const [details] = await Promise.all([
        this.json(['activities', 'details', activityId]),
        this.run(['stage', '--activity', activityId, '--out', stagedPath]),
      ])
      const staged = JSON.parse(await readFile(stagedPath, 'utf8')) as { activities?: GarminStagedActivity[] }
      if (staged.activities?.length !== 1) throw new Error('Staging must contain exactly the requested activity')
      const activity = staged.activities[0]
      if (String(activity.listItem?.activityId) !== activityId || activity.listItem?.startTimeLocal?.slice(0, 10) !== expectedDate || activity.detail?.summaryDTO?.startTimeLocal?.slice(0, 10) !== expectedDate) throw new Error('Staged activity identity changed')
      if (!details || typeof details !== 'object' || Array.isArray(details) || String((details as Record<string, unknown>).activityId) !== activityId) throw new Error('Per-second details do not match the requested activity')
      return { activity, details: details as Record<string, unknown>, context: await this.fetchContext(expectedDate) }
    } finally { await rm(root, { recursive: true, force: true }) }
  }

  private async fetchContext(date: string): Promise<GarminEvidence['context']> {
    const day = new Date(`${date}T00:00:00Z`)
    const start = new Date(+day - 7 * 86400000), end = new Date(+day + 7 * 86400000)
    const months = new Map([start, day, end].map(d => [`${d.getUTCFullYear()}-${d.getUTCMonth()}`, d]))
    const errors: string[] = []
    const optional = async (name: string, args: string[]) => {
      try { return await this.json(args) }
      catch { errors.push(name); return null }
    }
    const [calendars, readiness, sleep] = await Promise.all([
      Promise.all([...months.values()].map(d => optional('calendar', ['fitness', 'calendar', String(d.getUTCFullYear()), String(d.getUTCMonth())]))),
      optional('readiness', ['fitness', 'training-readiness', '--date', date]),
      optional('sleep', ['wellness', 'sleep', '--date', date]),
    ])
    const calendar = calendars.flatMap(c => (c as { calendarItems?: Record<string, unknown>[] } | null)?.calendarItems ?? [])
      .filter(r => ['activity', 'fbtAdaptiveWorkout'].includes(String(r.itemType)) && String(r.date).slice(0, 10) >= start.toISOString().slice(0, 10) && String(r.date).slice(0, 10) <= end.toISOString().slice(0, 10))
      .map(r => Object.fromEntries(['date', 'title', 'itemType', 'id', 'trainingPlanId', 'workoutUuid', 'duration', 'distance'].map(k => [k, r[k]])))
    return { calendar, readiness, sleep, errors }
  }
}
