import { AppIcon } from '~/components/app-icon'
import * as React from 'react'
import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="ar-shell">
      <p className="ar-page-kicker">404 / Off the route</p>
      <h1 className="ar-page-title">Find your way back.</h1>
      <div className="ar-page-copy">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <Link to="/" className="ar-cta">
        Back to overview <AppIcon name="open" size={18} />
      </Link>
    </main>
  )
}
