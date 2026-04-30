import * as React from 'react'

export type ChartConfig = Record<
  string,
  {
    label?: string
    color?: string
  }
>

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig
  className?: string
  children: React.ReactNode
}) {
  const style = Object.fromEntries(
    Object.entries(config).flatMap(([key, value]) =>
      value.color ? [[`--color-${key}`, value.color]] : [],
    ),
  ) as React.CSSProperties

  return (
    <div
      data-slot="chart"
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}
