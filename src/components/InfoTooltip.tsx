interface Props {
  texto: string
}

/** Un "?" chico con tooltip nativo (title) al lado de un label técnico — para explicar en una
 * frase términos como DSO, alícuota o saldo técnico sin ocupar espacio en pantalla. */
export function InfoTooltip({ texto }: Props) {
  return (
    <span
      title={texto}
      aria-label={texto}
      className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full text-[9px] font-bold leading-none"
      style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
    >
      ?
    </span>
  )
}
