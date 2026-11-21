// Credential/process boundaries intentionally discard the original error and
// cause: either may contain paths, argv, tokens, stdout, or private responses.
// Only pass a public message assembled from allowlisted metadata. Unlike Error,
// this type does not accept ErrorOptions, preventing accidental cause retention.
export class SanitizedError extends Error {
  constructor(message: string) {
    super(message)
  }
}
