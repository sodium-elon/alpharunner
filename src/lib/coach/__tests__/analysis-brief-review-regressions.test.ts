import { expect, it } from 'vitest'
import { briefQuestions, normalizeAnalysisContext, parseAnalysisBrief, summarizeAnalysisHistory, type AnalysisContext } from '../analysis-brief'
import type { DecisionResponse } from '../jev-client'
import type { AnalysisHistoryRun } from '../repository'
import { extractWorkoutFeatures } from '../workout'

const date = '2026-10-03'
const features = extractWorkoutFeatures({
  listItem: { activityId: 123 },
  detail: { summaryDTO: { startTimeLocal: `${date} 10:00:00`, distance: 1000, duration: 360 } },
}, { metricDescriptors: [{ key: 'directPower', metricsIndex: 0 }], activityDetailMetrics: [{ metrics: [200] }] })

function run(id: string, overrides: Partial<AnalysisHistoryRun> = {}): AnalysisHistoryRun {
  return { id, activityId: id, date: '2026-10-02', activityType: 'running', shoeId: 'shoe',
    distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360, workoutIntent: 'base',
    surface: null, powerW: null, powerSource: 'unknown', evidence: '', ...overrides }
}
function history(records: AnalysisHistoryRun[]) {
  return summarizeAnalysisHistory(features, { currentRun: { status: 'found', run: { shoeId: 'shoe', workoutIntent: 'base' } }, history: records, historyStatus: 'available' })
}

it.each(['Running', 'TREADMILL_RUNNING'])('accepts SQL-supported %s history in bounded load and comparator candidates', activityType => {
  const records = [run('recent', { activityType }), run('fortnight', { activityType, date: '2026-09-23' }), run('month', { activityType, date: '2026-09-10' })]
  const summary = history(records)
  expect(summary.priorLoad['7']).toEqual({ status: 'available', runs: 1, distanceKm: 5, durationSeconds: 1800, sourceRunIds: ['recent'] })
  expect(summary.priorLoad['14']).toEqual({ status: 'available', runs: 2, distanceKm: 10, durationSeconds: 3600, sourceRunIds: ['recent', 'fortnight'] })
  expect(summary.priorLoad['28']).toEqual({ status: 'available', runs: 3, distanceKm: 15, durationSeconds: 5400, sourceRunIds: ['recent', 'fortnight', 'month'] })
  expect(Object.values(summary.comparatorCandidates)).toMatchObject([
    { id: 'recent', activityType }, { id: 'fortnight', activityType }, { id: 'month', activityType },
  ])
})

it('retains non-running, date, finite and positive measurement history guards', () => {
  const excluded: Partial<AnalysisHistoryRun>[] = [
    { activityType: 'Cycling' }, { activityType: 'WALKING' }, { date }, { date: '2026-10-04' },
    { date: '2026-09-04' }, { date: 'invalid' }, { distanceKm: 0 }, { distanceKm: -1 },
    { distanceKm: Number.NaN }, { distanceKm: Infinity }, { durationSeconds: 0 },
    { durationSeconds: -1 }, { durationSeconds: Number.NaN }, { durationSeconds: Infinity },
  ]
  const summary = history([run('valid'), ...excluded.map((overrides, i) => run(`excluded-${i}`, overrides))])
  for (const days of ['7', '14', '28']) expect(summary.priorLoad[days]).toEqual({ status: 'available', runs: 1, distanceKm: 5, durationSeconds: 1800, sourceRunIds: ['valid'] })
  expect(Object.values(summary.comparatorCandidates)).toMatchObject([{ id: 'valid' }])
})

const invalidSleep = [
  null,
  { dailySleepDTO: { calendarDate: date } },
  ...[undefined, null, 0, -1, Number.NaN, Infinity, '20000'].map(sleepTimeSeconds => ({ dailySleepDTO: { calendarDate: date, sleepTimeSeconds, sleepScoreFeedback: '   ' } })),
  { dailySleepDTO: { calendarDate: date, sleepScoreFeedback: 123 } },
]
it.each(invalidSleep)('rejects metadata-only readiness and absent/invalid sleep despite forced high recovery Noul (%j)', sleep => {
  const context: AnalysisContext = {
    ...normalizeAnalysisContext(date, { calendar: [], readiness: [{ calendarDate: date, inputContext: 'AFTER_WAKEUP_RESET' }], sleep, errors: [] }),
    ...history([]), mandatorySources: [], referenceCandidates: {},
  }
  const questions = briefQuestions(context)
  const response: DecisionResponse = { model: 'fixture', answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => {
    if (question.type === 'noul') return [key, { type: 'noul', noul: .95 }]
    if (question.type !== 'choice') throw new Error('Unexpected score')
    const selected = key === 'brief_focus' ? 'recovery_context' : 'none'
    return [key, { type: 'choice', choice: selected, confidence: 1, probabilities: Object.fromEntries(Object.keys(question.criteria).map(choice => [choice, choice === selected ? 1 : 0])) }]
  })) }
  expect(features.confidenceGaps).toEqual([])
  expect(features.power.source).toBe('garmin')
  const brief = parseAnalysisBrief(features, response, context)
  expect(brief.normalizedEvidence.wakeupReadiness).toBeNull()
  expect(brief.normalizedEvidence.sleep).toBeNull()
  expect(brief.rawPriority.choice).toBe('recovery_context')
  expect(brief.pRecoveryReview).toBe(.95)
  expect(brief.reviewRecovery).toBe(false)
  expect(brief.priority).toBe('review_focus')
  expect(brief.gaps).toEqual(expect.arrayContaining(['wakeup_readiness_unavailable', 'same_date_sleep_unavailable', 'unsupported_recovery_priority']))
})
