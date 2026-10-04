import { expect, it } from 'vitest'
import { recommendShoes, resolveShoe, type ShoeCandidate, type ShoeRecommendationInput } from '../shoes'
import type { DecisionRunner } from '../jev-client'

const candidates: ShoeCandidate[] = [
  { id: 'ultra', brand: 'Li Ning', model: 'Red Hare 9', variant: 'Ultra', aliases: ['red rabbit ultra'] },
  { id: 'pro', brand: 'Li Ning', model: 'Red Hare 9', variant: 'Pro' },
  { id: 'kinvara', brand: 'Saucony', model: 'Kinvara 16' },
]
const unused: DecisionRunner = async () => { throw new Error('must not run') }
const evidenced: ShoeCandidate[] = candidates.slice(0, 2).map(s => ({ ...s, status: 'active', surfaces: ['road'], curatedMetadata: { source: 'db:dossier:verified', construction: 'Unplated cushioned trainer', intendedUse: 'easy road runs' } }))
const score = (level: number) => ({ type: 'score' as const, score: level, confidence: 0.9, probabilities: Object.fromEntries([0, 1, 2, 3].map(i => [String(i), i === level ? 1 : 0])) })
const input: ShoeRecommendationInput = { request: 'easy road run', surface: 'road', paceRangeSecPerKm: [300, 400], powerSource: 'stryd', evidence: [
  { shoeId: 'ultra', history: [
    { runId: 'matched', surface: 'road', paceSecPerKm: 350, powerSource: 'stryd', comfort: null },
    { runId: 'wrong-surface', surface: 'treadmill', paceSecPerKm: 350, powerSource: 'stryd', comfort: 10 },
    { runId: 'wrong-pace', surface: 'road', paceSecPerKm: 250, powerSource: 'stryd', comfort: 10 },
    { runId: 'wrong-source', surface: 'road', paceSecPerKm: 350, powerSource: 'garmin', comfort: 10 },
  ] },
] }

it('excludes inactive, unresearchable, and surface-incompatible candidates before calling Jev', async () => {
  const pool = [
    { ...evidenced[0], id: 'retired', status: 'retired' },
    { ...evidenced[0], id: 'inactive', status: 'inactive' },
    { ...evidenced[0], id: 'new', status: 'new', researchable: false },
    { ...evidenced[0], id: 'trail', surfaces: ['trail'] },
    { ...evidenced[0], id: 'no-dossier', curatedMetadata: undefined },
  ]
  const result = await recommendShoes(input, pool, unused)
  expect(result.ranked).toEqual([])
  expect(result.excluded.map(r => r.shoeId)).toEqual(['retired', 'inactive', 'new', 'trail'])
  expect(result.insufficientEvidence).toEqual([{ shoeId: 'no-dossier', reason: 'missing_curated_metadata' }])
})

it('ranks candidate-local parallel judgments grounded only in curated metadata and condition-matched observations', async () => {
  const states: unknown[] = []
  const runner: DecisionRunner = async request => {
    states.push(request.state)
    await Promise.resolve()
    expect(states).toHaveLength(2)
    expect(Object.keys(request.questions)).toEqual(['suitability', 'evidenceStrength', 'contraindication', 'requestMismatch'])
    expect(request.questions.suitability.instructions).toMatch(/causal/)
    return { model: 'test', answers: { suitability: score(3), evidenceStrength: score(2), contraindication: { type: 'noul', noul: 0.01 }, requestMismatch: { type: 'noul', noul: 0.01 } } }
  }
  const result = await recommendShoes(input, evidenced, runner)
  expect(result.ranked.map(r => r.shoeId)).toEqual(['ultra', 'pro'])
  expect(states[0]).toMatchObject({ shoe: { id: 'ultra' }, evidence: { matchedHistory: [{ runId: 'matched' }], summary: { matchedRuns: 1, comfortObservations: 0, meanComfort: null } } })
  expect(JSON.stringify(states[0])).not.toMatch(/wrong-surface|wrong-pace|wrong-source/)
  expect(result.ranked[0]).toMatchObject({ suitability: { score: 3 }, evidenceStrength: { score: 2 } })
  expect(result.limitations.join(' ')).toMatch(/physiological probability/)
})

