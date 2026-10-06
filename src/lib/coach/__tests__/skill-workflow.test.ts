import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('requires domain evidence and compact stored coaching rather than an audit transcript', async () => {
  const root = new URL('../../../../skills/', import.meta.url)
  const content = await readFile(new URL('running-coaching/SKILL.md', root), 'utf8')
  for (const phrase of ['mandatory before writing', 'john-shoe-rotation.md', 'shoe-rotation-evidence.md', 'Recent progression', '2000 characters', 'original user testimony', 'not a telemetry dump']) {
    expect(content).toContain(phrase)
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
