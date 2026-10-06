# Garmin CLI and DB Query Pitfalls

## Use the pinned CLI directly

Sports Coach does not require an HTTP bridge or MCP daemon. Every Garmin operation uses:

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" auth check
```

For staging:

```bash
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" stage --latest-running --out /home/john/projects/alpharunner.workspace/garmin-staged.json
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" stage --activity <numeric-id> --out /home/john/projects/alpharunner.workspace/garmin-staged.json
```

Explicit-ID lookup is paginated internally. The compatibility `.mjs` wrappers call these same CLI commands; their old filenames do not imply an HTTP dependency.

## Avoid fragile inline `tsx -e` SQL when using template literals

Short, constant SQL probes may use `tsx -e` only when backticks are correctly escaped. Move the query to a temporary TypeScript file under the repository's `tmp/` directory whenever it:

- uses JavaScript interpolation such as `${run.id}` inside a tagged SQL template;
- depends on a row returned by an earlier query;
- performs multiple inserts/updates or a transaction;
- is long enough that shell quoting obscures what will execute.

A double-quoted shell command can expand `${...}` before TypeScript sees it, producing Bash `bad substitution` even when SQL syntax is valid. Do not keep adding backslashes to a complex one-liner. Write and execute the file instead:

```bash
cd /home/john/projects/alpharunner.workspace/alpharunner
pnpm dotenv -e ../env-profiles/local.env -- tsx tmp/verify-<activity-id>.ts
```

Use the project dependency normally from that file:

```ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!);
try {
  const [run] = await sql`select id from alpharunner.runs where garmin_activity_id = ${activityId}`;
  const laps = await sql`select * from alpharunner.run_laps where run_id = ${run.id}`;
  console.log(JSON.stringify({ run, laps }, null, 2));
} finally {
  await sql.end();
}
```

After successful query-back verification, delete the exact temporary file under the skill's scratch-file hygiene rules.

## Garmin calendar syntax, month indexing, and item classification

`garmin-cli fitness calendar` takes **positional arguments**, not `--year` / `--month` flags:

```text
garmin-cli fitness calendar <year> <zero-based-month>
```

The month is zero-based. For example, September 2026 is:

```bash
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" fitness calendar 2026 8
```

Do not assume one universal date field. Current responses may expose the local calendar day as `date`; older/alternate payloads may use `calendarDate`, `startDate`, or `startTimeLocal`. Resolve in that order, normalize to `YYYY-MM-DD`, and verify that returned dates fall in the requested human month before using them.

The response can mix unrelated and completed items with planned workouts. Classify by `itemType` before drawing training-plan conclusions:

- `fbtAdaptiveWorkout`: planned Garmin adaptive workout. Read `date`, `title`, `trainingPlanId`, and `workoutUuid`.
- `activity`: completed activity; it is evidence of execution, not another prescription.
- `weight` and other item types: ignore for run-plan analysis unless specifically relevant.

A planned calendar entry is a recommendation, not proof that the athlete followed it. Match the planned item and completed activity by local date, title/intent, and numeric Garmin activity identity where available. When both appear on the same date, describe them separately as **scheduled** versus **completed**; do not double-count the training load.
