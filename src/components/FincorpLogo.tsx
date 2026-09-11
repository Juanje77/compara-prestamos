interface Props {
  height?: number
}

export function FincorpLogo({ height = 32 }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img
        src="/fincorp-icon.png"
        alt=""
        style={{ height, width: height * (393 / 398) }}
      />
      <span
        className="font-extrabold tracking-tight"
        style={{ fontSize: height * 0.62, lineHeight: 1 }}
      >
        <span style={{ color: 'var(--text-primary)' }}>FIN</span>
        <span style={{ color: 'var(--series-blue)' }}>CORP</span>
      </span>
    </div>
  )
}
