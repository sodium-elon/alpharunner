# Request continuity and voice evidence

## Multi-turn import pattern

Example sequence: quoted garbled shoe statement → explicit add-run instruction → weekday answer. Treat quoting as contextual evidence, not an automatic no-write rule. Once current intent is established, combine only linked current turns. Resolve the unique live-inventory phonetic shoe, anchor the weekday to the receipt/user timezone, check exact-date existing runs, then prepare, scope-check and promptly persist actual authorization before slow analysis. Preserve raw wording and separate normalization annotations. Never substitute an old same-weekday activity.

## Evidence ladder

- A tool invocation acknowledgment proves invocation, not returned data.
- Exit zero proves command-level success, not a resolver match, DB import or log finding.
- Read back substantive JSON/results; require transactional `verified:true`, matching activity/date/shoe, child counts and current run summary for import completion.
- Parse raw saved JSON with a file reader. Line-numbered text output is a display format, not the original JSON. Correct the presentation layer without repeating Garmin/Jev analysis.

## Voice incident checklist

Collect linked identities/timestamps for original request, question preparation, actual delivery, pending state/generation, answer receipt, expiry/consumption and session termination. Separate synthetic YesIntent delivery from the real spoken-answer route.

Permitted conclusion when the original answer is absent: 'No linked inbound answer was found in the inspected source/window; the capture/routing cause remains unverified.' Respect the user's testimony that they answered.

Do not infer that an unobserved answer expired solely from a configured deadline or unrelated later yeses. Do not infer a broken logging subsystem merely from an absent filesystem path; establish the active log source. Do not manufacture a timeline from truncated output or conversation summaries. A timing fix requires an exercised reproduction and retest before claiming repair; never extend authorization windows merely to rescue an import.
