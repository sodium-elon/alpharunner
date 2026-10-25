# Garmin Personal API Authentication

**Trigger:** `garmin-cli` exits 75 or reports a rejected Personal API key.

The pinned CLI uses only the Garmin Connect Personal API. No browser, email OTP, legacy login or scheduled session refresh is part of authentication. Never restart Garmin MCP, read a mailbox or switch token stores to recover access.

## Configuration and verification

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_ENV=/home/john/projects/alpharunner.workspace/env-profiles/local.env
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" auth check
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" activities list --limit 1 --start 0
```

`GARMIN_PERSONAL_API_KEY` is the canonical key setting; `GARMIN_TOKEN` is the supported migration alias. Keep the actual value in the existing protected external env file, never in arguments, chat, Git, skill text or logs. Keep the credential file mode 0600. AlphaRunner passes this env-file path to the CLI explicitly; a file that exists but is never loaded does not configure a subprocess.

The CLI exchanges the key for a bearer token and renews it on demand. `auth login` remains a compatibility command for explicit token acquisition, not password login. Cached bearer credentials are private and separate from the retired session format. A key change invalidates its old cached bearer credential.

## Failure rules

- One read-only auth check is sufficient. The CLI owns bounded token renewal and one authentication retry; do not add agent retry loops.
- If the key is missing, expired, revoked or still rejected, stop and report the sanitized error. John must manage his key through Garmin Connect; never request the secret in chat.
- HTTP 404 or an unsupported-capability error is not an authentication failure. Do not run auth commands repeatedly to recover calendar/readiness or unsupported workout writes.
- Personal API activity discovery uses date-filtered completed-activity search. Scheduled/adaptive workout calendar and training readiness are unavailable; preserve that missing-evidence state explicitly, never fabricate a plan or recovery score.
- FIT-based lap/zone staging retains the existing import contract. Do not manually synthesize zero-valued laps or zone data to get an import through.
- Authentication/read-only retrieval does not authorize a database import or change the confirmed date/shoe scope.
