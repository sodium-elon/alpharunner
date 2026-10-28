import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('keeps installer regressions in hosted CI and routes managed learning through source', async () => {
  const workflow = await readFile(new URL('../../../../.github/workflows/quality.yml', import.meta.url), 'utf8')
  expect(workflow).toContain("python3 -B -m unittest discover -s scripts -p 'test_*sportscoach*.py'")
  for (const name of ['running-coaching', 'alpharunner-garmin-run-import', 'sportscoach-decisions']) {
    const text = await readFile(new URL(`../../../../skills/${name}/SKILL.md`, import.meta.url), 'utf8')
    expect(text).toContain('state/skill-proposals/')
    expect(text).toContain('not by patching installed files')
  }
})

it('ships a current-only coaching reference graph with no executable retired advice', async () => {
  const root = fileURLToPath(new URL('../../../../skills/', import.meta.url))
  for (const name of ['running-coaching', 'alpharunner-garmin-run-import', 'sportscoach-decisions']) {
    const base = resolve(root, name)
    expect(existsSync(resolve(base, 'references/legacy-workflow.md')), name).toBe(false)
    const files = ['SKILL.md', ...(await readdir(resolve(base, 'references'))).map(p => `references/${p}`)]
    for (const file of files) {
      const path = resolve(base, file)
      const text = await readFile(path, 'utf8')
      expect(text, path).not.toMatch(/legacy-workflow\.md|fitness (?:calendar|training-readiness|power-zones)|workouts (?:create|schedule)|--latest-running|fresh-code retry|OTP failure|scripts\/shoe-choice\.ts|tsx -e|psql .*?-c/)
      for (const line of text.split('\n').filter(line => /["$]GARMIN_CLI.* --tokenstore/.test(line))) {
        expect(line, path).toContain('--env-file "$GARMIN_ENV"')
      }
      for (const match of text.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)) {
        expect(existsSync(resolve(dirname(path), match[1])), `${path} -> ${match[1]}`).toBe(true)
      }
    }
  }
  const coaching = await readFile(resolve(root, 'running-coaching/SKILL.md'), 'utf8')
  expect(coaching).toContain('references/coaching-evidence.md')
  const evidence = await readFile(resolve(root, 'running-coaching/references/coaching-evidence.md'), 'utf8')
  for (const phrase of ['Calendar/adaptive recommendations and training readiness are unavailable', 'completed-workout metadata', 'directWorkoutComplianceScore', '7/14/28', 'conditional', '180 spm', 'clinician', 'prescribed', 'Stryd']) {
    expect(evidence).toContain(phrase)
  }
  const importer = await readFile(resolve(root, 'alpharunner-garmin-run-import/SKILL.md'), 'utf8')
  expect(importer).toContain('references/import-evidence.md')
  const identity = await readFile(resolve(root, 'alpharunner-garmin-run-import/references/import-evidence.md'), 'utf8')
  for (const phrase of ['receipt timestamp', 'numeric Garmin', 'matched', 'authorization', 'verified:true', 'not yet stored', 'import-seed.json']) {
    expect(identity).toContain(phrase)
  }
})

it('does not ship superseded standalone analysis or SQL-write helpers', () => {
  for (const path of [
    'running-coaching/scripts/analyze-staged-run.py',
    'alpharunner-garmin-run-import/scripts/verify-and-note-garmin-import.mjs',
  ]) {
    expect(existsSync(new URL(`../../../../skills/${path}`, import.meta.url)), path).toBe(false)
  }
})

it('uses Personal API-only authentication guidance without legacy login recovery', async () => {
  const root = new URL('../../../../', import.meta.url)
  const skill = await readFile(new URL('skills/alpharunner-garmin-run-import/SKILL.md', root), 'utf8')
  const auth = await readFile(new URL('skills/alpharunner-garmin-run-import/references/garmin-auth-recovery-recipe.md', root), 'utf8')
  expect(skill).toContain('Personal API')
  expect(auth).toContain('GARMIN_PERSONAL_API_KEY')
  expect(auth).toContain('No browser, email OTP, legacy login or scheduled session refresh')
  expect(auth).not.toContain('GARMIN_GMAIL_APP_PASSWORD')
  expect(auth).toContain('--env-file "$GARMIN_ENV"')
})

it.each(['stage-garmin-activity-http.mjs', 'stage-garmin-activity-paginated.mjs'])('passes the protected key file through compatibility wrapper %s', async name => {
  const script = await readFile(new URL(`../../../../skills/alpharunner-garmin-run-import/scripts/${name}`, import.meta.url), 'utf8')
  const spawnSync = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }))
  const exit = vi.fn()
  runInNewContext(script.replace("import { spawnSync } from 'node:child_process'", ''), {
    spawnSync, console, process: { argv: ['node', name, '123', '/tmp/fixture-stage.json'], exit },
  })
  expect(spawnSync).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['--env-file', '/home/john/projects/alpharunner.workspace/env-profiles/local.env']), expect.any(Object))
  expect(exit).toHaveBeenCalledWith(0)
})

it('documents Personal API staging without operational browser or MCP fallback', async () => {
  const root = new URL('../../../../', import.meta.url)
  const readme = await readFile(new URL('README.md', root), 'utf8')
  const staging = await readFile(new URL('scripts/garmin/README.md', root), 'utf8')
  expect(readme).toContain('## Garmin Personal API import')
  expect(readme).not.toContain("server's own Playwright browser")
  expect(staging).toContain('stage --activity')
  expect(staging).toContain('--env-file')
  expect(staging).not.toContain('use the Garmin MCP tools')
  expect(staging).not.toContain('Using the Garmin MCP tools')
})

it('declares the AlphaRunner service without a retired MCP startup dependency', async () => {
  const unit = await readFile(new URL('../../../../deploy/alpharunner.service', import.meta.url), 'utf8').catch(() => '')
  expect(unit).toContain('Requires=palladium.service')
  expect(unit).not.toContain('garmin-mcp.service')
})
