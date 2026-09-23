import { describe, expect, it } from 'vitest'
import {
  MAX_BACKUPS_DRIVE,
  backupsAEliminar,
  cuerpoMultipart,
  faltaBackupDelDia,
  fechaDeArchivo,
  nombreArchivoBackup,
  type ArchivoDrive,
} from './googleDrive'

function archivo(nombre: string, id = nombre): ArchivoDrive {
  return { id, nombre, creadoEn: '2026-09-23T10:00:00Z' }
}

describe('nombreArchivoBackup', () => {
  it('pone la fecha adelante para que Drive los ordene solos', () => {
    expect(nombreArchivoBackup('Metalúrgica del Sur', '2026-09-23')).toBe('2026-09-23-fincorp-metalurgica-del-sur.json')
  })

  it('sin nombre de negocio no deja un guion colgando', () => {
    expect(nombreArchivoBackup('', '2026-09-23')).toBe('2026-09-23-fincorp.json')
    expect(nombreArchivoBackup('   ', '2026-09-23')).toBe('2026-09-23-fincorp.json')
  })
})

describe('fechaDeArchivo', () => {
  it('lee la fecha de un backup nuestro', () => {
    expect(fechaDeArchivo('2026-09-23-fincorp-negocio.json')).toBe('2026-09-23')
  })

  it('devuelve null con cualquier otro archivo', () => {
    expect(fechaDeArchivo('notas.txt')).toBeNull()
    expect(fechaDeArchivo('fincorp-2026-09-23.json')).toBeNull()
  })
})

describe('faltaBackupDelDia', () => {
  it('con una copia de hoy, no hace falta otra', () => {
    expect(faltaBackupDelDia([archivo('2026-09-23-fincorp.json')], '2026-09-23')).toBe(false)
  })

  it('con copias viejas nada más, falta la de hoy', () => {
    expect(faltaBackupDelDia([archivo('2026-09-22-fincorp.json')], '2026-09-23')).toBe(true)
  })

  it('sin nada, falta', () => {
    expect(faltaBackupDelDia([], '2026-09-23')).toBe(true)
  })
})

describe('backupsAEliminar', () => {
  it('mientras entren en el máximo, no borra nada', () => {
    const archivos = [archivo('2026-09-22-fincorp.json'), archivo('2026-09-23-fincorp.json')]
    expect(backupsAEliminar(archivos, 5)).toEqual([])
  })

  it('borra los más viejos primero', () => {
    const archivos = [
      archivo('2026-09-23-fincorp.json'),
      archivo('2026-09-21-fincorp.json'),
      archivo('2026-09-22-fincorp.json'),
    ]
    expect(backupsAEliminar(archivos, 2).map((a) => a.nombre)).toEqual(['2026-09-21-fincorp.json'])
  })

  it('nunca toca un archivo que no sea un backup nuestro', () => {
    const archivos = [archivo('apuntes.json'), archivo('2026-09-21-fincorp.json'), archivo('2026-09-22-fincorp.json')]
    expect(backupsAEliminar(archivos, 1).map((a) => a.nombre)).toEqual(['2026-09-21-fincorp.json'])
  })

  it('el máximo por defecto es el de la constante', () => {
    const archivos = Array.from({ length: MAX_BACKUPS_DRIVE + 3 }, (_, i) =>
      archivo(`2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}-fincorp.json`),
    )
    expect(backupsAEliminar(archivos)).toHaveLength(3)
  })
})

describe('cuerpoMultipart', () => {
  it('arma las dos partes que espera Drive, con el boundary de cierre', () => {
    const cuerpo = cuerpoMultipart({ name: 'x.json' }, '{"a":1}', 'BORDE')
    expect(cuerpo).toContain('--BORDE\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"x.json"}')
    expect(cuerpo).toContain('{"a":1}')
    expect(cuerpo.endsWith('--BORDE--\r\n')).toBe(true)
  })
})
