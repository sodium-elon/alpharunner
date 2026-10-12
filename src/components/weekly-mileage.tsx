import { AppIcon } from './app-icon'
import type { CSSProperties, ReactNode } from 'react'
import type { MileagePeriod, WeeklyMileage } from '~/lib/weekly-mileage'

/** Display only. The route supplies the current week, totals and action. */
export function WeeklyMileageCard({
  mileage,
  dateLabel,
  action,
  period = 'thisWeek',
  onPeriodChange,
}: {
  readonly mileage: WeeklyMileage
  readonly dateLabel: string
  readonly action?: ReactNode
  readonly period?: MileagePeriod
  readonly onPeriodChange?: (period: MileagePeriod) => void
}) {
  const maxDistance = Math.max(1, ...mileage.days.map((day) => day.distanceKm))
  return (
    <section className="ar-weekly-mileage" data-empty={mileage.runCount === 0}>
      <div className="ar-weekly-copy">
        <p className="ar-page-kicker ar-icon-label">
          <AppIcon name="calendar" /> {period === 'last7Days' ? 'Last 7 days' : 'This week'} / All shoes
        </p>
        <h2>Weekly mileage</h2>
        {onPeriodChange && (
          <div className="ar-mileage-period" role="group" aria-label="Mileage period">
            {([['last7Days', 'Last 7 days'], ['thisWeek', 'This week']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriodChange(value)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="ar-weekly-total">
          {mileage.totalDistanceKm.toFixed(2)} <span>km</span>
        </p>
        <p className="ar-weekly-context">
          {mileage.runCount} {mileage.runCount === 1 ? 'run' : 'runs'} logged ·{' '}
          {dateLabel}
        </p>
        <p className="ar-helper">
          {period === 'last7Days' ? 'Today and the previous 6 days' : 'Monday–Sunday'} · UTC · All shoes included
        </p>
        {action}
      </div>
      <div className="ar-weekly-days">
        {mileage.runCount === 0 && (
          <div className="ar-week-empty">
            <p className="ar-week-empty-title">{period === 'last7Days' ? 'No runs logged in the last 7 days.' : 'No runs logged this week yet.'}</p>
            <p className="ar-helper">Your daily distances will appear here after your first run.</p>
          </div>
        )}
        <p className="ar-label">Daily distance · km</p>
        <ol
          className="ar-week-bars"
          role="list"
          aria-label={period === 'last7Days' ? 'Daily mileage over the last 7 days' : 'Daily mileage this week'}
        >
          {mileage.days.map((day) => (
            <li
              key={day.date}
              className={day.isToday ? 'is-today' : undefined}
              data-future={day.isFuture}
              aria-label={`${day.label}, ${day.date}${day.isToday ? ', today' : ''}: ${day.isFuture ? 'upcoming' : `${day.distanceKm.toFixed(2)} kilometres, ${day.runCount} runs`}`}
            >
              <span className="ar-week-bar-value" aria-hidden="true">
                {day.isFuture ? '—' : day.distanceKm.toFixed(1)}
              </span>
              <span className="ar-week-bar-track" aria-hidden="true">
                {day.distanceKm > 0 && <span
                  className="ar-week-bar"
                  style={
                    {
                      '--bar-height': `${(day.distanceKm / maxDistance) * 100}%`,
                    } as CSSProperties
                  }
                />}
              </span>
              <span className="ar-week-day" aria-hidden="true">
                {day.label}
              </span>
              <span className="ar-week-today" aria-hidden="true">
                {day.isToday ? 'Today' : '\u00a0'}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
