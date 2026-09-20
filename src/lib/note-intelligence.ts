// TypeSafe note intelligence for AlphaRunner.
// Free-text run notes in, typed Jev judgments out (run type, injury risk, enjoyment).
// Read https://docs.typesafe.ai/api.md before changing the request/answer shapes.

export const NOTE_INTELLIGENCE_MODEL = 'jev-latest'

export const RUN_TYPE_CRITERIA = {
  easy: 'Conversational effort, comfortable pace, no strain',
  steady: 'Sustained moderate effort, comfortably hard',
  tempo: 'Threshold-ish sustained effort, legs turning over fast',
  long: 'Extended distance run, length is the point',
  recovery: 'Very short/slow shakeout, barely working',
  race: 'Run hard at/near race conditions',
  unknown: 'Note does not make the run type clear',
} as const

export type RunType = keyof typeof RUN_TYPE_CRITERIA

export type NoteIntelligenceRequest = {
  state: string
  model: string
  questions: {
    runType: { type: 'choice'; instructions: string; criteria: typeof RUN_TYPE_CRITERIA }
    injuryRisk: {
      type: 'noul'
      instructions: string
      criteria: { true: string; false: string }
    }
    enjoyment: { type: 'score'; instructions: string; criteria: string[] }
  }
}

export function buildNoteIntelligenceRequest(note: string): NoteIntelligenceRequest {
  return {
    state: note,
    model: NOTE_INTELLIGENCE_MODEL,
    questions: {
      runType: {
        type: 'choice',
        instructions: 'What kind of run does this note describe?',
        criteria: RUN_TYPE_CRITERIA,
      },
      injuryRisk: {
        type: 'noul',
        instructions: 'Does this note mention pain, tightness, discomfort, or any sign that could indicate injury risk?',
        criteria: {
          true: 'Mentions pain, sharp tightness, discomfort, or a body part acting up',
          false: 'No pain or discomfort described',
        },
      },
      enjoyment: {
        type: 'score',
        instructions: 'How positive was the runner\u2019s experience of this run?',
        criteria: ['Negative', 'Neutral', 'Positive'],
      },
    },
  }
}

export const INJURY_RISK_THRESHOLD = 0.6

export interface NoteIntelligenceResult {
  runType: RunType
  injuryRisk: number
  injuryRiskFlag: boolean
  enjoyment: number
}

interface RawChoiceAnswer {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

interface RawNoulAnswer {
  type: 'noul'
  noul: number
}

interface RawScoreAnswer {
  type: 'score'
  score: number
  legend: Record<string, string>
  probabilities: Record<string, number>
  confidence: number
}

interface RawResponse {
  model: string
  answers: {
    runType: RawChoiceAnswer
    injuryRisk: RawNoulAnswer
    enjoyment: RawScoreAnswer
  }
  usage?: { input_tokens: number; output_tokens: number }
}

export function parseNoteIntelligence(raw: RawResponse): NoteIntelligenceResult {
  const runType = raw.answers.runType.choice as RunType
  if (!(runType in RUN_TYPE_CRITERIA)) {
    throw new Error(`Unknown run type from Jev: ${runType}`)
  }

  const injuryRisk = raw.answers.injuryRisk.noul
  if (injuryRisk < 0 || injuryRisk > 1) {
    throw new Error(`Injury risk probability out of range: ${injuryRisk}`)
  }

  const enjoyment = raw.answers.enjoyment.score

  return {
    runType,
    injuryRisk,
    injuryRiskFlag: injuryRisk >= INJURY_RISK_THRESHOLD,
    enjoyment,
  }
}

export const NOTE_INTELLIGENCE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export interface AnalyzeOptions {
  apiKey?: string
  fetchImpl?: typeof fetch
}

export async function analyzeRunNote(
  note: string,
  opts: AnalyzeOptions = {},
): Promise<NoteIntelligenceResult> {
  const apiKey = opts.apiKey ?? process.env.TYPESAFE_API_KEY
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is required to analyze a run note')
  }

  const fetchImpl = opts.fetchImpl ?? fetch

  const res = await fetchImpl(NOTE_INTELLIGENCE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildNoteIntelligenceRequest(note)),
  })

  if (!res.ok) {
    throw new Error(`TypeSafe rejected the note intelligence request (HTTP ${res.status})`)
  }

  const raw = (await res.json()) as RawResponse
  return parseNoteIntelligence(raw)
}