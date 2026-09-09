const NAVY = '#16305c'

export function BrandHeader() {
  return (
    <div className="mb-6 flex items-center gap-4">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="54" height="54" rx="10" fill="none" stroke={NAVY} strokeWidth="2" />
        <text
          x="28"
          y="38"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="26"
          fill={NAVY}
        >
          JC
        </text>
      </svg>
      <div className="border-l pl-4" style={{ borderColor: 'var(--border)' }}>
        <p
          className="text-xl leading-tight font-semibold"
          style={{ color: NAVY, fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Juan Costantini
        </p>
        <p className="text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>
          Contador Público · MP: T20F94
        </p>
        <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
          Asesoramiento impositivo, contable y financiero
        </p>
      </div>
    </div>
  )
}
