type LocationLike = {
  protocol: string
  hostname: string
  port: string
}

type GlobalWithLocation = typeof globalThis & {
  location?: LocationLike
}

export function getMockBaseUrl() {
  // On server: use process.env
  if (typeof process !== 'undefined' && process.env['PORT']) {
    const host = process.env['HOST'] ?? '127.0.0.1'
    const port = process.env['PORT']
    return `http://${host}:${port}`
  }

  // Browser: use current location (if available)
  const loc = (globalThis as GlobalWithLocation).location
  if (loc) {
    return `${loc.protocol}//${loc.hostname}:${loc.port}`
  }

  // Fallback
  return 'http://127.0.0.1:3000'
}
