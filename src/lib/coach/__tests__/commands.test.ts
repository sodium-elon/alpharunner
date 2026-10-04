import { expect, it, vi } from 'vitest'
import { dispatchCoachCommand, parseCoachCommand } from '../commands'

it('routes a bounded command without giving the classifier permission to execute writes', async () => {
  const handlers = { route: vi.fn(async () => ({ operation: 'import_run', needsReview: false })) }
  const result = await dispatchCoachCommand(['route', '--text', 'Import October 2 with Boston 13'], handlers)
  expect(result).toMatchObject({ operation: 'import_run' })
  expect(handlers.route).toHaveBeenCalledWith({ text: 'Import October 2 with Boston 13' })
})
it('prepares a routine import from a date and named shoe without improvising a lookup script', () => {
  expect(parseCoachCommand(['prepare', '--date', '2026-10-02', '--term', 'Boston 13', '--user-request', 'Import this run'])).toEqual({
    name: 'prepare', options: { date: '2026-10-02', term: 'Boston 13', 'user-request': 'Import this run' },
  })
})

it('rejects unknown commands, flags and duplicate values before a handler runs', () => {
  expect(() => parseCoachCommand(['exec', '--text', 'shell'])).toThrow()
  expect(() => parseCoachCommand(['resolve-shoe', '--term', 'Boston', '--execute', 'yes'])).toThrow()
  expect(() => parseCoachCommand(['resolve-shoe', '--term', 'Boston', '--term', 'Leili'])).toThrow()
})
