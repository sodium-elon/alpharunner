import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../../skills/running-coaching/', import.meta.url)
const doctrine = (path: string) => readFile(new URL(path, root), 'utf8')
const sources = ['SKILL.md', 'references/treadmill-summary-lap-interpretation.md', 'references/stryd-power-coaching.md']

describe('canonical treadmill distance doctrine (read-only source contract)', () => {
  it('explains a confirmed post-run edit without repeating an unknown mechanism or conflating recorded and physical distance', async () => {
    expect(await doctrine('references/treadmill-summary-lap-interpretation.md')).toContain('use this known workflow as a common explanation, not proof that this specific run was edited.')
    for (const path of ['SKILL.md', 'references/treadmill-summary-lap-interpretation.md']) {
      const text = await doctrine(path)
      expect(text, path).toContain('Once the user confirms the post-run edit for this run, the mismatch mechanism is explained; do not keep calling it unknown.')
      expect(text, path).toContain('The accepted summary is the recorded headline, not independently verified physical distance.')
      expect(text, path).toContain('Preserve the adjusted summary and original laps as recorded.')
      expect(text, path).toContain('Without confirmation, a post-run edit remains a hypothesis, not an inferred calibration event.')
    }
  })

  it.each(sources)('gates treadmill source preference on verified pace/distance provenance in %s', async (path) => {
    const text = await doctrine(path)
    expect(text, path).toContain('When Stryd pace/distance is verified as the original source, prefer it over the treadmill console for physical-distance interpretation absent contrary calibration or sensor evidence.')
    expect(text, path).toContain('Stryd power presence alone does not establish the pace/distance source.')
    expect(text, path).toContain('Check actual sensor/watch source evidence; if unavailable, state the uncertainty once, do not invent Stryd-derived laps or default to the console as ground truth.')
    expect(text, path).toContain('Never silently rescale laps, overwrite totals, change calibration, reimport, or edit saved notes to resolve this discrepancy.')
    expect(text, path).toContain('manufacturer guidance, not per-run proof')
    expect(text, path).toContain('https://help.stryd.com/en/articles/8961322-treadmill-stryd-common-questions')
  })
})
