// Quién puede ver qué, cuando una empresa tiene varios usuarios.
//
// Este archivo es el centro del asunto y por eso va aparte y se testea solo: define en qué
// BLOQUES se parte el negocio y qué bloques necesita cada módulo. De acá salen después las reglas
// de Firestore, así que una línea mal puesta acá es un sueldo que ve quien no debe.
//
// Por qué bloques y no "permiso por módulo" a secas: Firestore da acceso por documento, no por
// campo. Mientras todo el negocio viva en un solo documento, cualquiera que pueda leerlo lo lee
// entero, por más que la pantalla le muestre dos solapas. Partirlo es lo que convierte el permiso
// en algo real y no en un cartelito.

/** Los pedazos en los que se guarda el negocio. Cada uno es un documento aparte en Firestore. */
export type BloqueDatos = 'comercial' | 'tesoreria' | 'sueldos' | 'impuestos' | 'negocio'

export const BLOQUE_LABEL: Record<BloqueDatos, string> = {
  comercial: 'Ventas, compras y stock',
  tesoreria: 'Caja, bancos, cheques y deudas',
  sueldos: 'Sueldos y empleados',
  impuestos: 'Impuestos y datos fiscales',
  negocio: 'Números generales y patrimonio',
}

/** Qué campo del negocio va en qué bloque. Lo que no esté acá no se guarda: el test lo verifica
 * contra la lista real de campos, para que agregar uno nuevo y olvidarse no pase inadvertido. */
export const CAMPOS_POR_BLOQUE: Record<BloqueDatos, string[]> = {
  comercial: [
    'facturas',
    'pagos',
    'clientesManual',
    'clasificaciones',
    'remitos',
    'anticipos',
    'sectores',
    'productos',
    'movimientosStock',
    'movimientosDiarios',
  ],
  tesoreria: ['cuentas', 'deudas', 'cheques', 'movimientosTesoreria', 'movimientosBancarios'],
  sueldos: ['empleados'],
  impuestos: ['ivaManualPorMes', 'ingresosBrutosManualPorMes', 'monotributo', 'datosEmisorFiscal'],
  negocio: [
    'ingresos',
    'meses',
    'montos',
    'bienes',
    'realManualPorMes',
    'ventasManualPorMes',
    'tasaCrecimiento',
    'nombreNegocio',
    'actualizadoEn',
  ],
}

/** Los módulos que el dueño le puede asignar a un empleado. Son las solapas del sistema. */
export type Modulo =
  | 'dashboard'
  | 'facturas'
  | 'lectorFacturas'
  | 'puntoDeVenta'
  | 'facturacionElectronica'
  | 'ingresosGastos'
  | 'cobranzas'
  | 'cuentasCorrientes'
  | 'remitos'
  | 'margenes'
  | 'sueldos'
  | 'stock'
  | 'tesoreria'
  | 'proveedores'
  | 'clientes'
  | 'presupuesto'
  | 'cheques'
  | 'iva'
  | 'iibb'
  | 'monotributo'
  | 'patrimonio'
  | 'inversiones'
  | 'backup'

/**
 * Qué bloques necesita leer cada módulo para funcionar.
 *
 * Varios módulos necesitan más de uno, y eso tiene una consecuencia que conviene tener presente:
 * darle "Márgenes por sector" a alguien implica darle los sueldos, porque el margen de un sector
 * incluye el costo de la nómina asignada. No hay forma de mostrar ese número sin ese dato.
 */
export const BLOQUES_POR_MODULO: Record<Modulo, BloqueDatos[]> = {
  dashboard: ['negocio', 'comercial', 'tesoreria', 'sueldos'],
  facturas: ['comercial'],
  lectorFacturas: ['comercial'],
  puntoDeVenta: ['comercial', 'tesoreria'],
  facturacionElectronica: ['comercial', 'impuestos'],
  ingresosGastos: ['comercial'],
  cobranzas: ['comercial', 'tesoreria', 'sueldos'],
  cuentasCorrientes: ['comercial', 'tesoreria'],
  remitos: ['comercial'],
  margenes: ['comercial', 'sueldos'],
  sueldos: ['sueldos', 'tesoreria'],
  stock: ['comercial'],
  tesoreria: ['tesoreria', 'comercial'],
  proveedores: ['comercial'],
  clientes: ['comercial'],
  presupuesto: ['negocio', 'comercial', 'sueldos'],
  cheques: ['tesoreria', 'comercial'],
  iva: ['comercial', 'impuestos'],
  iibb: ['comercial', 'impuestos'],
  monotributo: ['comercial', 'impuestos'],
  patrimonio: ['negocio'],
  inversiones: ['negocio', 'tesoreria'],
  backup: ['negocio', 'comercial', 'tesoreria', 'sueldos', 'impuestos'],
}

/** Los módulos que no se le pueden sacar a nadie: sin esto no hay sistema usable. */
export const MODULOS_SIEMPRE: Modulo[] = []

/** Los bloques que necesita un empleado con estos módulos. Es lo que terminan diciendo las reglas. */
export function bloquesDe(modulos: Modulo[]): BloqueDatos[] {
  const bloques = new Set<BloqueDatos>()
  for (const m of modulos) for (const b of BLOQUES_POR_MODULO[m] ?? []) bloques.add(b)
  return [...bloques].sort()
}

/** Si un empleado con estos módulos puede entrar a uno puntual. */
export function puedeVer(modulos: Modulo[], modulo: Modulo): boolean {
  return modulos.includes(modulo)
}

/**
 * Qué módulos, además de los elegidos, terminan dando acceso a un bloque sensible. Sirve para
 * avisarle al dueño en la pantalla: elegir "Márgenes por sector" habilita los sueldos aunque no
 * haya tildado Sueldos, y es mejor que se entere al asignarlo y no después.
 */
export function modulosQueExponen(modulos: Modulo[], bloque: BloqueDatos): Modulo[] {
  return modulos.filter((m) => (BLOQUES_POR_MODULO[m] ?? []).includes(bloque))
}
