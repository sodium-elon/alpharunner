import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('omits absent original user notes instead of passing null into saved-text validation', async () => {
  const content = await readFile(new URL('../../../../skills/sportscoach-decisions/SKILL.md', import.meta.url), 'utf8')
  expect(content).toContain('Omit the `userNote` key entirely when no original user text exists')
  expect(content).toContain('Do NOT pass `"userNote": null`')
  expect(content).toContain('Invalid text or prohibited injury probability claim')
})

it('distinguishes failed-task status from missing authorization without permitting pending imports', async () => {
  const content = await readFile(new URL('../../../../skills/sportscoach-decisions/SKILL.md', import.meta.url), 'utf8')
  const recovery = content.split('## Failed-import reconciliation')[1]?.split('\n## ')[0] ?? ''
  expect(recovery.includes('status: confirmed')).toBe(true)
  expect(recovery.includes('An actual user confirmation is required before importing')).toBe(true)
  expect(recovery.includes('pending task cannot import')).toBe(true)
})

it('recovers captured JSON without blindly dropping data or repeating semantic analysis', async () => {
  const content = await readFile(new URL('../../../../skills/sportscoach-decisions/SKILL.md', import.meta.url), 'utf8')
  const analysis = content.split('## Read-only analysis')[1]?.split('\n## ')[0] ?? ''
  expect(analysis.includes('remove only that recognized runner banner')).toBe(true)
  expect(analysis.includes('never blindly drop the first line')).toBe(true)
  expect(analysis.includes('do not repeat Jev')).toBe(true)
  expect(analysis.includes('tail -n +2')).toBe(false)
})

it('requires domain evidence and compact stored coaching rather than an audit transcript', async () => {
  const root = new URL('../../../../skills/', import.meta.url)
  const content = await readFile(new URL('running-coaching/SKILL.md', root), 'utf8')
  for (const phrase of ['mandatory before writing', 'john-shoe-rotation.md', 'shoe-rotation-evidence.md', 'Recent progression', '2000 characters', 'original user testimony', 'not a telemetry dump']) {
    expect(content).toContain(phrase)
  }
})

it('keeps the current voice receipt scoped through shoe clarification and one-shot confirmation', async () => {
  const root = new URL('../../../../skills/', import.meta.url)
  const decisions = await readFile(new URL('sportscoach-decisions/SKILL.md', root), 'utf8')
  const contract = decisions.split('## Current-request scope')[1]?.split('\n## ')[0]
  expect(contract, 'the current-request contract must exist independently of historical task recovery').toBeDefined()
  for (const phrase of [
    'current request ID, receipt timestamp and explicit date outrank compressed summaries',
    'Never reopen archived receipts or previous requests',
    'Never volunteer an old run\'s speed or shoe',
    'here is for running coach: 2026-10-08 kinabaro 16',
    'not 2026-10-07',
    'Reuse a verified current candidate',
    'do not repeat uncertain semantic resolution',
    'clarify`/`no_match` remain unresolved',
    'original current request + Coach question + User answer',
    'A one-shot yes/no applies only to that question and current scope',
    'Use a matched resolver shoe directly without routine reconfirmation',
    'do not second-guess its raw confidence',
    'native LogRun transport is already an instruction to log',
    'never authorizes a different date, shoe or task',
    'not cryptographic enforcement',
  ]) {
    expect(contract).toContain(phrase)
  }
})

it('routes routine imports directly through the main Sportscoach with a bounded completion contract', async () => {
  const root = new URL('../../../../skills/', import.meta.url)
  const decisions = await readFile(new URL('sportscoach-decisions/SKILL.md', root), 'utf8')
  for (const phrase of ['main Sportscoach', 'do not use generic `delegate_task`', 'original request date and shoe', 'task-show', 'verified:true', 'final reply', 'one read-only auth check', 'stop and report']) {
    expect(decisions).toContain(phrase)
  }
  for (const name of ['running-coaching', 'alpharunner-garmin-run-import']) {
    const content = await readFile(new URL(`${name}/SKILL.md`, root), 'utf8')
    expect(content).toContain('/home/john/projects/alpharunner.workspace/alpharunner/skills/sportscoach-decisions/SKILL.md')
    expect(content).toContain('main Sportscoach')
    expect(content).toContain('references/legacy-workflow.md')
  }
})
