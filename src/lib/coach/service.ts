import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { CoachEnvironment } from './environment'
import { type CommandHandlers } from './commands'
import { createDecisionRunner, type DecisionRunner } from './jev-client'
import { classifyRequest } from './request'
import { resolveShoe, recommendShoes, type ShoeCandidate } from './shoes'
import { extractWorkoutFeatures, classifyWorkout } from './workout'
import { classifyUserNote } from './notes'
import { GarminGateway } from './garmin'
import { TaskStore } from './task-state'
import { createPostgresRepository, loadInventory, loadHistory, persistRun, type PostgresRepository, type PersistRunInput } from './repository'

export interface CoachDependencies {
  runner?: DecisionRunner
  gateway?: GarminGateway
  openRepository?: () => PostgresRepository
}

/** Fixed handlers: a classifier cannot call persistence or provide authorization. */
export function createCoachServices(environment: CoachEnvironment, dependencies: CoachDependencies = {}): CommandHandlers {
  const runner = dependencies.runner ?? createDecisionRunner({ apiKey: environment.apiKey, openRouterApiKey: environment.openRouterApiKey })
  const gateway = dependencies.gateway ?? new GarminGateway({ executable: environment.garminExecutable, tokenStore: environment.garminTokenStore })
  const store = new TaskStore(environment.stateRoot)
  async function withRepository<T>(work: (repository: PostgresRepository) => Promise<T>) {
    const repository = dependencies.openRepository?.() ?? createPostgresRepository(environment.databaseUrl ?? '')
    try { return await work(repository) } finally { await repository.close() }
  }
  async function candidates(): Promise<ShoeCandidate[]> {
    const aliases = await store.confirmedAliases()
    return withRepository(async repository => (await loadInventory(repository.sql)).map(shoe => ({
      ...shoe, aliases: aliases[shoe.id] ?? [], variant: shoe.variant ?? undefined,
      curatedMetadata: shoe.notes?.trim() ? { source: `AlphaRunner shoes/${shoe.id}`, construction: shoe.notes, intendedUse: `${shoe.role}; ${shoe.category ?? 'category not recorded'}` } : undefined,
    })))
  }
  async function analyze(activityId: string, date: string, userIntent?: string, userNote?: string) {
    const evidence = await gateway.fetchActivity(activityId, date)
    const features = extractWorkoutFeatures(evidence.activity, evidence.details)
    const plan = evidence.context.calendar.filter(item => item.date === date && ['workout','adaptiveWorkout'].includes(String(item.itemType)))
    const [judgments, note] = await Promise.all([
      classifyWorkout(features, runner, { userIntent, plan }),
      userNote ? classifyUserNote({ text: userNote, source: 'user', observedAt: date }, runner) : Promise.resolve(null),
    ])
    return { evidence, features, judgments, userNote: note }
  }
  return {
    route: options => classifyRequest(options.text, runner),
    inventory: async () => candidates(),
    'resolve-shoe': async options => resolveShoe(options.term, await candidates(), runner),
    'recommend-shoes': async options => {
      const [shoes, history] = await Promise.all([candidates(), withRepository(repository => loadHistory(repository.sql))])
      const pace = options.pace === undefined ? undefined : Number(options.pace)
      if (pace !== undefined && (!Number.isFinite(pace) || pace <= 0)) throw new Error('Pace must be positive seconds per kilometre')
      const source = options['power-source']
      if (source !== undefined && !['stryd', 'garmin', 'unknown'].includes(source)) throw new Error('Invalid power source')
      return recommendShoes({ request: options.purpose, surface: options.surface, paceRangeSecPerKm: pace === undefined ? undefined : [pace * .95, pace * 1.05], powerSource: source as 'stryd' | 'garmin' | 'unknown' | undefined,
        evidence: shoes.map(shoe => ({ shoeId: shoe.id, history: history.filter(row => row.shoeId === shoe.id).map(row => ({ runId: row.id, surface: row.surface ?? undefined, paceSecPerKm: row.paceSecPerKm, powerSource: row.powerSource, powerW: row.powerW ?? undefined, effort: row.effort ?? undefined, comfort: row.comfort })) })),
      }, shoes, runner)
    },
    'analyze-run': async options => {
      const { evidence, ...result } = await analyze(options['activity-id'], options.date, options['user-intent'], options.note)
      return { ...result, context: evidence.context, mode: 'read_only' }
    },
    note: options => classifyUserNote({ text: options.text, source: options.source as 'user' | 'coach' | 'history' }, runner),
    prepare: async options => {
      const [activities, shoes] = await Promise.all([options['activity-id'] ? Promise.resolve([{ activityId: options['activity-id'], date: options.date, title: '' }]) : gateway.findActivities(options.date), candidates()])
      const shoe = await resolveShoe(options.term, shoes, runner)
      if (activities.length !== 1 || shoe.status !== 'matched' || !shoe.shoeId) return { status: 'needs_clarification', activities, shoe }
      const task = await store.create({ date: options.date, activityId: activities[0].activityId, shoeId: shoe.shoeId, shoeTerm: options.term, userRequest: options['user-request'] })
      return { status: 'awaiting_confirmation', task, shoe, confirmationDeadlineMs: task.createdAt + 30000, note: 'Confirm only from an actual user message; selection is not proof of the worn shoe.' }
    },
    'task-create': options => store.create({ date: options.date, activityId: options['activity-id'], shoeId: options['shoe-id'], userRequest: options['user-request'] }),
    'task-show': options => store.read(options['task-id']),
    'task-confirm': async options => {
      if (options.answer === 'no') return store.cancel(options['task-id'])
      const task = await store.read(options['task-id'])
      return store.confirm(task.id, { answer: 'yes', sourceMessageId: options['source-message-id'], expected: { date: options.date, activityId: options['activity-id'], shoeId: options['shoe-id'], userRequest: task.userRequest } })
    },
    'import-task': async options => {
      const task = await store.read(options['task-id'])
      if (task.status !== 'confirmed' || !task.authorization) throw new Error('An actual user confirmation is required before importing')
      const coaching = JSON.parse(await readFile(options['coaching-file'], 'utf8')) as Pick<PersistRunInput, 'coaching' | 'shoeObservation' | 'userNote'> & {taskId:string}
      if (coaching?.taskId !== task.id) throw new Error('Coaching scope does not match this confirmed task')
      if (!coaching.coaching || typeof coaching.coaching !== 'object') throw new Error('A complete coaching object is required; no placeholder notes')
      const evidence = await gateway.fetchActivity(task.activityId, task.date)
      const features = extractWorkoutFeatures(evidence.activity, evidence.details)
      const claimed = await store.claim(task.id)
      const claimToken = z.string().min(1).parse(claimed.claimToken)
      try {
        const result = await withRepository(repository => persistRun({
          activity: evidence.activity, expectedDate: task.date, expectedActivityId: task.activityId, shoeId: task.shoeId,
          power: { source: z.enum(['stryd', 'garmin', 'unavailable']).parse(features.power.source), averageW: features.power.meanW, maxW: features.power.maxW,
            laps: features.laps.map(l => ({lapIndex:l.index,averageW:l.powerW,maxW:l.maxPowerW})),
            provenance: `source=${features.power.source}; validSamples=${features.power.sampleCount}; coverage=${features.power.coverage}; ${features.power.unitInferred ? 'watts inferred from validated provider samples' : 'reported watts'}` },
          coaching: coaching.coaching, shoeObservation: coaching.shoeObservation, userNote: coaching.userNote,
        }, repository))
        await store.complete(task.id, claimToken, { ...result })
        return result
      } catch (error) {
        await store.fail(task.id, claimToken, { message: 'Import failed; inspect the reported error before retrying' })
        throw error
      }
    },
  }
}
