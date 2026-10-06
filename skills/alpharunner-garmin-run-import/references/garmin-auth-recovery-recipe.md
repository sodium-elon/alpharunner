# Garmin CLI Auth Recovery Recipe

**Trigger:** `garmin-cli` exits 75, reports an invalid/expired session, returns 401, or `auth check` fails.

Use the pinned executable, CLI-owned credential file, and shared token store:

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_ENV=/home/john/projects/garmin-cli.workspace/env-profiles/local.env
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
```

## Recovery

1. Check before logging in:

```bash
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" auth check
```

2. If and only if that check fails because authentication is required, run one bounded login:

```bash
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" auth login
```

The CLI performs native Garmin authentication through `garminconnect`/`garth`. When Garmin requests MFA, it automatically reads only a fresh Garmin OTP from Gmail using `GARMIN_GMAIL_APP_PASSWORD`. It arms the mailbox waiter before login so an OTP that arrives quickly is not missed. Credentials and OTPs must never be printed or copied into chat.

No daemon or service restart is involved.

## Verification

A successful login is not sufficient by itself. Verify both the session and one authenticated read:

```bash
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" auth check
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" activities list --limit 1 --start 0
```

Completion requires exit 0 from both commands and valid JSON stdout. Diagnostics belong on stderr.

## Failure rules

- Do not pre-fetch or manually extract an MFA code.
- Do not set `GARMIN_EMAIL_CODE`.
- The canonical `garmin-mcp.service` is versioned with the workspace and may be restarted only after clean-main deployment checks pass.
- Do not substitute FIT/GPX for the requested authenticated operation.
- Do not retry repeatedly. If login reports `INVALID CODE` or times out waiting for the fresh email, retry the complete CLI login once so Garmin issues a new code. If the second attempt fails, report the exact redacted blocker and stop.
- If credentials are missing, repair only `/home/john/projects/garmin-cli.workspace/env-profiles/local.env`; keep its mode `0600` and the directory mode `0700`.

## Paths

- CLI: `/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli`
- Credential file: `/home/john/projects/garmin-cli.workspace/env-profiles/local.env`
- Token store: `/home/john/.garmin-cli/tokens`
