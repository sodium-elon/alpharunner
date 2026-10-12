import { AppIcon, type AppIconName } from './app-icon'
import type { ReactNode } from 'react'
import { Button } from '~/components/ui/button'

/** Layout-only building blocks. Routes own data, formatting, and selected views. */
export function PageIntro({
  eyebrow,
  icon,
  title,
  description,
  action,
}: {
  readonly icon?: AppIconName
  readonly eyebrow: string
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly action?: ReactNode
}) {
  return (
    <section className="ar-intro">
      <div>
        <p className="ar-page-kicker ar-icon-label">
          {icon && <AppIcon name={icon} size={18} />}
          {eyebrow}
        </p>
        <h1 className="ar-page-title">{title}</h1>
        {description && <p className="ar-page-copy">{description}</p>}
      </div>
      {action}
    </section>
  )
}

export function Metric({
  label,
  value,
  helper,
}: {
  readonly label: string
  readonly value: string
  readonly helper?: string
}) {
  return (
    <div className="ar-metric">
      <p className="ar-label">{label}</p>
      <p className="ar-stat-value">{value}</p>
      {helper && <p className="ar-helper">{helper}</p>}
    </div>
  )
}

export function SectionHeading({
  number,
  icon,
  title,
  description,
  action,
}: {
  readonly icon?: AppIconName
  readonly number: string
  readonly title: string
  readonly description?: string
  readonly action?: ReactNode
}) {
  return (
    <div className="ar-section-heading">
      <div className="flex items-start gap-4">
        <span className="ar-section-icon">
          {icon ? <AppIcon name={icon} size={22} /> : number}
        </span>
        <div>
          <h2>{title}</h2>
          {description && <p className="ar-helper mt-2">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function DetailDisclosure({
  title,
  icon,
  description,
  children,
  defaultOpen = false,
}: {
  readonly icon?: AppIconName
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
  readonly defaultOpen?: boolean
}) {
  return (
    <details className="ar-disclosure" open={defaultOpen || undefined}>
      <summary>
        <span>
          <span className="ar-disclosure-title ar-icon-label">
            {icon && <AppIcon name={icon} />}
            {title}
          </span>
          {description && (
            <span className="ar-helper block mt-1">{description}</span>
          )}
        </span>
        <AppIcon name="chevronDown" />
      </summary>
      <div className="ar-disclosure-content">{children}</div>
    </details>
  )
}

export function ViewSwitch({
  value,
  onValueChange,
}: {
  readonly value: 'history' | 'trends'
  readonly onValueChange: (value: 'history' | 'trends') => void
}) {
  return (
    <div className="ar-view-switch" role="group" aria-label="Display view">
      {(['history', 'trends'] as const).map((view) => (
        <Button
          key={view}
          variant="ghost"
          aria-pressed={value === view}
          onClick={() => onValueChange(view)}
        >
          <AppIcon name={view === 'history' ? 'history' : 'trends'} />
          {view === 'history' ? 'Run history' : 'Performance trends'}
        </Button>
      ))}
    </div>
  )
}

export function SessionSpotlight({
  date,
  activity,
  distance,
  pace,
  duration,
  action,
  children,
}: {
  readonly date: string
  readonly activity: string
  readonly distance: string
  readonly pace: string
  readonly duration: string
  readonly action: ReactNode
  readonly children?: ReactNode
}) {
  return (
    <section className="ar-spotlight">
      <div className="ar-spotlight-top">
        <span className="ar-page-kicker ar-icon-label">
          <AppIcon name="run" /> Latest session / {date}
        </span>
        <span className="ar-badge ar-badge-volt">{activity}</span>
      </div>
      <div className="ar-spotlight-body">
        <div>
          <h2 className="ar-distance">
            {distance}
            <span>km</span>
          </h2>
          <div className="ar-session-stats">
            <span>
              <span className="ar-label">Average pace</span>
              <strong>{pace}</strong>
            </span>
            <span>
              <span className="ar-label">Duration</span>
              <strong>{duration}</strong>
            </span>
          </div>
        </div>
        <div className="ar-spotlight-aside">
          {children}
          {action}
        </div>
      </div>
    </section>
  )
}

export function EquipmentCard({
  name,
  role,
  status,
  distance,
  stats,
  action,
}: {
  readonly name: ReactNode
  readonly role: string
  readonly status: string
  readonly distance: string
  readonly stats: readonly { label: string; value: string }[]
  readonly action: ReactNode
}) {
  return (
    <article className="ar-equipment">
      <div className="flex justify-between gap-3">
        <span className="ar-page-kicker">{role}</span>
        <span className="ar-badge">{status}</span>
      </div>
      <h3>{name}</h3>
      <p className="ar-equipment-distance">
        {distance}
        <span> km</span>
      </p>
      <dl className="ar-equipment-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="ar-label">{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="ar-equipment-action">
        {action}
        <AppIcon name="open" size={18} />
      </div>
    </article>
  )
}
