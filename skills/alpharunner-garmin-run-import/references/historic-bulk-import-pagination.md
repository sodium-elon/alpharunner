# Historic discovery and bulk authorization

Bulk imports are separately scoped work, not an expansion of a single-run task. Use [the current retrieval contract](cli-and-db-query-pitfalls.md) for protected env-file propagation on every CLI invocation and [import evidence](import-evidence.md) for identity/approval/readback.

1. Bound the requested start/end dates and maximum pages before discovery. Request completed activities with explicit date filters, start offset and limit; inspect actual API errors instead of treating them as an empty page.
2. Parse each result as JSON; deduplicate numeric activity IDs across pages. Newest-first ordering is not proof of complete history. End only on the provider's actual exhaustion result; repeated pages or the configured bound mean incomplete discovery, not a unique candidate or complete import gap.
3. Filter actual running/treadmill sport metadata; do not count walking, strength or cycling as competing runs. Verify each selected numeric ID and local date against its activity detail.
4. Compare actual stored activity IDs and dates. Report missing-run count/date range and estimated work without inventing request counts or elapsed time guarantees. Do not merge activities into import-seed.json or run its importer to log them.
5. Obtain authorization for the actual batch and explicit shoe identity per run. If the current task tooling cannot express that scope (including an explicitly requested no-shoe case), report the limitation for separately scoped maintenance; never bypass it with direct SQL or an unreviewed script.
6. Prepare/authorize/analyze/import and verify each approved exact identity through the existing task workflow. Matching stored runs are verified, not overwritten. Stop/reconcile failed writes before retries. Deliver coaching and exact retained/cleaned artifact status, not merely a fetched activity count.
