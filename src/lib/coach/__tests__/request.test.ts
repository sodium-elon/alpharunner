import { expect, it } from 'vitest'
import { classifyRequest } from '../request'
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
    expect(keys).toEqual(['import_run', 'analyze_run', 'compare_runs', 'shoe_lookup', 'shoe_recommendation', 'recovery_review', 'other'])
    return { model: 'test', answers: {
      operation: { type: 'choice', choice: 'import_run', confidence: 0.9, probabilities: Object.fromEntries(keys.map(k => [k, k === 'import_run' ? 1 : 0])) },
      includesAnalysis: { type: 'noul', noul: 0.95 },
    } }
  }
  expect(await classifyRequest('Import yesterday and explain it', runner)).toMatchObject({ action: 'import_run', includesAnalysis: 0.95, needsReview: false, probabilities: { import_run: 1 } })
})
