import { siAdidas, siLining, siNike, type SimpleIcon } from 'simple-icons'

type ShoeBits = {
  brand: string
  model: string
  variant?: string | null
}

const iconByBrand: Record<string, SimpleIcon | undefined> = {
  adidas: siAdidas,
  nike: siNike,
  'li-ning': siLining,
  lining: siLining,
}

const paletteByBrand: Record<string, { bg: string; fg: string; fallback: string }> = {
  adidas: { bg: '#111111', fg: '#ffffff', fallback: 'A' },
  nike: { bg: '#111111', fg: '#ffffff', fallback: 'N' },
  'li-ning': { bg: '#d71920', fg: '#ffffff', fallback: 'LN' },
  lining: { bg: '#d71920', fg: '#ffffff', fallback: 'LN' },
  asics: { bg: '#183a8f', fg: '#ffffff', fallback: 'A' },
  saucony: { bg: '#1f5fbf', fg: '#ffffff', fallback: 'S' },
}

function normalizeBrand(brand: string) {
  return brand.trim().toLowerCase()
}

function getFallbackLetters(brand: string) {
  const key = normalizeBrand(brand)
  const configured = paletteByBrand[key]?.fallback
  if (configured) return configured

  return brand
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function formatShoeName({ brand, model, variant }: ShoeBits) {
  return `${brand} ${model}${variant ? ` ${variant}` : ''}`
}

export function BrandLogo({ brand, className }: { brand: string; className?: string }) {
  const key = normalizeBrand(brand)
  const icon = iconByBrand[key]
  const palette = paletteByBrand[key] ?? { bg: '#475569', fg: '#ffffff', fallback: getFallbackLetters(brand) }

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-black/10 dark:ring-white/10 ${className ?? ''}`.trim()}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
      title={brand}
      aria-label={brand}
    >
      {icon ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d={icon.path} />
        </svg>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-tight">{palette.fallback}</span>
      )}
    </span>
  )
}

export function ShoeNameInline({
  brand,
  model,
  variant,
  className,
  textClassName,
}: ShoeBits & {
  className?: string
  textClassName?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      <BrandLogo brand={brand} />
      <span className={textClassName}>{formatShoeName({ brand, model, variant })}</span>
    </span>
  )
}
