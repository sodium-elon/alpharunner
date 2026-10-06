import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

const uuid = z.string().regex(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i)
const factsSchema = z.object({
  date: z.iso.date(), activityId: z.string().regex(/^\d+$/), shoeId: uuid,
  userRequest: z.string().min(1).max(4000),
  shoeTerm: z.string().trim().min(1).max(200).optional(),
  operation: z.enum(['import', 'correct_run_shoe']).default('import'),
  runId: uuid.optional(), oldShoeId: uuid.nullable().optional(),
}).refine(facts => facts.operation !== 'correct_run_shoe' || (facts.runId !== undefined && facts.oldShoeId !== undefined), 'Correction scope requires run identity and old shoe')
export type TaskFacts = z.input<typeof factsSchema>
const taskSchema = factsSchema.safeExtend({
  id: uuid, status: z.enum(['pending', 'confirmed', 'running', 'completed', 'failed', 'cancelled']),
  createdAt: z.number().finite(),
  authorization: z.object({ sourceMessageId: z.string().min(1), confirmedAt: z.number().finite() }).nullable(),
  claimToken: uuid.optional(), result: z.record(z.string(), z.unknown()).optional(),
})
export type CoachTask = z.infer<typeof taskSchema>

// Local durable context, not a new source of human authorization. The trusted
// caller supplies the actual user confirmation; Jev never calls confirm().
export class TaskStore {
  constructor(readonly root: string, private readonly clock = Date.now) {}

  private path(id: string) { return join(this.root, `${uuid.parse(id)}.json`) }

  async create(facts: TaskFacts): Promise<CoachTask> {
    const task: CoachTask = { ...factsSchema.parse(facts), id: randomUUID(), status: 'pending', createdAt: this.clock(), authorization: null }
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await writeFile(this.path(task.id), JSON.stringify(task), { flag: 'wx', mode: 0o600 })
    return task
  }

  async read(id: string): Promise<CoachTask> {
    const task = taskSchema.parse(JSON.parse(await readFile(this.path(id), 'utf8')))
    if (task.id !== id) throw new Error('Task identity mismatch')
    return task
  }

  private async update(id: string, change: (task: CoachTask) => CoachTask): Promise<CoachTask> {
    const path = this.path(id), lock = `${path}.lock`, temp = `${path}.${randomUUID()}.tmp`
    try { await mkdir(lock, { mode: 0o700 }) }
    catch { throw new Error('Task is busy or state storage is unavailable') }
    try {
      const updated = taskSchema.parse(change(await this.read(id)))
      await writeFile(temp, JSON.stringify(updated), { flag: 'wx', mode: 0o600 })
      await rename(temp, path)
      return updated
    } finally {
      await rm(temp, { force: true })
      await rm(lock, { recursive: true })
    }
  }

  async confirm(id: string, confirmation: { answer: 'yes'; expected: TaskFacts; sourceMessageId: string }): Promise<CoachTask> {
    if (confirmation.answer !== 'yes') throw new Error('Positive user confirmation is required')
    const expected = factsSchema.parse(confirmation.expected)
    if (!confirmation.sourceMessageId.trim()) throw new Error('User confirmation provenance is required')
    return this.update(id, task => {
      if (task.status !== 'pending') throw new Error('Task is not awaiting confirmation')
      const now = this.clock()
      if (now >= task.createdAt + 30000) throw new Error('Confirmation expired')
      if (task.operation !== expected.operation || task.runId !== expected.runId || task.oldShoeId !== expected.oldShoeId) throw new Error('Confirmation scope/operation mismatch')
      if (task.date !== expected.date || task.activityId !== expected.activityId || task.shoeId !== expected.shoeId) throw new Error('Confirmation does not match the original run and shoe')
      return { ...task, status: 'confirmed', authorization: { sourceMessageId: confirmation.sourceMessageId, confirmedAt: now } }
    })
  }

  async confirmedAliases(): Promise<Record<string, string[]>> {
    let names: string[]
    try { names = await readdir(this.root) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error }
    const aliases: Record<string, string[]> = {}
    for (const name of names.filter(name => /^[a-f0-9-]{36}\.json$/i.test(name))) {
      const task = await this.read(name.slice(0,-5))
      if (!task.authorization || task.status === 'cancelled' || !task.shoeTerm) continue
      const terms = aliases[task.shoeId] ??= []
      if (!terms.includes(task.shoeTerm)) terms.push(task.shoeTerm)
    }
    return aliases
  }
  async cancel(id: string): Promise<CoachTask> {
    return this.update(id, task => {
      if (!['pending', 'confirmed'].includes(task.status)) throw new Error('Task cannot be cancelled after execution starts')
      return { ...task, status: 'cancelled', authorization: null }
    })
  }

  async claim(id: string): Promise<CoachTask> {
    return this.update(id, task => {
      if (task.status !== 'confirmed' || !task.authorization) throw new Error('Task must be confirmed and unclaimed')
      return { ...task, status: 'running', claimToken: randomUUID() }
    })
  }

  async complete(id: string, claimToken: string, result: Record<string, unknown>): Promise<CoachTask> {
    return this.finish(id, claimToken, result, 'completed')
  }

  async fail(id: string, claimToken: string, result: Record<string, unknown>): Promise<CoachTask> {
    return this.finish(id, claimToken, result, 'failed')
  }

  private async finish(id: string, claimToken: string, result: Record<string, unknown>, status: 'completed' | 'failed'): Promise<CoachTask> {
    return this.update(id, task => {
      if (task.status !== 'running' || task.claimToken !== claimToken) throw new Error('Task completion requires the active owner')
      return { ...task, status, result }
    })
  }
}
