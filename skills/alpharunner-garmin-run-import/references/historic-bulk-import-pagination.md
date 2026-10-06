# Historic Bulk Import: Pagination and Detection

This reference documents the `garmin-cli` pagination pattern for fetching all Garmin activities and detecting which runs need import.

## Garmin activity pagination

Fetch pages of 100 until the CLI returns an empty JSON array:

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_TOKENS=/home/john/.garmin-cli/tokens

start=0
while :; do
  page="$($GARMIN_CLI --tokenstore "$GARMIN_TOKENS" activities list --limit 100 --start "$start")" || exit $?
  [ "$page" = '[]' ] && break
  printf '%s\n' "$page"
  start=$((start + 100))
done
```

For programmatic aggregation, parse each stdout value as JSON and append its array items. Never concatenate arrays as raw text. Returned activities are newest-first.

## Filtering running activities

Keep activities where:

- `activityType.typeKey` is `running` or `treadmill_running`; or
- `activityType.parentTypeId === 1`.

Filter out cycling, walking, strength training, and other sports.

## Detecting import gaps

Query existing Garmin IDs:

```sql
SELECT garmin_activity_id
FROM alpharunner.runs
WHERE garmin_activity_id IS NOT NULL;
```

Convert both Garmin and database IDs to strings, then retain running activities whose `activityId` is absent from the database set. Report the count and minimum/maximum `startTimeLocal` before a bulk import.

## Scale estimation

Staging fetches summary/detail/splits/HR-zone data. Large imports can make hundreds of authenticated requests and take many minutes. Report the estimated run count and request scale, then obtain confirmation before proceeding.

## Data flow

1. Paginate and aggregate all activities through `garmin-cli activities list`.
2. Filter to running activities.
3. Check existing `garmin_activity_id` values in AlphaRunner.
4. Identify the import gap.
5. For each approved numeric ID, run `garmin-cli stage --activity <id>`; explicit-ID lookup is paginated internally.
6. Preserve `listItem`, `detail`, `splits`, and `hrZones` in the staging envelope.
7. Resolve shoe assignment for each run.
8. Run `pnpm db:sync-garmin` against the staged data.

Even for bulk import, shoe assignment is required per run unless John explicitly authorizes `--no-shoe`.
