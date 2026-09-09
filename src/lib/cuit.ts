/** Valida el dígito verificador de un CUIT/CUIL argentino (11 dígitos). */
export function esCuitValido(valor: string): boolean {
  const limpio = valor.replace(/\D/g, '')
  if (!/^\d{11}$/.test(limpio)) return false

  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const digitos = limpio.split('').map(Number)
  const suma = multiplicadores.reduce((acc, m, i) => acc + m * digitos[i], 0)
  const resto = suma % 11
  const verificadorEsperado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto

  return verificadorEsperado === digitos[10]
}

export function formatearCuit(valor: string): string {
  const limpio = valor.replace(/\D/g, '').slice(0, 11)
  if (limpio.length <= 2) return limpio
  if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`
}

export function limpiarCuit(valor: string): string {
  return valor.replace(/\D/g, '')
}
