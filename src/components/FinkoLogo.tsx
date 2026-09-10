const BLUE = '#2f6feb'
const NAVY = '#0f1f3d'

interface Props {
  height?: number
  showWordmark?: boolean
}

export function FinkoLogo({ height = 28, showWordmark = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg width={height} height={height} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
        <path d="M8 8h30a12 12 0 0 1-12 12H8z" fill={BLUE} />
        <path d="M8 22h22a12 12 0 0 1-12 12H8z" fill={BLUE} opacity="0.85" />
        <path d="M8 36c0-4.4 3.6-8 8-8v8a8 8 0 0 1-8 8z" fill={NAVY} />
      </svg>
      {showWordmark && (
        <span
          className="text-xl leading-none font-extrabold tracking-wide"
          style={{ color: NAVY, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
        >
          FINKO
        </span>
      )}
    </div>
  )
}
