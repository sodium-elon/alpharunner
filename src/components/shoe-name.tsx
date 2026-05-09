import { siAdidas, siLining, siNike, type SimpleIcon } from 'simple-icons'

type ShoeBits = {
  brand: string
  model: string
  variant?: string | null
}

type CustomBrandMark = {
  viewBox: string
  path: string
  iconClassName?: string
}

const sauconyMark: CustomBrandMark = {
  viewBox: '416 333 551 151',
  path: 'M 965.68106,371.56187 L 965.68106,371.52887 C 957.27806,365.80037 957.27806,365.75987 951.53306,362.29187 C 896.41256,328.88087 867.92906,324.95987 841.21106,333.88187 C 820.44356,340.83287 784.72856,369.10187 784.72856,369.10187 C 752.10806,390.86837 719.11706,426.83837 641.79356,422.63687 C 569.80256,418.74137 421.56206,380.24537 419.76956,379.75037 C 417.97856,379.22987 416.11406,380.56637 416.66606,382.67237 C 417.08756,384.26387 420.68606,392.16287 420.68606,392.16287 C 421.14056,393.23687 422.09756,393.48437 422.56856,393.69887 C 481.60106,417.38837 661.66106,483.41087 725.30006,483.41087 C 801.14606,483.41087 863.90006,378.11537 931.36856,378.11537 C 952.30106,378.11537 957.61706,378.86687 960.61256,378.89087 C 963.59306,379.14737 966.11006,378.24737 966.86006,375.62237 C 966.86006,375.62237 967.90106,373.43537 965.68106,371.56187 M 769.98656,439.05437 C 769.13606,443.33087 766.66856,446.98637 763.07756,449.38787 C 759.44606,451.81487 755.13056,452.63237 750.86306,451.81487 C 746.60306,450.92387 742.94606,448.48037 740.55356,444.88187 C 735.57656,437.40287 737.61506,427.32587 745.07606,422.34887 C 752.52956,417.39587 762.62456,419.43437 767.58506,426.87137 C 769.98656,430.48637 770.83706,434.81987 769.98656,439.05437 M 810.85256,417.60287 C 803.38256,422.56337 793.30406,420.50837 788.31956,413.07887 C 783.39956,405.59237 785.38856,395.49887 792.84206,390.55487 C 800.30456,385.61837 810.39806,387.64937 815.35856,395.06837 C 817.19906,397.79237 818.05706,400.93787 818.08256,403.99937 C 818.08256,409.27337 815.54006,414.45737 810.85256,417.60287 M 865.54256,375.47387 C 864.70106,379.72487 862.23356,383.42237 858.60206,385.78337 C 854.99456,388.21787 850.67756,389.05187 846.43556,388.19387 C 842.16806,387.34337 838.51106,384.86687 836.07656,381.28487 C 833.69906,377.66087 832.84106,373.34537 833.69906,369.09437 C 834.55706,364.83437 836.98406,361.16087 840.64856,358.77587 C 844.23956,356.36537 848.54756,355.50737 852.81506,356.36537 C 857.05856,357.20837 860.73056,359.67587 863.14106,363.29087 C 865.54256,366.89087 866.39306,371.21537 865.54256,375.47387',
  iconClassName: 'h-3 w-[18px]',
}

const iconByBrand: Record<string, SimpleIcon | undefined> = {
  adidas: siAdidas,
  nike: siNike,
  'li-ning': siLining,
  lining: siLining,
}

const customMarkByBrand: Record<string, CustomBrandMark | undefined> = {
  saucony: sauconyMark,
}

const paletteByBrand: Record<string, { bg: string; fg: string; fallback: string }> = {
  adidas: { bg: '#111111', fg: '#ffffff', fallback: 'A' },
  nike: { bg: '#111111', fg: '#ffffff', fallback: 'N' },
  'li-ning': { bg: '#d71920', fg: '#ffffff', fallback: 'LN' },
  lining: { bg: '#d71920', fg: '#ffffff', fallback: 'LN' },
  asics: { bg: '#183a8f', fg: '#ffffff', fallback: 'A' },
  saucony: { bg: '#ffffff', fg: '#b50938', fallback: 'S' },
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
  const customMark = customMarkByBrand[key]
  const palette = paletteByBrand[key] ?? { bg: '#475569', fg: '#ffffff', fallback: getFallbackLetters(brand) }

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-black/10 dark:ring-white/10 ${className ?? ''}`.trim()}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
      title={brand}
      aria-label={brand}
    >
      {customMark ? (
        <svg viewBox={customMark.viewBox} className={`${customMark.iconClassName ?? 'h-3.5 w-3.5'} fill-current`} aria-hidden="true">
          <path d={customMark.path} />
        </svg>
      ) : icon ? (
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