it('offers the real inventory for a garbled brand instead of rejecting it lexically', async () => {
  const pool = [{ id: 'leili', brand: 'Qiaodan', model: 'Leili 2.0' }]
  const runner: DecisionRunner = async request => {
    expect(request.state).toMatchObject({ candidates: pool })
    return { model: 'test', answers: { shoe: { type: 'choice', choice: 'leili', confidence: .99, probabilities: { leili: .99, none: .005, unknown: .005 } } } }
  }
  expect(await resolveShoe('kjordan', pool, runner)).toMatchObject({ status: 'matched', shoeId: 'leili', source: 'jev' })
})
it('does not recommend a candidate with a strongly evidenced conflict', async () => {
  const runner: DecisionRunner = async () => ({ model: 'test', answers: { suitability: score(3), evidenceStrength: score(3), contraindication: {type:'noul',noul:.99}, requestMismatch:{type:'noul',noul:.01} } })
  const result = await recommendShoes(input, evidenced, runner)
  expect(result.ranked).toEqual([])
  expect(result.excluded).toHaveLength(2)
})
it('blocks explicit known variant conflicts and invalid duplicate inventory IDs before inference', async () => {
  const poisoned = [{ ...candidates[0], aliases: ['Red Hare 9 Pro'] }]
  expect(await resolveShoe('Red Hare 9 Pro', poisoned, unused)).toMatchObject({ status: 'no_match', shoeId: null, uncertainty: 'explicit_variant_conflict' })
  expect(await resolveShoe('Kinvara 16', [candidates[2], candidates[2]], unused)).toMatchObject({ status: 'clarify', shoeId: null, uncertainty: 'invalid_candidate_pool' })
})

it('offers every relevant actual variant plus none and unknown and requires a decisive margin', async () => {
  const run = (choice: string, probabilities: Record<string, number>, confidence = 0.95): DecisionRunner => async request => {
    const q = request.questions.shoe
    if (q.type !== 'choice') throw new Error('expected choice')
    expect(Object.keys(q.criteria)).toEqual(['ultra', 'pro', 'none', 'unknown'])
    expect(request.state).toMatchObject({ term: 'Red Hare 9' })
    return { model: 'test', answers: { shoe: { type: 'choice', choice, confidence, probabilities } } }
  }
  expect(await resolveShoe('Red Hare 9', candidates, run('ultra', { ultra: 0.92, pro: 0.04, none: 0.02, unknown: 0.02 }))).toMatchObject({ status: 'matched', shoeId: 'ultra', source: 'jev', candidateIds: ['ultra', 'pro'] })
  expect(await resolveShoe('Red Hare 9', candidates, run('ultra', { ultra: 0.49, pro: 0.48, none: 0.01, unknown: 0.02 }))).toMatchObject({ status: 'clarify', shoeId: null })
  expect(await resolveShoe('Red Hare 9', candidates, run('none', { ultra: 0, pro: 0, none: 1, unknown: 0 }))).toMatchObject({ status: 'no_match', shoeId: null })
  expect(await resolveShoe('Red Hare 9', candidates, run('unknown', { ultra: 0, pro: 0, none: 0, unknown: 1 }))).toMatchObject({ status: 'clarify', shoeId: null })
  await expect(resolveShoe('Red Hare 9', candidates, unused, { minConfidence: NaN })).rejects.toThrow('Invalid identity thresholds')
})

it('resolves exact names, unique model and brand shorthands, and confirmed aliases preserving provenance', async () => {
  for (const [term, shoeId, source] of [[' Li Ning Red Hare 9 Ultra ', 'ultra', 'exact'], ['Kinvara 16', 'kinvara', 'exact'], ['Saucony', 'kinvara', 'exact'], ['red rabbit ultra', 'ultra', 'alias']]) {
    expect(await resolveShoe(term, candidates, unused)).toMatchObject({ status: 'matched', shoeId, source, term, uncertainty: null })
  }
  for (const term of [null, '', 'unknown', 'which shoe did I wear?']) {
    expect(await resolveShoe(term, candidates, unused)).toMatchObject({ shoeId: null, status: 'no_match' })
  }
  expect(await resolveShoe('Red Hare 8 Ultra', candidates, unused)).toMatchObject({ status: 'no_match', shoeId: null, uncertainty: 'explicit_version_conflict' })
})
