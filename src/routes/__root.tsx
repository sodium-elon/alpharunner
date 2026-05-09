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
      links: [{ rel: 'stylesheet', href: appCss }],
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
        <div className="p-4 flex items-center gap-4 text-lg border-b border-gray-200 dark:border-gray-800">
          <div className="font-semibold">
            AlphaRunner <span className="text-sm font-medium text-gray-500 dark:text-gray-400">({runtimePort})</span>
          </div>
          <Link
            to="/"
            activeProps={{
              className: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Dashboard
          </Link>
        </div>
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
