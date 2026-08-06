import { ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon } from 'lucide-react'
import type * as React from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { ButtonGroup } from '~/components/ui/button-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

export type WindowPagerOption = {
  readonly value: string
  readonly label: string
  /** Secondary detail shown next to the label inside the dropdown. */
  readonly hint?: string
}

/**
 * Presentational period pager: step one window older/newer, jump straight to a
 * window by name, or return to the latest. Knows nothing about runs, routing or
 * data loading — the caller owns `value` and reacts to `onValueChange`.
 *
 * `options` must be ordered newest first, so "older" walks forwards through the
 * array and "newer" walks backwards.
 */
export function WindowPager({
  scopeLabel,
  options,
  value,
  onValueChange,
  summary,
  olderLabel = 'Older',
  newerLabel = 'Newer',
  className,
}: {
  readonly scopeLabel: string
  readonly options: readonly WindowPagerOption[]
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly summary?: React.ReactNode
  readonly olderLabel?: string
  readonly newerLabel?: string
  readonly className?: string
}) {
  const activeIndex = options.findIndex((option) => option.value === value)
  const olderOption = activeIndex >= 0 ? options[activeIndex + 1] : undefined
  const newerOption = activeIndex >= 1 ? options[activeIndex - 1] : undefined
  const latestOption = options[0]
  const isLatest = activeIndex === 0

  return (
    <section
      className={cn(
        'ar-card ar-card-pad flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
      aria-label={`${scopeLabel} selection`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="ar-label">{scopeLabel}</span>
        <ButtonGroup>
          <Button
            variant="outline"
            size="sm"
            aria-label={`${olderLabel} — ${olderOption?.label ?? 'none'}`}
            title={olderLabel}
            disabled={!olderOption}
            onClick={() => olderOption && onValueChange(olderOption.value)}
          >
            <ChevronLeftIcon />
          </Button>
          <Select
            items={options.map((option) => ({ value: option.value, label: option.label }))}
            value={value}
            onValueChange={(next) => {
              if (typeof next === 'string') onValueChange(next)
            }}
          >
            <SelectTrigger size="sm" className="min-w-44 font-medium" aria-label={`Select ${scopeLabel.toLowerCase()}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="w-auto min-w-64">
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span>{option.label}</span>
                    {option.hint ? <span className="ml-auto ar-helper">{option.hint}</span> : null}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            aria-label={`${newerLabel} — ${newerOption?.label ?? 'none'}`}
            title={newerLabel}
            disabled={!newerOption}
            onClick={() => newerOption && onValueChange(newerOption.value)}
          >
            <ChevronRightIcon />
          </Button>
        </ButtonGroup>

        {isLatest ? (
          <Badge variant="secondary" className="ar-label h-6 px-2.5">
            Latest
          </Badge>
        ) : latestOption ? (
          <Button variant="ghost" size="sm" onClick={() => onValueChange(latestOption.value)}>
            Jump to latest
            <ChevronsRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </div>

      {summary}
    </section>
  )
}

/**
 * Compact stat strip for the pager's trailing edge — describes the window the
 * pager currently points at.
 */
export function WindowPagerSummary({
  stats,
}: {
  readonly stats: readonly { readonly label: string; readonly value: string }[]
}) {
  return (
    <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="ar-label">{stat.label}</dt>
          <dd className="ar-stat-value-sm mt-1">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
