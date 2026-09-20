// CLI wrapper for TypeSafe run-note intelligence (sportscoach / default profile).
// Usage: pnpm dotenv -e ../env-profiles/local.env -- tsx scripts/analyze-note.ts "<free-text run note>"
// Reads TYPESAFE_API_KEY from env; emits JSON judgments for coaching_notes.
import { analyzeRunNote } from '../src/lib/note-intelligence'

const note = process.argv[2]
if (!note) {
  console.error('Usage: tsx scripts/analyze-note.ts "<run note>"')
  process.exit(1)
}

const result = await analyzeRunNote(note)
console.log(JSON.stringify(result, null, 2))