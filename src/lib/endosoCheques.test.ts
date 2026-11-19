import { describe, expect, it } from 'vitest'
import { calcularTotalesCheques, estadosChequeDisponibles, etiquetaEstadoCheque, type Cheque } from './cfo'

function cheque(p: Partial<Cheque> & { id: string; tipo: Cheque['tipo']; monto: number }): Cheque {
  return { banco: 'Nación', contraparte: 'X', fechaEmision: '2026-11-01', fechaCobro: '2026-12-01', estado: 'cartera', ...p } as Cheque
}

describe('endoso de cheques', () => {
  it('solo se puede endosar un cheque recibido', () => {
    // Un cheque propio no se endosa: ya salió de tus manos cuando lo emitiste.
    expect(estadosChequeDisponibles('recibido')).toContain('entregado')
    expect(estadosChequeDisponibles('emitido')).not.toContain('entregado')
  })

  it('se llama "Entregado (endosado)"', () => {
    expect(etiquetaEstadoCheque('entregado', 'recibido')).toBe('Entregado (endosado)')
  })

  it('un cheque entregado deja de ser un activo', () => {
    const totales = calcularTotalesCheques([
      cheque({ id: 'a', tipo: 'recibido', monto: 100_000 }),
      cheque({ id: 'b', tipo: 'recibido', monto: 300_000, estado: 'entregado' }),
    ])
    expect(totales.recibidosEnCartera).toBe(100_000)
    expect(totales.saldoNetoCheques).toBe(100_000)
  })
})
