# Import artifact verification and test environment isolation

Routine import verification: validate coaching JSON, execute the authorized task, require verified:true, read back exact date/activity/shoe and child counts, then delete temporary data. Do not run builds merely because a JSON file was created.

When a user explicitly requests suite verification:
1. Run the requested canonical command and inspect the actual failing assertion.
2. If a test asserts that a credential is absent but receives a fallback request, inspect its setup and the implementation's environment defaults. Check presence without revealing the value.
3. When inherited credentials explain the mismatch, isolate the test process rather than editing application code or saved credentials. For the observed OpenRouter absence test: `unset OPENROUTER_API_KEY; pnpm run test` in the test shell. Restore/reload authorized credentials separately if later live calls require them.
4. A wrapper such as `env -u OPENROUTER_API_KEY pnpm run test` can execute successfully without being recognized as canonical verification. If a subsequent verification prompt still cites the old failure, rerun the direct canonical command after shell environment preparation. Do not fabricate evidence or alter the tracker.
5. Report the passing suite, environment adjustment, and whether source code changed. Do not claim tests pass with the original contaminated environment.

This is a general isolation/retry technique, not a permanent claim that tests or credentials are broken. If failure persists with the required environment isolated, investigate the code; do not repeatedly unset unrelated variables.
