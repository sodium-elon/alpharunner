import { formatTrendPace } from '~/components/trend-line-chart'
import { RunDateCell, RunRowChevronCell, RunTableRow } from '~/components/run-table-row'
import { ShoeNameInline } from '~/components/shoe-name'

export type RunHistoryRow = {
  readonly id: string
  readonly date: string
  readonly distanceKm: number
  readonly pace: number
  readonly cadence: number | null
  readonly strideLengthM: number | null
  readonly avgHr: number | null
  readonly workoutIntent: string
  readonly shoe?: { readonly brand: string; readonly model: string; readonly variant: string | null } | null
}

/**
 * Run history table shared by the all-runs and shoe detail pages. Purely
 * presentational: hand it the rows for the window already on screen, newest
 * first, and it renders them as links into the run detail page.
 */
export function RunHistoryTable({
  rows,
  showShoe = false,
  emptyMessage = 'No runs in this period.',
}: {
  readonly rows: readonly RunHistoryRow[]
  readonly showShoe?: boolean
  readonly emptyMessage?: string
}) {
  if (rows.length === 0) {
    return <div className="ar-empty mt-4 h-24">{emptyMessage}</div>
  }

  return (
    <div className="ar-table-wrap">
      <table className="ar-table">
        <thead>
          <tr className="ar-table-head">
            <th className="font-medium">Date</th>
            <th className="font-medium">Distance</th>
            <th className="font-medium">Pace</th>
            {showShoe ? <th className="font-medium hidden @[26rem]:table-cell">Shoe</th> : null}
            <th className="font-medium hidden @[36rem]:table-cell">Cadence</th>
            <th className="font-medium hidden @[44rem]:table-cell">Stride</th>
            <th className="font-medium hidden @[44rem]:table-cell">HR</th>
            <th className="font-medium hidden @[36rem]:table-cell">Intent</th>
            <th className="w-4 pr-0">
              <span className="sr-only">Open run</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => (
            <RunTableRow key={run.id} runId={run.id}>
              <RunDateCell runId={run.id} date={run.date} />
              <td className="whitespace-nowrap text-xs @[26rem]:text-sm">{run.distanceKm.toFixed(2)} km</td>
              <td className="whitespace-nowrap text-xs @[26rem]:text-sm">{formatTrendPace(run.pace)}</td>
              {showShoe ? (
                <td className="hidden @[26rem]:table-cell">
                  {run.shoe ? (
                    <ShoeNameInline brand={run.shoe.brand} model={run.shoe.model} variant={run.shoe.variant} />
                  ) : (
                    'Unassigned'
                  )}
                </td>
              ) : null}
              <td className="whitespace-nowrap hidden @[36rem]:table-cell">{run.cadence ?? '—'}</td>
              <td className="whitespace-nowrap hidden @[44rem]:table-cell">
                {run.strideLengthM == null ? '—' : `${run.strideLengthM.toFixed(2)} m`}
              </td>
              <td className="whitespace-nowrap hidden @[44rem]:table-cell">{run.avgHr ?? '—'}</td>
              <td className="hidden @[36rem]:table-cell">{run.workoutIntent}</td>
              <RunRowChevronCell />
            </RunTableRow>
          ))}
        </tbody>
      </table>
    </div>
  )
}
