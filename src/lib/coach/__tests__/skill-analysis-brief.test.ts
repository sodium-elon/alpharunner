import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('makes the installed coaching entrypoints consume the analysis brief before deeper investigation', async () => {
  const root = new URL('../../../../skills/', import.meta.url)
  for (const name of ['running-coaching', 'sportscoach-decisions']) {
    const content = await readFile(new URL(`${name}/SKILL.md`, root), 'utf8')
    expect(content).toContain('analysisBrief')
    expect(content).toContain('before deeper investigation')
    expect(content).toContain('not additional runs')
    expect(content).toContain('same-day/future')
    expect(content).toContain('raw judgments')
    expect(content).toContain('mandatory')
  }
})
