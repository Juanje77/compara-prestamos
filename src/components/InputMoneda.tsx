import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (value: number) => void
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  id?: string
  title?: string
}

function formatear(n: number): string {
  return n === 0 ? '' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

/** Interpreta el formato es-AR: "." separa miles, "," separa decimales. */
function limpiarYParsear(texto: string): number {
  const limpio = texto.trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  if (limpio === '' || limpio === '-') return 0
  const n = Number(limpio)
  return Number.isFinite(n) ? n : 0
}

/**
 * Input de montos con separador de miles (formato es-AR): el texto se edita siempre en el lugar
 * (sin cambiar de "modo" al hacer foco, para evitar carreras con el valor que llega del padre),
 * y se reformatea prolijo recién al perder el foco. Un valor de 0 se muestra vacío, para no
 * confundir un campo recién agregado con uno que ya tiene "$0" cargado a propósito.
 */
export function InputMoneda({ value, onChange, className, style, placeholder, id, title }: Props) {
  const [texto, setTexto] = useState(() => formatear(value))
  const enfocadoRef = useRef(false)

  useEffect(() => {
    if (!enfocadoRef.current) setTexto(formatear(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      title={title}
      placeholder={placeholder}
      value={texto}
      onFocus={() => {
        enfocadoRef.current = true
      }}
      onChange={(e) => {
        setTexto(e.target.value)
        onChange(limpiarYParsear(e.target.value))
      }}
      onBlur={() => {
        enfocadoRef.current = false
        setTexto(formatear(value))
      }}
      className={className}
      style={style}
    />
  )
}
