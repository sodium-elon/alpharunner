import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskStore } from '../task-state'

const roots: string[] = []
const facts = {
  date: '2026-10-02', activityId: '24581872638',
  shoeId: '3c86bb1f-1eaf-6b59-e1de-800e741ca8c9',
  userRequest: 'Import October 2 with Adidas Boston 13 and analysis',
}
async function store(now = 1000) {
  const root = await mkdtemp(join(tmpdir(), 'coach-task-'))
  roots.push(root)
  return new TaskStore(root, () => now)
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('durable coach task identity and confirmation', () => {
  it('learns only user-confirmed shoe aliases across fresh store instances', async () => {
    const first = await store()
    const named = {...facts,shoeTerm:'kjordan'}
    const task = await first.create(named)
    expect(await first.confirmedAliases()).toEqual({})
    await first.confirm(task.id,{answer:'yes',expected:named,sourceMessageId:'actual-user-message'})
    expect(await new TaskStore(first.root).confirmedAliases()).toEqual({[facts.shoeId]:['kjordan']})
  })
  it('cancels a pending confirmation without allowing a later yes or import', async () => {
    const first = await store()
    const task = await first.create(facts)
    await first.cancel(task.id)
    await expect(first.confirm(task.id, { answer: 'yes', expected: facts, sourceMessageId: 'cli:late-yes' })).rejects.toThrow()
    await expect(first.claim(task.id)).rejects.toThrow()
    expect((await first.read(task.id)).status).toBe('cancelled')
  })

  it('lets only one worker claim a confirmed task and saves completion', async () => {
    const first = await store()
    const task = await first.create(facts)
    await first.confirm(task.id, { answer: 'yes', expected: facts, sourceMessageId: 'cli:yes' })
    const other = new TaskStore(first.root, () => 1200)
    const claims = await Promise.allSettled([first.claim(task.id), other.claim(task.id)])
    expect(claims.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    const winner = claims.find(x => x.status === 'fulfilled')!
    if (winner.status !== 'fulfilled') throw new Error('No owner')
    await first.complete(task.id, winner.value.claimToken!, { runId: 'persisted-run', verified: true })
    expect((await other.read(task.id)).status).toBe('completed')
    await expect(other.claim(task.id)).rejects.toThrow()
  })

  it('rejects confirmation at the exact persisted deadline', async () => {
    const first = await store()
    const task = await first.create(facts)
    const later = new TaskStore(first.root, () => 31000)
    await expect(later.confirm(task.id, { answer: 'yes', expected: facts, sourceMessageId: 'cli:late' })).rejects.toThrow('expired')
    expect((await first.read(task.id)).authorization).toBeNull()
  })

  it('survives a new instance without relying on conversation history', async () => {
    const first = await store()
    const task = await first.create(facts)
    const reopened = new TaskStore(first.root, () => 1100)
    expect(await reopened.read(task.id)).toMatchObject({ ...facts, status: 'pending', authorization: null })
    await reopened.confirm(task.id, { answer: 'yes', expected: facts, sourceMessageId: 'cli:user-confirmation-1' })
    expect(await first.read(task.id)).toMatchObject({ ...facts, status: 'confirmed', authorization: { sourceMessageId: 'cli:user-confirmation-1' } })
  })
})
