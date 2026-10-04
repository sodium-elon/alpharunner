import { loadCoachEnvironment } from '../src/lib/coach/environment'
import { createCoachServices } from '../src/lib/coach/service'
import { dispatchCoachCommand, parseCoachCommand } from '../src/lib/coach/commands'

async function main() {
  const args = process.argv.slice(2)
  const parsed = parseCoachCommand(args)
  const handlers = parsed.name === 'help' ? {} : createCoachServices(await loadCoachEnvironment())
  console.log(JSON.stringify(await dispatchCoachCommand(args, handlers), null, 2))
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Coach command failed')
  process.exitCode = 1
})
