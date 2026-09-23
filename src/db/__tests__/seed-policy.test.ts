import { describe, expect, it } from 'vitest'
import { shouldInsertSeedShoe } from '../seed-policy'

describe('seed shoe import policy', () => {
  it('preserves an existing live shoe instead of overwriting it from the seed', () => {
    expect(shouldInsertSeedShoe([{ id: 'existing-shoe' }])).toBe(false)
  })

  it('allows a missing shoe to bootstrap from the seed', () => {
    expect(shouldInsertSeedShoe([])).toBe(true)
  })
})
