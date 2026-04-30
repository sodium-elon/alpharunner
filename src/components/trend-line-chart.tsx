import * as React from 'react'
import { ChartContainer, type ChartConfig } from '~/components/ui/chart'

export type TrendChartPoint = {
  id: string
  date: string
  displayDate: string
  cadence: number | null
  pace: number
  speedKmh: number
  strideLengthM: number | null
  distanceKm: number
  avgHr: number | null
  workoutIntent: string
  shoeName?: string | null
  runCount?: number
}

export function formatTrendShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export function aggregateTrendPoints(points: TrendChartPoint[]): TrendChartPoint[] {
  const byDate = new Map<string, TrendChartPoint[]>()

  for (const point of points) {
    const existing = byDate.get(point.date)
    if (existing) {
      existing.push(point)
    } else {
      byDate.set(point.date, [point])
    }
  }

  return Array.from(byDate.entries()).map(([date, dayPoints]) => {
    const paceAverage = dayPoints.reduce((sum, point) => sum + point.pace, 0) / dayPoints.length
    const cadencePoints = dayPoints.filter((point) => point.cadence != null)
    const hrPoints = dayPoints.filter((point) => point.avgHr != null)
    const stridePoints = dayPoints.filter((point) => point.strideLengthM != null)
    const shoeNames = Array.from(new Set(dayPoints.map((point) => point.shoeName).filter(Boolean))) as string[]
    const workoutIntents = Array.from(new Set(dayPoints.map((point) => point.workoutIntent)))

    return {
      id: dayPoints.map((point) => point.id).join('__'),
      date,
      displayDate: formatTrendShortDate(date),
      cadence: cadencePoints.length
        ? cadencePoints.reduce((sum, point) => sum + (point.cadence ?? 0), 0) / cadencePoints.length
        : null,
      pace: paceAverage,
      speedKmh: 3600 / paceAverage,
      strideLengthM: stridePoints.length
        ? stridePoints.reduce((sum, point) => sum + (point.strideLengthM ?? 0), 0) / stridePoints.length
        : null,
      distanceKm: dayPoints.reduce((sum, point) => sum + point.distanceKm, 0),
      avgHr: hrPoints.length
        ? hrPoints.reduce((sum, point) => sum + (point.avgHr ?? 0), 0) / hrPoints.length
        : null,
      workoutIntent: workoutIntents.join(', '),
      shoeName: shoeNames.length ? shoeNames.join(', ') : null,
      runCount: dayPoints.length,
    }
  })
}

const chartConfig = {
  cadence: {
    label: 'Avg cadence',
    color: 'var(--chart-1, #2563eb)',
  },
  speedKmh: {
    label: 'Avg speed',
    color: 'var(--chart-2, #16a34a)',
  },
  strideLengthM: {
    label: 'Avg stride length',
    color: 'var(--chart-3, #f59e0b)',
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
            yAxisId="speedKmh"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => `${Number(value).toFixed(1)}`}
          />
          <YAxis yAxisId="strideLengthM" hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid rgb(229 231 235)',
              backgroundColor: 'rgb(255 255 255)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            }}
            formatter={(value: number | string, name: string) => {
              if (name === chartConfig.speedKmh.label) return [`${Number(value).toFixed(2)} km/h`, name]
              if (name === chartConfig.strideLengthM.label) return [`${Number(value).toFixed(2)} m`, name]
              return [value, name]
            }}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as TrendChartPoint | undefined
              if (!point) return ''
              const shoePart = point.shoeName ? ` • ${point.shoeName}` : ''
              const runCountPart = point.runCount && point.runCount > 1 ? ` • averaged from ${point.runCount} runs` : ''
              return `${point.date} • ${point.distanceKm.toFixed(2)} km • ${point.workoutIntent}${shoePart} • ${formatPace(point.pace)}${runCountPart}`
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
            yAxisId="speedKmh"
            type="monotone"
            dataKey="speedKmh"
            name={chartConfig.speedKmh.label}
            stroke="var(--color-speedKmh)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-speedKmh)' }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="strideLengthM"
            type="monotone"
            dataKey="strideLengthM"
            name={chartConfig.strideLengthM.label}
            stroke="var(--color-strideLengthM)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            dot={{ r: 4, fill: 'var(--color-strideLengthM)' }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

export function formatTrendPace(seconds: number) {
  return formatPace(seconds)
}
