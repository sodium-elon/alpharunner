import { expect, it } from 'vitest'
import { classifyRequest, REQUEST_ACTIONS, type RequestAction } from '../request'
import type { DecisionRunner } from '../jev-client'

it('does not send empty request text for semantic guessing', async () => {
  const runner: DecisionRunner = async () => { throw new Error('must not run') }
  expect(await classifyRequest('  ', runner)).toMatchObject({ action: 'other', needsReview: true, includesAnalysis: 0 })
})

it('batches action routing with independent analysis intent without authorizing actions or resolving dates', async () => {
  const runner: DecisionRunner = async request => {
    expect(request.state).toEqual({ text: 'Import yesterday and explain it' })
    expect(Object.keys(request.questions)).toEqual(['operation', 'includesAnalysis'])
    expect(request.questions.operation.instructions).toMatch(/authorization/)
    expect(request.questions.operation.instructions).toMatch(/date/)
    expect(request.questions.operation.type).toBe('choice')
    const q = request.questions.operation
    if (q.type !== 'choice') throw new Error('Expected Choice')
    const keys = Object.keys(q.criteria)
    expect(keys).toEqual(['import_run', 'correct_run_shoe', 'analyze_run', 'compare_runs', 'shoe_lookup', 'shoe_recommendation', 'recovery_review', 'other'])
    expect(q.criteria.correct_run_shoe).toMatch(/existing/)
    expect(q.criteria.correct_run_shoe).toMatch(/not.*reimport/i)
    return { model: 'test', answers: {
      operation: { type: 'choice', choice: 'import_run', confidence: 0.9, probabilities: Object.fromEntries(keys.map(k => [k, k === 'import_run' ? 1 : 0])) },
      includesAnalysis: { type: 'noul', noul: 0.95 },
    } }
  }
  expect(await classifyRequest('Import yesterday and explain it', runner)).toMatchObject({ action: 'import_run', includesAnalysis: 0.95, needsReview: false, probabilities: { import_run: 1 } })
})

function verdict(action: RequestAction, analysis: number, confidence = 1): DecisionRunner {
  return async () => ({ model: 'fixture', answers: {
    operation: { type: 'choice', choice: action, confidence, probabilities: Object.fromEntries(Object.keys(REQUEST_ACTIONS).map(k => [k, k === action ? 1 : 0])) },
    includesAnalysis: { type: 'noul', noul: analysis },
  } })
}

it.each([
  { action: 'analyze_run', raw: .77, expected: true },
  { action: 'compare_runs', raw: .79, expected: true },
  { action: 'shoe_recommendation', raw: .24, expected: false },
] as const)('ignores irrelevant analysis uncertainty on a decisive $action route', async ({action, raw, expected}) => {
  const result = await classifyRequest('Historic replay', verdict(action, raw))
  expect(result).toMatchObject({ action, needsReview: false, includesAnalysis: raw, analysisRequested: expected })
})

it('keeps uncertain import analysis separate from the recognized import action', async () => {
  expect(await classifyRequest('Import and maybe analyze', verdict('import_run', .5))).toMatchObject({
    action: 'import_run', includesAnalysis: .5, analysisRequested: null, needsReview: true,
  })
})

it('does not waive uncertain operation confidence when ignoring an auxiliary answer', async () => {
  expect(await classifyRequest('Unclear analysis', verdict('analyze_run', .77, .58))).toMatchObject({
    action: 'analyze_run', analysisRequested: true, needsReview: true,
  })
})

it('routes corrections without treating analysis uncertainty as correction authorization', async () => {
  expect(await classifyRequest('Correct the shoe; do not reimport', verdict('correct_run_shoe', .5))).toMatchObject({
    action: 'correct_run_shoe', analysisRequested: false, includesAnalysis: .5, needsReview: false,
  })
})
