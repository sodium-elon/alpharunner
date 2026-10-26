import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('keeps linked multi-turn imports evidence-bound through completion and voice incident review', async () => {
  const root = new URL('../../../../skills/sportscoach-decisions/', import.meta.url)
  const referencePath = 'references/request-continuity-and-voice-evidence.md'
  const reference = await readFile(new URL(referencePath, root), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  expect(reference, 'current-request evidence guidance must be present in canonical source').not.toBe('')
  const decisions = await readFile(new URL('SKILL.md', root), 'utf8')
  expect(decisions).toContain(`](${referencePath})`)

  const continuity = reference.split('## Multi-turn import pattern')[1]?.split('\n## ')[0] ?? ''
  expect(continuity).toContain('combine only linked current turns')
  expect(continuity).toMatch(/unique live-inventory phonetic shoe[\s\S]*receipt\/user timezone[\s\S]*exact-date existing runs[\s\S]*prepare, scope-check[\s\S]*persist actual authorization before slow analysis/)
  expect(continuity).toContain('Never substitute an old same-weekday activity')

  const evidence = reference.split('## Evidence ladder')[1]?.split('\n## ')[0] ?? ''
  for (const phrase of ['proves invocation, not returned data', 'not a resolver match, DB import or log finding', 'transactional `verified:true`', 'matching activity/date/shoe, child counts and current run summary', 'Line-numbered text output is a display format', 'without repeating Garmin/Jev analysis']) {
    expect(evidence).toContain(phrase)
  }

  const voice = reference.split('## Voice incident checklist')[1] ?? ''
  for (const phrase of ['actual delivery', 'answer receipt', 'Separate synthetic YesIntent delivery from the real spoken-answer route', 'No linked inbound answer was found in the inspected source/window', 'capture/routing cause remains unverified', "Respect the user's testimony", 'Do not infer that an unobserved answer expired', 'establish the active log source', 'Do not manufacture a timeline', 'exercised reproduction and retest', 'never extend authorization windows']) {
    expect(voice).toContain(phrase)
  }
})

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
    expect(content).not.toContain('legacy-workflow.md')
  }
})

it('keeps treadmill distance uncertainty and concise voice evidence source-bound', async () => {
  const coaching = await readFile(new URL('../../../../skills/running-coaching/SKILL.md', import.meta.url), 'utf8')
  for (const phrase of [
    'Treadmill distance conflicts and concise voice debriefs',
    'compare duration totals too',
    'neither distance is automatically ground truth',
    'Preserve raw imported measurements',
    'Narrow power variability proves control, not easy effort',
    'Without dated CP',
    'HR drift alone proves neither sensor failure nor physiological decoupling',
    'do not upgrade this to economy or fitness improvement',
    'Saved dashboard prose does not replace the spoken debrief',
  ]) {
    expect(coaching).toContain(phrase)
  }
})
