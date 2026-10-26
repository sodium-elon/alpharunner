# Bounded supplemental evidence for routine coaching

Use when `analyze-run` has completed but mandatory shoe history is absent from its output. Keep the normal task/authorization/import workflow unchanged.

## Retrieval order

1. Save the first analysis JSON. Inspect keys and project only the brief, features, judgments and relevant context. Keep runner stderr separate; do not print the full inventory or duplicate the brief's normalized evidence merely to discover one field.
2. Use `run-summary` for an explicitly dated comparator and, after import, the current run's headline values. Lap-weighted HR is a calculated estimate, not a substitute for Garmin's summary HR.
3. `inventory` establishes live shoe identity, specifications and role. Its metadata is not a mileage/observation report. Query only the verified shoe's count, summed distance and recent substantive observations if these are missing.
4. Use the existing environment loader and `postgres` dependency for a bounded read-only query, not a new import program or schema-discovery exercise. Close the client in `finally`; never print connection strings or credentials.

## Existing-client pattern

For a genuinely missing shoe-history field, a bounded SELECT-only check from the AlphaRunner repository can reuse these existing modules:

```typescript
import { loadCoachEnvironment } from './src/lib/coach/environment'
import postgres from 'postgres'
```

Obtain `databaseUrl` from `await loadCoachEnvironment()`, construct the client, and use parameterized tagged SQL with the already-resolved shoe UUID:

```sql
SELECT COUNT(*) AS runs, SUM(distance_km) AS km
FROM alpharunner.runs WHERE shoe_id = <parameter>;

SELECT r.date, o.comfort, o.notes
FROM alpharunner.shoe_observations o
JOIN alpharunner.runs r ON r.id = o.run_id
WHERE o.shoe_id = <parameter>
  AND COALESCE(o.notes, '') <> ''
  AND o.notes <> 'Assigned during Garmin import'
ORDER BY r.date DESC LIMIT 3;
```

These are SELECT-only supplements. All persistence stays in the supported confirmed-task importer. Prior generated observations can support mechanics history, but are not fresh user comfort or symptom reports. Expand the bounded observation window only when an actual coaching question requires it.

## Evidence and presentation boundaries

- Stored summary distance/pace can be rounded; use the unrounded feature values for calculations, then verify displayed headline metrics with `run-summary`.
- A slightly longer same-shoe run at similar pace supports repeatability, not a causal economy or fitness improvement. State changed duration and uncontrolled conditions.
- Do not probe staging directories just to recover metrics already available in features or verified summaries. If a genuinely missing descriptor/provenance field matters, inspect the supported adapter's evidence path rather than guessing a temporary filename.
- Keep raw CP/zone assumptions out of the result when calibration provenance is not established. Report validated source, coverage and inferred metadata units accurately.
