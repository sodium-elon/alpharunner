import { expect, it, vi } from 'vitest'
import { createCoachServices } from '../service'
import type { CoachEnvironment } from '../environment'
import type { GarminGateway } from '../garmin'
import type { DecisionRequest, DecisionResponse } from '../jev-client'

const environment = { stateRoot: '/unused', garminExecutable: '/unused', garminTokenStore: '/unused' } as CoachEnvironment
const activity = { listItem: { activityId: 123, activityName: 'Base' }, detail: { activityId: 123, summaryDTO: { startTimeLocal: '2026-10-03 10:00:00', startTimeGMT: '2026-10-03T10:00:00Z', distance: 1000, duration: 360 } }, splits: { lapDTOs: [{ distance: 500, duration: 180 }, { distance: 500, duration: 180 }] }, hrZones: [] }
const context = { calendar: [{ date: '2026-10-03', itemType: 'fbtAdaptiveWorkout', title: 'Base', workoutUuid: 'exact-plan' }], readiness: [], sleep: null, errors: [] }
function answer(request: DecisionRequest): DecisionResponse {
  return { model: 'fixture', answers: Object.fromEntries(Object.entries(request.questions).map(([key, q]) => {
    if (q.type === 'noul') return [key, { type: 'noul', noul: 0 }]
    if (q.type !== 'choice') throw new Error('Unexpected score')
    const selected = key === 'brief_focus' ? 'execution_consistency' : key === 'brief_comparator' ? 'none' : 'unknown'
    return [key, { type: 'choice', choice: selected, confidence: 1, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === selected ? 1 : 0])) }]
  })) }
}
async function analyze(overrides: { context?: typeof context; respond?: (r: DecisionRequest) => DecisionResponse; openRepository?: any; activity?: unknown } = {}) {
  const runner = vi.fn(async (request: DecisionRequest) => (overrides.respond ?? answer)(request))
  const gateway = { fetchActivity: vi.fn(async () => ({ activity: overrides.activity ?? activity, details: {}, context: overrides.context ?? context })) } as unknown as GarminGateway
  const services = createCoachServices(environment, { runner, gateway, openRepository: overrides.openRepository })
  const result = await services['analyze-run']!({ date: '2026-10-03', 'activity-id': '123', 'user-intent': 'easy base' }) as any
  return { result, runner, gateway }
}

it.each([false, true])('bounds same-date recovery evidence and gates unsupported recovery priorities (observed=%s)', async observed => {
  const recoveryContext = {
    ...context,
    readiness: [
      { calendarDate: '2026-10-03', inputContext: 'AFTER_EXERCISE', score: 1 },
      { calendarDate: '2026-10-02', inputContext: 'AFTER_WAKEUP_RESET', score: 1 },
      ...(observed ? [{ calendarDate: '2026-10-03', inputContext: 'AFTER_WAKEUP_RESET', score: 33, level: 'LOW', timestampLocal: '2026-10-03T07:00:00' }] : []),
    ],
    sleep: { dailySleepDTO: { calendarDate: observed ? '2026-10-03' : '2026-10-02', sleepTimeSeconds: 20000, sleepScoreFeedback: 'NON_RESTORATIVE' }, sleepMovement: Array(10000).fill('PRIVATE_TELEMETRY') },
  }
  const { result, runner } = await analyze({ context: recoveryContext as any, respond: request => {
    const response = answer(request)
    if (response.answers.brief_focus?.type === 'choice') {
      response.answers.brief_focus.choice = 'recovery_context'
      response.answers.brief_focus.probabilities = Object.fromEntries(Object.keys(response.answers.brief_focus.probabilities).map(k => [k, k === 'recovery_context' ? 1 : 0]))
    }
    if (response.answers.brief_recovery) response.answers.brief_recovery = { type: 'noul', noul: observed ? .93 : .05 }
    return response
  } })
  const state = runner.mock.calls[0][0].state as any
  expect(state.analysisContext.wakeupReadiness?.score ?? null).toBe(observed ? 33 : null)
  expect(state.analysisContext.sleep?.calendarDate ?? null).toBe(observed ? '2026-10-03' : null)
  expect(JSON.stringify(state)).not.toContain('PRIVATE_TELEMETRY')
  expect(result.analysisBrief.reviewRecovery).toBe(observed)
  expect(result.analysisBrief.rawPriority.choice).toBe('recovery_context')
  if (!observed) expect(result.analysisBrief.gaps).toContain('unsupported_recovery_priority')
})

