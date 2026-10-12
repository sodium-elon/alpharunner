/// <reference types="vite/client" />
import { AppIcon } from '~/components/app-icon'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/app.css?url'
import { seo } from '~/utils/seo'

const appCssHref = import.meta.env.DEV ? '/src/app.css?direct' : appCss
const RouterDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/react-router-devtools').then(
        ({ TanStackRouterDevtools }) => ({ default: TanStackRouterDevtools }),
      ),
    )
  : null

const getRuntimeInfo = createServerFn({ method: 'GET' }).handler(async () => ({
  runtimePort: process.env.PORT ?? 'unknown',
}))

function getAppTitle(runtimePort: string) {
  return `AlphaRunner (${runtimePort})`
}

export const Route = createRootRoute({
  loader: () => getRuntimeInfo(),
  head: ({ loaderData }) => {
    const runtimePort = loaderData?.runtimePort ?? 'unknown'

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ...seo({
          title: getAppTitle(runtimePort),
          description: "Dashboard and control center for John's running data.",
        }),
      ],
      links: [{ rel: 'stylesheet', href: appCssHref }],
    }
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  return <Outlet />
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { runtimePort } = Route.useLoaderData()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="ar-skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="ar-topbar">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <Link to="/" className="ar-wordmark">
                <span className="ar-brand-mark" aria-hidden="true">
                  <AppIcon name="open" size={18} />
                </span>{' '}
                AlphaRunner
              </Link>
            </div>
            <nav aria-label="Primary" className="flex items-center gap-2">
              <Link
                to="/"
                className="ar-nav-link"
                activeProps={{
                  className: 'ar-nav-link ar-nav-link-active',
                }}
                activeOptions={{ exact: true }}
              >
                <AppIcon name="overview" size={18} /> Overview
              </Link>
              <Link
                to="/runs"
                className="ar-nav-link"
                activeProps={{
                  className: 'ar-nav-link ar-nav-link-active',
                }}
              >
                <AppIcon name="history" size={18} /> Runs
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="ar-footer">
          <span className="ar-wordmark">AlphaRunner</span>
          <span>Your pace. Your progress.</span>
          <span className="ar-label">Port {runtimePort}</span>
        </footer>
        {RouterDevtools ? (
          <React.Suspense fallback={null}>
            <RouterDevtools position="bottom-right" />
          </React.Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
