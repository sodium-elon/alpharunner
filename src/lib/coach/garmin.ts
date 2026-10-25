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
export type GarminEvidence = {
  activity: GarminStagedActivity
  details: Record<string, unknown>
  context: { calendar: Record<string, unknown>[]; readiness: unknown; sleep: unknown; errors: string[] }
}

// A fixed, bounded data-fetch workflow. No generated scripts, shell commands,
// retired MCP, or model-selected Garmin endpoints.
export class GarminGateway {
  constructor(private readonly options: { executable: string; tokenStore: string; envFile?: string; execute?: GarminExecutor }) {}

  private async run(args: string[]): Promise<string> {
    try { return await (this.options.execute ?? defaultExecute)(this.options.executable, ['--tokenstore', this.options.tokenStore, ...(this.options.envFile ? ['--env-file', this.options.envFile] : []), ...args]) }
    catch (error) {
      // Never retain the original error/cause: execFile errors include argv,
      // private stdout/stderr and sometimes credentials. Only bounded metadata.
      const failure = error && typeof error === 'object' ? error as { code?: unknown; signal?: unknown; killed?: unknown } : {}
      const metadata: string[] = []
      if (typeof failure.code === 'number' && Number.isInteger(failure.code) && failure.code >= 0 && failure.code <= 255) metadata.push(`exit=${failure.code}`)
      else if (typeof failure.code === 'string' && ['ENOENT', 'EACCES', 'EPERM', 'EIO', 'ENOMEM', 'EAGAIN', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'ABORT_ERR'].includes(failure.code)) metadata.push(`error=${failure.code}`)
      if (typeof failure.signal === 'string' && ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGHUP', 'SIGSEGV', 'SIGPIPE', 'SIGQUIT', 'SIGALRM'].includes(failure.signal)) metadata.push(`signal=${failure.signal}`)
      if (failure.killed === true) metadata.push('killed=true')
      throw new Error(`Garmin command failed: ${args.slice(0, 2).join(' ')} (${metadata.join(' ') || 'error=unknown'})`)
    }
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
    const candidates = new Map<string, Record<string, unknown>>()
    for (let start = 0; ; start += 100) {
      const items = await this.json(['activities', 'list', '--start-date', date, '--end-date', date, '--activity-type', 'running', '--limit', '100', '--start', String(start)])
      if (!Array.isArray(items)) throw new Error('Garmin activity list is invalid')
      for (const item of items) {
        if (item && String(item.startTimeLocal).slice(0, 10) === date && /^[1-9]\d*$/.test(String(item.activityId))) candidates.set(String(item.activityId), item)
      }
      if (items.length < 100) break
      if (start === 900) throw new Error('Garmin activity search exceeded its bounded page limit')
    }
    // Activity titles are user-defined; verify the sport from Garmin's detail.
    // Keep the same running types supported by the transactional importer.
    const checked = await Promise.all([...candidates.values()].map(async item => {
      const activityId = String(item.activityId)
      const detail = await this.json(['activities', 'get', activityId]) as { activityId?: number; activityTypeDTO?: { typeKey?: string }; summaryDTO?: { startTimeLocal?: string } }
      if (String(detail.activityId) !== activityId || detail.summaryDTO?.startTimeLocal?.slice(0, 10) !== date) throw new Error('Garmin activity identity or date changed')
      return ['running', 'treadmill_running'].includes(detail.activityTypeDTO?.typeKey ?? '')
        ? { activityId, date, title: String(item.activityName ?? '') } : null
    }))
    return checked.filter((item): item is { activityId: string; date: string; title: string } => item !== null)
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
    // Unsupported Personal API context is unknown, not an empty future plan.
    // Do not retry the retired fitness/calendar or training-readiness routes.
    const errors = ['calendar unavailable: Personal API does not support planned workouts', 'readiness unavailable: Personal API does not support training readiness']
    let sleep: unknown = null
    try { sleep = await this.json(['wellness', 'sleep', '--date', date]) }
    catch { errors.push('sleep') }
    return { calendar: [], readiness: null, sleep, errors }
  }
}
