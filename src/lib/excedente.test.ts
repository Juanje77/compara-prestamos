import { describe, expect, it } from 'vitest'
import { MESES_COLCHON_SUGERIDO, TIPOS_INSTRUMENTO, calcularExcedenteDeCaja } from './excedente'

describe('calcularExcedenteDeCaja', () => {
  it('descuenta los meses de colchón antes de decir que sobra algo', () => {
    const r = calcularExcedenteDeCaja(10_000_000, 2_000_000, 3)
    expect(r.colchon).toBe(6_000_000)
    expect(r.excedente).toBe(4_000_000)
    expect(r.faltante).toBe(0)
  })

  it('si no llega a cubrir el colchón, no hay excedente: hay faltante', () => {
    const r = calcularExcedenteDeCaja(4_000_000, 2_000_000, 3)
    expect(r.excedente).toBe(0)
    expect(r.faltante).toBe(2_000_000)
    expect(r.proporcionOciosa).toBe(0)
  })

  it('dice qué parte de la caja está de más', () => {
    expect(calcularExcedenteDeCaja(10_000_000, 2_000_000, 3).proporcionOciosa).toBeCloseTo(0.4, 4)
  })

  it('sin caja no hay proporción que calcular, y no divide por cero', () => {
    const r = calcularExcedenteDeCaja(0, 2_000_000, 3)
    expect(r.proporcionOciosa).toBe(0)
    expect(r.excedente).toBe(0)
  })

  it('sin gastos fijos cargados no hay colchón, así que todo cuenta como excedente', () => {
    const r = calcularExcedenteDeCaja(5_000_000, 0, 3)
    expect(r.colchon).toBe(0)
    expect(r.excedente).toBe(5_000_000)
  })

  it('con cero meses de colchón, el excedente es toda la caja', () => {
    expect(calcularExcedenteDeCaja(5_000_000, 2_000_000, 0).excedente).toBe(5_000_000)
  })

  it('usa tres meses por defecto', () => {
    expect(MESES_COLCHON_SUGERIDO).toBe(3)
    expect(calcularExcedenteDeCaja(10_000_000, 1_000_000)).toEqual(
      calcularExcedenteDeCaja(10_000_000, 1_000_000, 3),
    )
  })
})

describe('TIPOS_INSTRUMENTO', () => {
  it('ninguno promete un rendimiento: los números los pone el asesor, no la pantalla', () => {
    for (const t of TIPOS_INSTRUMENTO) {
      const texto = `${t.nombre} ${t.plazo} ${t.paraQue} ${t.aTenerEnCuenta}`
      expect(texto).not.toMatch(/\d+\s*%/)
      expect(texto).not.toMatch(/TNA|TEA|rinde|ganás/i)
    }
  })

  it('cada uno aclara su contra, no solo para qué sirve', () => {
    for (const t of TIPOS_INSTRUMENTO) {
      expect(t.aTenerEnCuenta.length).toBeGreaterThan(20)
    }
  })
})
