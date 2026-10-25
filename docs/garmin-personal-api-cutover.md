# Garmin Personal API cutover

## Release scope

Replace the CLI's legacy password/session/email-MFA authentication with the official Personal API backend, preserve command names and staged `{activities:[{listItem,detail,splits,hrZones}]}` contract, and wire AlphaRunner's existing Coach gateway to it. Source candidates are not installed production releases; release requires the project's normal exact-head approval and verified main synchronization.

## Credentials and transport

- Private key: `GARMIN_PERSONAL_API_KEY`, migration alias `GARMIN_TOKEN`, in `/home/john/projects/alpharunner.workspace/env-profiles/local.env`.
- CLI invocation: existing pinned executable, `--env-file` pointing to that protected file, existing `--tokenstore` directory containing a separate Personal API bearer cache.
- No browser, password login, mailbox MFA, MCP transport or keepalive job is a fallback.
- The CLI renews bearer tokens on demand, protects cached credentials and bounds retry. The personal key still expires/revokes and must be managed through Garmin Connect.
- Activity date search replaces completed-activity discovery via the unavailable calendar. Missing calendar/adaptive plan and training-readiness context stays explicitly unknown; do not claim there is no active plan.
- Sleep uses the supported Personal API route with consumer-compatible wrapping. Original FIT data supplies missing lap/zone endpoints with validated fields and units.

## Verification before activation

1. Run CLI unit tests from the final frozen candidate and AlphaRunner tests/typecheck without production DB writes.
2. Exercise the real candidate CLI with no legacy credentials or token cache dependency: auth check, date-filtered list, get/details, sleep, stage.
3. Compare exact identity/date, lap counts/distance/duration, HR-zone durations, record timestamps and descriptor-index-normalized telemetry. Validate developer source identity separately; do not call equal unlabeled watts Stryd proof.
4. Exercise the actual AlphaRunner gateway's read-only find/fetch path with the candidate CLI and explicit external env file. Preserve staging contract/date and current-request safeguards.
5. Require independent source review and publish complete PRs. Do not turn an open PR into a production deployment.

## Retirement after replacement release

The authorized retirement target is the six-hour Coder job named `Garmin service session proactive refresh`, the Garmin MCP registrations in Coder/Sportscoach, the MCP service and the obsolete AlphaRunner startup dependency. Preserve unrelated cron jobs/services and retain health records. Do not delete unrelated mailbox configuration or private credentials as collateral cleanup.

- Re-list Coder jobs using `hermes --profile coder cron list --all`; remove the exact named job with its freshly observed ID using the CLI. Do not run it during retirement.
- Remove only the inspected MCP registrations: `hermes --profile coder mcp remove garmin-mcp` and `hermes --profile sportscoach mcp remove garmin_mcp`.
- Install `deploy/alpharunner.service` from approved released AlphaRunner main, removing MCP from After/Wants while retaining PostgreSQL/network dependencies. Align the wrapper reference copy with the same released file.
- Stop/disable only `garmin-mcp.service`; remove its retired Coder wrapper from active scripts after preserving relevant operational evidence. Do not delete the canonical repository or archival health data as a shortcut.
- Activate the scoped consumer/config changes through supported gateway lifecycle commands as needed; no unsolicited voice tests or unrelated gateway restarts. If a restart is denied, do not bypass it and do not claim activation.
- Re-list cron, MCP registrations and service state, check AlphaRunner readiness, then exercise the pinned production CLI and Coach read-only path. Confirm no legacy source imports or executable references remain in the active CLI/guidance.

## Capabilities intentionally not fabricated

Personal API does not currently expose all former MCP capabilities. Calendar/adaptive recommendations, training readiness and unsupported workout writes must fail explicitly or remain unknown. Command names may remain for interface compatibility, but unsupported data is never synthesized and cannot trigger legacy authentication.
