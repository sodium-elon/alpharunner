import * as React from 'react'
import { ChartContainer, type ChartConfig } from '~/components/ui/chart'

export type TrendChartPoint = {
  id: string
  date: string
  displayDate: string
  cadence: number | null
  pace: number
  distanceKm: number
  avgHr: number | null
  workoutIntent: string
  shoeName?: string | null
}

const chartConfig = {
  cadence: {
    label: 'Avg cadence',
    color: 'var(--chart-1, #2563eb)',
  },
  pace: {
    label: 'Avg pace',
    color: 'var(--chart-2, #16a34a)',
  },
} satisfies ChartConfig

function formatPace(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

export function TrendLineChart({ data }: { data: TrendChartPoint[] }) {
  const [chartLib, setChartLib] = React.useState<null | typeof import('recharts')>(null)

  React.useEffect(() => {
    let cancelled = false

    import('recharts').then((mod) => {
      if (!cancelled) setChartLib(mod)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!chartLib) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-gray-500 dark:text-gray-400">
        Loading chart…
      </div>
    )
  }

  const { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = chartLib

  return (
    <ChartContainer config={chartConfig} className="h-full w-full min-h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="displayDate" tickLine={false} tickMargin={10} axisLine={false} minTickGap={24} />
          <YAxis
            yAxisId="cadence"
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value) => `${value}`}
          />
          <YAxis
            yAxisId="pace"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => formatPace(value)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid rgb(229 231 235)',
              backgroundColor: 'rgb(255 255 255)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            }}
            formatter={(value: number | string, name: string) => {
              if (name === chartConfig.pace.label) return [formatPace(Number(value)), name]
              return [value, name]
            }}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as TrendChartPoint | undefined
              if (!point) return ''
              const shoePart = point.shoeName ? ` • ${point.shoeName}` : ''
              return `${point.date} • ${point.distanceKm.toFixed(2)} km • ${point.workoutIntent}${shoePart}`
            }}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            yAxisId="cadence"
            type="monotone"
            dataKey="cadence"
            name={chartConfig.cadence.label}
            stroke="var(--color-cadence)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-cadence)' }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line
            yAxisId="pace"
            type="monotone"
            dataKey="pace"
            name={chartConfig.pace.label}
            stroke="var(--color-pace)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-pace)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

export function formatTrendPace(seconds: number) {
  return formatPace(seconds)
}
