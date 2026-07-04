/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/app.css?url'
import { seo } from '~/utils/seo'

const appCssHref = import.meta.env.DEV ? '/src/app.css?direct' : appCss

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
          description: 'Dashboard and control center for John\'s running data.',
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
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="ar-topbar">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <div className="ar-wordmark">AlphaRunner</div>
              <span className="ar-label">Port {runtimePort}</span>
            </div>
            <nav className="flex items-center gap-2">
              <Link
                to="/"
                className="ar-nav-link"
                activeProps={{
                  className: 'ar-nav-link ar-nav-link-active',
                }}
                activeOptions={{ exact: true }}
              >
                Dashboard
              </Link>
              <Link
                to="/runs"
                className="ar-nav-link"
                activeProps={{
                  className: 'ar-nav-link ar-nav-link-active',
                }}
              >
                Runs
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