it('uses current DB shoe identity and prior 7/14/28-day load, retaining two uncertain prior comparator sources', async () => {
  const current = { runId: 'current', activityId: '123', date: '2026-10-03', shoeId: 'corrected-shoe', brand: 'Qiaodan', model: 'Leili 2.0', activityType: 'running', paceSecPerKm: 360, workoutIntent: 'base' }
  const history = [
    { id: 'sept10', activityId: '10', date: '2026-09-10', shoeId: 'corrected-shoe', activityType: 'running', distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360, workoutIntent: 'base', powerSource: 'unknown' },
    { id: 'sept8', activityId: '8', date: '2026-09-08', shoeId: 'corrected-shoe', activityType: 'running', distanceKm: 4, durationSeconds: 1440, paceSecPerKm: 360, workoutIntent: 'base', powerSource: 'garmin' },
    { id: 'recent', activityId: '2', date: '2026-10-02', shoeId: 'other', activityType: 'running', distanceKm: 3, durationSeconds: 900, paceSecPerKm: 300, workoutIntent: 'tempo', powerSource: 'unknown' },
    { id: 'same-day', date: '2026-10-03', distanceKm: 50, activityType: 'running' },
    { id: 'future', date: '2026-10-04', distanceKm: 50, activityType: 'running' },
    { id: 'cycling', date: '2026-10-02', distanceKm: 50, activityType: 'cycling' },
  ]
  const unsafe = vi.fn(async (query: string) => query.includes('r.date=$1') ? [current] : history)
  const close = vi.fn(async () => {})
  const openRepository = vi.fn(() => ({ sql: { unsafe }, close }))
  const { result, runner } = await analyze({ openRepository, respond: request => {
    const response = answer(request)
    if (response.answers.brief_comparator) response.answers.brief_comparator = { type: 'choice', choice: 'candidate0', confidence: .41, probabilities: { candidate0: .56, candidate1: .32, candidate2: .1, none: .02 } }
    return response
  } })
  expect(result.analysisBrief.currentRun).toMatchObject({ status: 'found', run: current })
  expect(result.analysisBrief.priorLoad['7']).toMatchObject({ runs: 1, distanceKm: 3, sourceRunIds: ['recent'] })
  expect(result.analysisBrief.priorLoad['14'].distanceKm).toBe(3)
  expect(result.analysisBrief.priorLoad['28'].distanceKm).toBe(12)
  expect(result.analysisBrief.comparatorsToOpen.map((c: any) => c.id)).toEqual(['sept10', 'sept8'])
  expect(JSON.stringify(runner.mock.calls[0][0].state)).not.toMatch(/same-day|future|cycling/)
  expect(openRepository).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledTimes(1)
  expect(unsafe).toHaveBeenCalledTimes(2)
  expect(unsafe.mock.calls.every(([q]) => q.startsWith('SELECT'))).toBe(true)
})

it.each(['failure', 'missing'])('preserves descriptive analysis when optional repository context is %s', async kind => {
  const close = vi.fn(async () => {})
  const unsafe = vi.fn(async () => { if (kind === 'failure') throw new Error('PRIVATE_DATABASE_ERROR'); return [] })
  const { result, runner } = await analyze({ openRepository: () => ({ sql: { unsafe }, close }) })
  expect(result.judgments).toHaveProperty('effort')
  expect(result.analysisBrief.currentRun.status).toBe(kind === 'failure' ? 'unavailable' : 'not_found')
  expect(result.analysisBrief.comparatorsToOpen).toEqual([])
  expect(result.analysisBrief.priorLoad['28'].status).toBe(kind === 'failure' ? 'unavailable' : 'available')
  expect(result.analysisBrief.gaps).toContain('stored_shoe_identity_unavailable')
  expect(JSON.stringify(result)).not.toContain('PRIVATE_DATABASE_ERROR')
  expect(runner).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledTimes(1)
})

it('always retains the domain source floor and exact worn-shoe reference independently of optional rankings', async () => {
  const current = { runId: 'current', activityId: '123', date: '2026-10-03', shoeId: 'worn', brand: 'Qiaodan', model: 'Leili 2.0' }
  const { result, runner } = await analyze({ openRepository: () => ({ sql: { unsafe: vi.fn(async (q: string) => q.includes('r.date=$1') ? [current] : []) }, close: vi.fn(async () => {}) }) })
  expect(result.analysisBrief.mandatorySources.map((s: any) => s.path.split('/').at(-1))).toEqual(expect.arrayContaining(['legacy-workflow.md', 'john-shoe-rotation.md', 'shoe-rotation-evidence.md', 'garmin-single-run-analysis.md', 'qiaodan-leili-2.md']))
  expect(result.analysisBrief.mandatorySources.every((s: any) => s.status === 'available')).toBe(true)
  expect(result.analysisBrief.optionalSources).toEqual([])
  expect(runner.mock.calls[0][0].questions).toHaveProperty('brief_ref_sprint-session-recognition')
  expect(result.analysisBrief.gaps).toContain('historical_power_requires_source_validation')
})

it('delivers a source-linked analysis brief through analyze-run in the existing workout decision batch', async () => {
  const { result, runner, gateway } = await analyze()
  expect(result.analysisBrief).toMatchObject({ status: 'brief_ready', priority: 'data_validation', mode: 'read_only' })
  expect(result.judgments).toHaveProperty('effort')
  expect(runner).toHaveBeenCalledTimes(1)
  expect(gateway.fetchActivity).toHaveBeenCalledTimes(1)
  expect(runner.mock.calls[0][0].questions).toHaveProperty('effort')
  expect(runner.mock.calls[0][0].questions).toHaveProperty('brief_focus')
  expect(runner.mock.calls[0][0].state).toMatchObject({ userIntent: 'easy base', plan: context.calendar })
})
