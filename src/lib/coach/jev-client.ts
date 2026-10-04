export type DecisionQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'score'; instructions: string; criteria: string[] }
export type DecisionRequest = { state: unknown; questions: Record<string, DecisionQuestion>; model?: string }
export type ChoiceAnswer = { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
export type NoulAnswer = { type: 'noul'; noul: number }
export type ScoreAnswer = { type: 'score'; score: number; confidence: number; probabilities: Record<string, number>; legend?: Record<string, string> }
export type DecisionAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer
export type DecisionResponse = { model: string; answers: Record<string, DecisionAnswer>; usage?: { input_tokens: number; output_tokens: number } }
export type DecisionRunner = (request: DecisionRequest) => Promise<DecisionResponse>
export type DecisionRunnerOptions = { apiKey?: string; openRouterApiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number; model?: string }

function validateResponse(raw: unknown, request: DecisionRequest): DecisionResponse {
  if (!object(raw) || !object(raw.answers)) invalid()
  const response = raw as DecisionResponse
  for (const [key, q] of Object.entries(request.questions)) {
    if (q.type === 'choice') choiceAnswer(response, key, Object.keys(q.criteria))
    else if (q.type === 'noul') noulAnswer(response, key)
    else scoreAnswer(response, key, q.criteria.length)
  }
  return response
}

export function createDecisionRunner(options: DecisionRunnerOptions = {}): DecisionRunner {
  const timeoutMs = options.timeoutMs ?? 10000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new Error('Invalid decision timeout')
  return async request => {
    const controller = new AbortController()
    const deadline = Date.now() + timeoutMs
    let timer: ReturnType<typeof setTimeout> | undefined
    const outage = () => new Error('TypeSafe API (Jev) is unavailable')
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(outage()) }, timeoutMs)
    })
    const post = async (url: string, key: string, model: string) => {
      const res = await (options.fetchImpl ?? fetch)(url, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, model }), signal: controller.signal,
      })
      if (!res.ok) throw outage()
      return validateResponse(await res.json(), request)
    }
    const operation = async () => {
      try {
        const key = options.apiKey ?? process.env.TYPESAFE_API_KEY
        if (!key) throw outage()
        return await post('https://api.typesafe.ai/v1/systemone', key, request.model ?? options.model ?? 'jev-latest')
      } catch {
        const fallback = options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY
        if (!fallback || controller.signal.aborted || Date.now() >= deadline) throw outage()
        return post('https://openrouter.ai/api/alpha/decisions', fallback, 'typesafe/jev-1.13')
      }
    }
    try { return await Promise.race([operation(), expired]) }
    catch { throw outage() }
    finally { clearTimeout(timer) }
  }
}

function invalid(): never { throw new Error('Malformed TypeSafe decision response') }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function unit(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 }
function answer(response: DecisionResponse, key: string): Record<string, unknown> {
  if (!object(response) || typeof response.model !== 'string' || !response.model || !object(response.answers) || !Object.hasOwn(response.answers, key) || !object(response.answers[key])) invalid()
  return response.answers[key] as unknown as Record<string, unknown>
}
function distribution(value: unknown, keys: string[]): Record<string, number> {
  if (!object(value) || new Set(keys).size !== keys.length || !keys.length || Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k) && unit(value[k]))) invalid()
  const probabilities = value as Record<string, number>
  if (Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) > 0.001) invalid()
  return probabilities
}
export function choiceAnswer(response: DecisionResponse, key: string, allowed: string[]): ChoiceAnswer {
  const a = answer(response, key)
  if (a.type !== 'choice' || typeof a.choice !== 'string' || !allowed.includes(a.choice) || !unit(a.confidence)) invalid()
  const probabilities = distribution(a.probabilities, allowed)
  if (probabilities[a.choice] + 0.000001 < Math.max(...Object.values(probabilities))) invalid()
  return a as unknown as ChoiceAnswer
}
export function noulAnswer(response: DecisionResponse, key: string): NoulAnswer {
  const a = answer(response, key)
  if (a.type !== 'noul' || !unit(a.noul)) invalid()
  return a as unknown as NoulAnswer
}
export function scoreAnswer(response: DecisionResponse, key: string, levels: number): ScoreAnswer {
  if (!Number.isInteger(levels) || levels < 2 || levels > 10) invalid()
  const a = answer(response, key)
  const keys = Array.from({ length: levels }, (_, i) => String(i))
  if (a.type !== 'score' || !unit(a.confidence) || typeof a.score !== 'number' || !Number.isFinite(a.score) || a.score < 0 || a.score > levels - 1) invalid()
  const probabilities = distribution(a.probabilities, keys)
  if (Math.abs(keys.reduce((sum, k) => sum + Number(k) * probabilities[k], 0) - a.score) > 0.01 + Number.EPSILON * 10) invalid()
  if (a.legend !== undefined && (!object(a.legend) || Object.keys(a.legend).length !== levels || !keys.every(k => Object.hasOwn(a.legend as object, k) && typeof (a.legend as Record<string, unknown>)[k] === 'string'))) invalid()
  return a as unknown as ScoreAnswer
}
