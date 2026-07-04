import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error('DefaultCatchBoundary Error:', error)

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            router.invalidate()
          }}
          className="rounded-sm bg-muted px-2 py-1 font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-[var(--tracking-caps)] text-muted-foreground"
        >
          Try Again
        </button>
        {isRoot ? (
          <Link
            to="/"
            className="rounded-sm bg-muted px-2 py-1 font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-[var(--tracking-caps)] text-muted-foreground"
          >
            Home
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-sm bg-muted px-2 py-1 font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-[var(--tracking-caps)] text-muted-foreground"
            onClick={(e) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go Back
          </Link>
        )}
      </div>
    </div>
  )
}
