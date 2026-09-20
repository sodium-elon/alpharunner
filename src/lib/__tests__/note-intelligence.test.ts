import { describe, expect, it, vi } from 'vitest'
import {
  analyzeRunNote,
  buildNoteIntelligenceRequest,
  INJURY_RISK_THRESHOLD,
  NOTE_INTELLIGENCE_ENDPOINT,
  OPENROUTER_DECISIONS_ENDPOINT,
  parseNoteIntelligence,
} from '../note-intelligence'

describe('buildNoteIntelligenceRequest', () => {
  it('builds a single parallel TypeSafe request with the note as state', () => {
    const req = buildNoteIntelligenceRequest('Felt flat on the tempo kms, quads tight, still enjoyed it')

    expect(req.state).toBe('Felt flat on the tempo kms, quads tight, still enjoyed it')
    expect(req.model).toBe('jev-latest')

    expect(req.questions.runType.type).toBe('choice')
    expect(req.questions.injuryRisk.type).toBe('noul')
    expect(req.questions.enjoyment.type).toBe('score')

    // Choice criteria enumerate the documented run types plus a no-match escape hatch.
    const runTypeCriteria = Object.keys(req.questions.runType.criteria)
    for (const expected of ['easy', 'steady', 'tempo', 'long', 'recovery', 'race', 'unknown']) {
      expect(runTypeCriteria).toContain(expected)
    }
  })

  it('keeps each question narrow: instruction is the prompt, criteria define the answers', () => {
    const req = buildNoteIntelligenceRequest('great run')

    expect(req.questions.injuryRisk.instructions).toBeTruthy()
    expect(typeof req.questions.injuryRisk.criteria.true).toBe('string')
    expect(typeof req.questions.injuryRisk.criteria.false).toBe('string')

    // Score has ordered levels, not a key map.
    expect(Array.isArray(req.questions.enjoyment.criteria)).toBe(true)
    expect(req.questions.enjoyment.criteria).toHaveLength(3)
  })
})

describe('parseNoteIntelligence', () => {
  it('flags injury risk when the noul probability clears the threshold', () => {
    const parsed = parseNoteIntelligence({
      model: 'jev-1.13.0',
      answers: {
        runType: { type: 'choice', choice: 'tempo', probabilities: { easy: 0, steady: 0.1, tempo: 0.9 }, confidence: 0.8 },
        injuryRisk: { type: 'noul', noul: 0.87 },
        enjoyment: { type: 'score', score: 2.0, legend: { 0: 'Negative', 1: 'Neutral', 2: 'Positive' }, probabilities: { 0: 0, 1: 0, 2: 1.0 }, confidence: 1.0 },
      },
    })

    expect(parsed.runType).toBe('tempo')
    expect(parsed.injuryRisk).toBe(0.87)
    expect(parsed.injuryRiskFlag).toBe(true)
    expect(parsed.injuryRisk).toBeGreaterThanOrEqual(INJURY_RISK_THRESHOLD)
  })

  it('does not flag injury risk below the threshold', () => {
    const parsed = parseNoteIntelligence({
      model: 'jev-1.13.0',
      answers: {
        runType: { type: 'choice', choice: 'easy', probabilities: { easy: 0.7 }, confidence: 0.6 },
        injuryRisk: { type: 'noul', noul: 0.2 },
        enjoyment: { type: 'score', score: 1.5, legend: { 0: 'Negative', 1: 'Neutral', 2: 'Positive' }, probabilities: { 0: 0, 1: 0.5, 2: 0.5 }, confidence: 0.6 },
      },
    })

    expect(parsed.injuryRiskFlag).toBe(false)
  })

  it('maps enjoyment score onto the ordered 0..2 scale and keeps the outcome', () => {
    const parsed = parseNoteIntelligence({
      model: 'jev-1.13.0',
      answers: {
        runType: { type: 'choice', choice: 'long', probabilities: { long: 0.95 }, confidence: 0.9 },
        injuryRisk: { type: 'noul', noul: 0.1 },
        enjoyment: { type: 'score', score: 2.0, legend: { 0: 'Negative', 1: 'Neutral', 2: 'Positive' }, probabilities: { 0: 0, 1: 0, 2: 1.0 }, confidence: 0.9 },
      },
    })

    expect(parsed.enjoyment).toBe(2.0)
    expect(parsed.enjoyment).toBeGreaterThanOrEqual(0)
    expect(parsed.enjoyment).toBeLessThanOrEqual(2)
  })
})

