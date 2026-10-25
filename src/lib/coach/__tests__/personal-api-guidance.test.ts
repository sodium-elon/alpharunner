import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

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
