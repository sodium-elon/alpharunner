import { expect, it } from 'vitest'
import { normalizeAnalysisContext } from '../analysis-brief'

it.each([undefined, null, -1, 101, Number.NaN])('does not present an invalid/missing wakeup score (%s) as recovery evidence', score => {
  const context = normalizeAnalysisContext('2026-10-03', {
    calendar: [], sleep: null, errors: [],
    readiness: [{ calendarDate: '2026-10-03', inputContext: 'AFTER_WAKEUP_RESET', score }],
  })
  expect(context.wakeupReadiness).toBeNull()
})

it.each([undefined, -1, Number.NaN])('does not present empty feedback/invalid sleep duration (%s) as recovery evidence', sleepTimeSeconds => {
  const context = normalizeAnalysisContext('2026-10-03', {
    calendar: [], readiness: [], errors: [],
    sleep: { dailySleepDTO: { calendarDate: '2026-10-03', sleepScoreFeedback: '', sleepTimeSeconds } },
  })
  expect(context.sleep).toBeNull()
})
