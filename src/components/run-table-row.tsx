import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '~/lib/utils'

/**
 * A run row that behaves like a link to the run detail page.
 *
 * The accessible, keyboard-reachable target is the real `<Link>` rendered by
 * `RunDateCell` in the first cell — the row-level click handler is a pointer
 * convenience on top of it, so the row keeps its native `row` semantics for
 * assistive tech instead of masquerading as a link.
 */
export function RunTableRow({
  runId,
  className,
  onClick,
  ...props
}: React.ComponentProps<'tr'> & { readonly runId: string }) {
  const navigate = useNavigate()

  function handleClick(event: React.MouseEvent<HTMLTableRowElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return

    // Modified clicks (new tab/window) and clicks that landed on a real control
    // are left alone, as is a click that ends a text selection.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if ((event.target as HTMLElement).closest('a, button, input, label, select, textarea')) return
    if (window.getSelection()?.toString()) return

    void navigate({ to: '/run/$runId', params: { runId } })
  }

  return <tr {...props} className={cn('group/row ar-row-link', className)} onClick={handleClick} />
}

/** First cell of a `RunTableRow` — carries the actual link to the run. */
export function RunDateCell({ runId, date }: { readonly runId: string; readonly date: string }) {
  return (
    <td className="whitespace-nowrap text-xs @[26rem]:text-sm">
      <Link to="/run/$runId" params={{ runId }} className="ar-link font-medium">
        {date}
      </Link>
    </td>
  )
}

/** Trailing cell of a `RunTableRow` — hover affordance hinting the row is navigable. */
export function RunRowChevronCell() {
  return (
    <td className="w-4 pr-0 text-right">
      <ChevronRightIcon
        aria-hidden="true"
        className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100"
      />
    </td>
  )
}
