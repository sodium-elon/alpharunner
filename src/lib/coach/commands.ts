import { z } from 'zod'

const specifications = {
  route: { required: ['text'], optional: [] },
  inventory: { required: [], optional: [] },
  prepare: { required: ['date', 'term', 'user-request'], optional: ['activity-id'] },
  'resolve-shoe': { required: ['term'], optional: [] },
  'recommend-shoes': { required: ['purpose'], optional: ['surface', 'pace', 'power-source'] },
  'analyze-run': { required: ['activity-id', 'date'], optional: ['user-intent', 'note'] },
  note: { required: ['text', 'source'], optional: [] },
  'task-create': { required: ['date', 'activity-id', 'shoe-id', 'user-request'], optional: [] },
  'task-confirm': { required: ['task-id', 'date', 'activity-id', 'shoe-id', 'source-message-id', 'answer'], optional: [] },
  'task-show': { required: ['task-id'], optional: [] },
  'import-task': { required: ['task-id', 'coaching-file'], optional: [] },
} satisfies Record<string, { required: string[]; optional: string[] }>
export type CoachCommand = keyof typeof specifications
export type CommandOptions = Record<string, string>
export type CommandHandlers = Partial<Record<CoachCommand, (options: CommandOptions) => Promise<unknown>>>
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

export function parseCoachCommand(raw: string[]): { name: CoachCommand | 'help'; options: CommandOptions } {
  const args = [...raw]
  while (args[0] === '--') args.shift()
  const name = args.shift()
  if (!name || name === '--help' || name === 'help') return { name: 'help', options: {} }
  if (!Object.hasOwn(specifications, name)) throw new Error('Unknown coach command')
  const spec = specifications[name as CoachCommand], options: CommandOptions = {}
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    if (!flag.startsWith('--')) throw new Error('Expected a named option')
    const key = flag.slice(2), value = args[i + 1]
    if (![...spec.required, ...spec.optional].includes(key)) throw new Error(`Unknown option: ${flag}`)
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${flag}`)
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    options[key] = value
  }
  for (const key of spec.required) if (!options[key]?.trim()) throw new Error(`Required option: --${key}`)
  if (options.date) z.iso.date().parse(options.date)
  if (options['activity-id'] && !/^\d+$/.test(options['activity-id'])) throw new Error('Garmin activity ID must be numeric')
  for (const key of ['shoe-id', 'task-id']) if (options[key] && !uuid.test(options[key])) throw new Error(`${key} must be a database UUID`)
  if (options.source && !['user', 'coach', 'history'].includes(options.source)) throw new Error('Note source must be user, coach or history')
  if (options.answer && !['yes', 'no'].includes(options.answer)) throw new Error('Confirmation answer must be yes or no')
  if (options.pace && (!/^\d+(?:\.\d+)?$/.test(options.pace) || !Number.isFinite(Number(options.pace)) || Number(options.pace) <= 0)) throw new Error('Pace must be positive seconds per km')
  if (options['power-source'] && !['stryd', 'garmin', 'unknown'].includes(options['power-source'])) throw new Error('Power source must be stryd, garmin or unknown')
  return { name: name as CoachCommand, options }
}

export async function dispatchCoachCommand(args: string[], handlers: CommandHandlers): Promise<unknown> {
  const command = parseCoachCommand(args)
  if (command.name === 'help') return {
    commands: specifications,
    policy: 'Read-only judgments never authorize a write. import-task requires a durably confirmed task with an explicit date, numeric Garmin ID and existing shoe ID.',
  }
  const handler = handlers[command.name]
  if (!handler) throw new Error(`Coach handler unavailable: ${command.name}`)
  return handler(command.options)
}
