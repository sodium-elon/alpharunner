import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

export type CoachEnvironment = Awaited<ReturnType<typeof loadCoachEnvironment>>

export interface EnvironmentOptions {
  projectEnv?: string
  sharedEnv?: string
  processEnv?: NodeJS.ProcessEnv
}

async function envFile(path: string) {
  try { return parse(await readFile(path, 'utf8')) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error('Coach environment file could not be read')
  }
}

// The token stays in its existing environment/secrets files. Diagnostics never
// include credential values, connection strings or private provider responses.
export async function loadCoachEnvironment(options: EnvironmentOptions = {}) {
  const [project, shared] = await Promise.all([
    envFile(options.projectEnv ?? fileURLToPath(new URL('../../../../env-profiles/local.env', import.meta.url))),
    envFile(options.sharedEnv ?? join(homedir(), '.hermes/secrets/typesafe.env')),
  ])
  const env = { ...project, ...(options.processEnv ?? process.env) }
  const apiKey = env.TYPESAFE_API_KEY || shared.TYPESAFE_API_KEY || undefined
  const openRouterApiKey = env.OPENROUTER_API_KEY || undefined
  const databaseUrl = env.DATABASE_URL || undefined
  return {
    apiKey, openRouterApiKey, databaseUrl,
    garminExecutable: env.COACH_GARMIN_CLI || join(homedir(), 'projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli'),
    garminTokenStore: env.COACH_GARMIN_TOKENS || join(homedir(), '.garmin-cli/tokens'),
    stateRoot: env.COACH_STATE_DIR || join(homedir(), '.hermes/profiles/sportscoach/state/coach-tasks'),
    diagnostics: { database: !!databaseUrl, typesafe: !!apiKey, openrouter: !!openRouterApiKey },
  }
}
