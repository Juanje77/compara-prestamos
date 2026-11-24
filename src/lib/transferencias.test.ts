import { describe, expect, it } from 'vitest'
import { armarTransferencia, patasDeLaTransferencia, validarTransferencia } from './transferencias'
import { aplicarMovimientoTesoreria, type CuentaBancaria } from './cfo'

let n = 0
const generarId = () => `id-${++n}`

const cuentas: CuentaBancaria[] = [
  { id: 'caja', nombre: 'Caja', saldo: 1_000_000 },
  { id: 'banco', nombre: 'Banco Nación', saldo: 500_000 },
  { id: 'usd', nombre: 'Caja dólares', saldo: 10_000, moneda: 'USD' },
]
const base = { desdeId: 'caja', haciaId: 'banco', monto: 300_000, fecha: '2026-11-24' }

describe('validarTransferencia', () => {
  it('acepta una transferencia normal', () => {
    expect(validarTransferencia(base, cuentas)).toBe(null)
  })

  it('rechaza la misma cuenta de los dos lados', () => {
    expect(validarTransferencia({ ...base, haciaId: 'caja' }, cuentas)).toBe('misma-cuenta')
  })

  it('rechaza importe cero o negativo', () => {
    expect(validarTransferencia({ ...base, monto: 0 }, cuentas)).toBe('monto-invalido')
    expect(validarTransferencia({ ...base, monto: -5 }, cuentas)).toBe('monto-invalido')
  })

  it('entre monedas distintas exige el importe que entra', () => {
    // El tipo de cambio de una compra de dólares es de esa operación, no del día: no se adivina.
    expect(validarTransferencia({ ...base, haciaId: 'usd' }, cuentas)).toBe('falta-monto-destino')
    expect(validarTransferencia({ ...base, haciaId: 'usd', montoDestino: 200 }, cuentas)).toBe(null)
  })
})

describe('armarTransferencia', () => {
  it('genera la salida y la entrada, atadas por el mismo id', () => {
    const r = armarTransferencia(base, cuentas, generarId)!
    const [salida, entrada] = r.movimientos
    expect(salida).toMatchObject({ cuentaId: 'caja', tipo: 'egreso', monto: 300_000, origen: 'transferencia' })
    expect(entrada).toMatchObject({ cuentaId: 'banco', tipo: 'ingreso', monto: 300_000, origen: 'transferencia' })
    expect(salida.transferenciaId).toBe(entrada.transferenciaId)
  })

  it('el concepto nombra la otra cuenta, que es lo que uno quiere leer en cada detalle', () => {
    const [salida, entrada] = armarTransferencia(base, cuentas, generarId)!.movimientos
    expect(salida.concepto).toBe('Transferencia a Banco Nación')
    expect(entrada.concepto).toBe('Transferencia de Caja')
  })

  it('suma el detalle que escriba la persona', () => {
    const [salida] = armarTransferencia({ ...base, concepto: 'pago proveedores' }, cuentas, generarId)!.movimientos
    expect(salida.concepto).toBe('Transferencia a Banco Nación — pago proveedores')
  })

  it('no cambia el total del negocio: lo que sale de una entra en la otra', () => {
    const r = armarTransferencia(base, cuentas, generarId)!
    const despues = r.movimientos.reduce(aplicarMovimientoTesoreria, cuentas)
    expect(despues.find((c) => c.id === 'caja')?.saldo).toBe(700_000)
    expect(despues.find((c) => c.id === 'banco')?.saldo).toBe(800_000)
    const totalAntes = cuentas.filter((c) => c.moneda !== 'USD').reduce((s, c) => s + c.saldo, 0)
    const totalDespues = despues.filter((c) => c.moneda !== 'USD').reduce((s, c) => s + c.saldo, 0)
    expect(totalDespues).toBe(totalAntes)
  })

  it('entre monedas distintas, cada cuenta se mueve en la suya', () => {
    const r = armarTransferencia({ ...base, haciaId: 'usd', monto: 1_400_000, montoDestino: 1_000 }, cuentas, generarId)!
    const despues = r.movimientos.reduce(aplicarMovimientoTesoreria, cuentas)
    expect(despues.find((c) => c.id === 'caja')?.saldo).toBe(-400_000)
    expect(despues.find((c) => c.id === 'usd')?.saldo).toBe(11_000)
  })

  it('no arma nada si los datos no sirven', () => {
    expect(armarTransferencia({ ...base, haciaId: 'caja' }, cuentas, generarId)).toBe(null)
  })
})

describe('patasDeLaTransferencia', () => {
  it('encuentra las dos patas para poder borrarlas juntas', () => {
    // Borrar la salida y dejar la entrada sería crear plata de la nada.
    const { movimientos } = armarTransferencia(base, cuentas, generarId)!
    const otros = [{ ...movimientos[0], id: 'suelto', transferenciaId: undefined }]
    expect(patasDeLaTransferencia(movimientos[0], [...movimientos, ...otros])).toHaveLength(2)
  })

  it('un movimiento común es solo él mismo', () => {
    const suelto = { id: 'x', cuentaId: 'caja', tipo: 'ajuste' as const, monto: 1, fecha: '2026-11-24', origen: 'manual' as const }
    expect(patasDeLaTransferencia(suelto, [suelto])).toEqual([suelto])
  })
})
