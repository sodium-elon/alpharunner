# Current Personal API retrieval contract

Routine work uses [Sportscoach decisions](../../sportscoach-decisions/SKILL.md), not direct staging/sync or ad-hoc SQL. The following lower-level reads are for a bounded retrieval diagnosis or an explicitly scoped transport operation. They do not authorize database writes.

## Every fresh process receives its protected env file

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_ENV=/home/john/projects/alpharunner.workspace/env-profiles/local.env
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" auth check
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" activities list --start-date YYYY-MM-DD --end-date YYYY-MM-DD --activity-type running --limit 100 --start 0
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" stage --activity <numeric-id> --out /home/john/projects/alpharunner.workspace/alpharunner/tmp/garmin-<numeric-id>.json
```

The env file stays external, mode 0600; never print its values, bearer cache or private auth profile. A parent's parsed env file does not authenticate a new child process. Use [bounded auth diagnosis](garmin-auth-recovery-recipe.md). Never switch stores, read mail or revive browser/password/MCP/session maintenance.

Use exact-date discovery plus numeric ID, sport and local-date validation. Paginate to a proved end or report incomplete discovery; do not pick the newest item to satisfy a requested date. An existing stage must match activityId and startTimeLocal before analysis. Compatibility stage wrappers already pass the env-file path and explicit ID; their filenames do not imply another transport.

## Envelope and missingness

CLI staging normalizes the current API/FIT evidence into `activities[]`, each with `listItem`, `detail`, `splits`, `hrZones`. Identity includes `listItem.activityId`, `activityName`, `startTimeLocal`; summary metrics are under `detail.summaryDTO`, sport under `detail.activityTypeDTO`, laps under `splits.lapDTOs`, HR zones in their supplied array. This is a normalization contract, not proof that four former endpoints exist or that every field is supplied. Never hand-fill absent telemetry to make validation pass.

Calendar/adaptive prescriptions, training readiness and live zone configuration are unavailable through this backend. Completed titles/structure/compliance, RPE/feel, benefit and load may still exist in actual activity metadata. Do not declare those unavailable merely because future plan access is missing. An independently supplied prescription stays separate from completed execution; missing access does not mean no plan.

For maintenance-specific schema interpretation use [schema facts](db-schema-column-pitfalls.md); schema knowledge is not permission for scratch imports or repairs. Routine facts use run-summary; routine writes use the confirmed task adapter.
