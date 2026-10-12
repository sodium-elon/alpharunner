import { iconGlyphs } from './icon-glyphs'
import { cn } from '~/lib/utils'

export type AppIconName = keyof typeof iconGlyphs
export const appIconNames = Object.keys(iconGlyphs) as AppIconName[]

/** Shared Phosphor Bold library. Decorative by default; label meaningful standalone icons.
 * Keep interaction and visible labels on the surrounding button or link.
 */
export function AppIcon({
  name,
  size = 20,
  label,
  className,
}: {
  readonly name: AppIconName
  readonly size?: number
  readonly label?: string
  readonly className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('ar-icon', className)}
    >
      {label && <title>{label}</title>}
      {iconGlyphs[name].map((path) => <path key={path} d={path} />)}
    </svg>
  )
}
