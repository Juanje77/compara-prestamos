interface Props {
  height?: number
}

export function FinkoLogo({ height = 32 }: Props) {
  return (
    <div
      style={{ height, width: height * 3.6, overflow: 'hidden' }}
      className="shrink-0"
    >
      <img
        src="/finko-logo.png"
        alt="Finko"
        style={{ height: '100%', width: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
    </div>
  )
}