describe('analyzeRunNote', () => {
  const buildResponse = () => ({
    model: 'jev-1.13.0',
    answers: {
      runType: { type: 'choice', choice: 'tempo', probabilities: { tempo: 0.9 }, confidence: 0.8 },
      injuryRisk: { type: 'noul', noul: 0.4 },
      enjoyment: { type: 'score', score: 1.2, legend: { 0: 'Negative', 1: 'Neutral', 2: 'Positive' }, probabilities: { 1: 0.8, 2: 0.2 }, confidence: 0.7 },
    },
    usage: { input_tokens: 454, output_tokens: 73 },
  })

  const okFetch = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(buildResponse()), { status: 200 }))
  const unauthorizedFetch = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  )

  it('posts the built request to the TypeSafe endpoint with the key and returns parsed judgments', async () => {
    const result = await analyzeRunNote('tempo kms, felt fair', {
      apiKey: 'test-key',
      fetchImpl: okFetch,
    })

    expect(okFetch).toHaveBeenCalledTimes(1)
    const [url, init] = okFetch.mock.calls[0]
    expect(url).toBe(NOTE_INTELLIGENCE_ENDPOINT)
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key')

    // The request body round-trips through the real builder.
    const sentBody = JSON.parse(init?.body as string)
    expect(sentBody.questions).toEqual(
      buildNoteIntelligenceRequest('tempo kms, felt fair').questions
    )

    expect(result.runType).toBe('tempo')
    expect(result.injuryRisk).toBe(0.4)
    expect(result.injuryRiskFlag).toBe(false)
  })

  it('defaults the key from the environment when none is passed', async () => {
    const previous = process.env.TYPESAFE_API_KEY
    process.env.TYPESAFE_API_KEY = 'env-key'
    try {
      okFetch.mockClear()
      await analyzeRunNote('chill run', { fetchImpl: okFetch })
      const [, init] = okFetch.mock.calls[0]
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer env-key')
    } finally {
      process.env.TYPESAFE_API_KEY = previous
    }
  })

  it('throws a clear error when the API rejects the request', async () => {
    const err = await analyzeRunNote('anything', { apiKey: 'bad', fetchImpl: unauthorizedFetch }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(String(err)).toMatch(/401/)
  })

  it('falls back to OpenRouter once when the primary endpoint fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))                       // primary fails
      .mockResolvedValueOnce(new Response(JSON.stringify(buildResponse()), { status: 200 })) // openrouter succeeds

    const result = await analyzeRunNote('note with pain', {
      apiKey: 'primary-key',
      openRouterApiKey: 'or-key',
      fetchImpl,
    })

    expect(result.runType).toBe('tempo')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url1, init1] = fetchImpl.mock.calls[0]
    const [url2, init2] = fetchImpl.mock.calls[1]
    expect(url1).toBe(NOTE_INTELLIGENCE_ENDPOINT)
    expect(url2).toBe(OPENROUTER_DECISIONS_ENDPOINT)
    expect(JSON.parse((init2?.body as string)).model).toBe('typesafe/jev-1.13')
    expect((init2?.headers as Record<string, string>).Authorization).toBe('Bearer or-key')
  })

  it('does not fall back when OPENROUTER_API_KEY is absent', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))

    const err = await analyzeRunNote('note', { apiKey: 'primary-key', fetchImpl }).catch((e: unknown) => e)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(err)).toMatch(/500/)
  })

  it('propagates the error when the fallback also fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response('also boom', { status: 503 }))

    const err = await analyzeRunNote('note', { apiKey: 'k', openRouterApiKey: 'or', fetchImpl }).catch((e: unknown) => e)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(err)).toMatch(/503/)
  })
})