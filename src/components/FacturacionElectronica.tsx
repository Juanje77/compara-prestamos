import { useState } from 'react'
import { CONDICIONES_EMISOR, type DatosEmisorFiscal } from '../lib/cfo'
import { esCuitValido, limpiarCuit } from '../lib/cuit'
import { darDeAltaEmisor, ErrorFacturacion } from '../lib/facturacionApi'
import { Card } from './Card'

// Circuito de habilitación para emitir con CAE. Los pasos de ARCA salen del instructivo oficial de
// Sistemas 360; los de la API, de su documentación pública.
//
// Esta pantalla no maneja credenciales. El token de la API fiscal es de FinCorp y vive en el
// servidor: el cliente nunca abre una cuenta en el proveedor ni copia un token. Lo que hace acá es
// el trámite que sí es suyo e indelegable —el circuito de ARCA sobre su propio CUIT— y dar de alta
// ese CUIT como emisor, que es una llamada por detrás y no una cuenta más.

interface Paso {
  titulo: string
  detalle?: string
}

interface Etapa {
  id: string
  titulo: string
  resumen: string
  pasos: Paso[]
  /** Se muestra en un recuadro de advertencia al pie de la etapa. */
  ojo?: string
}

const ETAPAS: Etapa[] = [
  {
    id: 'adherir',
    titulo: 'Adherir Administración de Certificados Digitales',
    resumen:
      'Buscá primero el servicio en ARCA. Si ya aparece y te deja entrar, salteá esta etapa y pasá a la siguiente.',
    pasos: [
      { titulo: 'Iniciar sesión en ARCA con CUIT y clave fiscal.' },
      {
        titulo: 'Entrar a Administrador de Relaciones de Clave Fiscal.',
        detalle: 'Si no aparece en el menú, buscalo como "Servicios Administrativos Clave Fiscal".',
      },
      {
        titulo: 'Elegir el contribuyente que va a emitir.',
        detalle:
          'En una SA o SRL se administra desde el CUIT del representante, eligiendo a la empresa en el campo "Representado".',
      },
      {
        titulo: 'Crear una nueva relación o adherir el servicio.',
        detalle: 'Los botones son "Nueva Relación" y "ADHERIR SERVICIO".',
      },
      { titulo: 'Elegir ARCA como organismo.' },
      {
        titulo: 'Entrar en Servicios Interactivos y seleccionar Administración de Certificados Digitales.',
        detalle: 'En el listado figura como "Administre aquí sus Certificados Digitales para webservices".',
      },
      { titulo: 'Buscar el representante y confirmar la relación.' },
    ],
    ojo: 'Este servicio exige clave fiscal de nivel 3 como mínimo. Con nivel 2 no aparece en el listado.',
  },
  {
    id: 'claves',
    titulo: 'Generar la clave privada y el CSR',
    resumen:
      'La clave privada queda en tu poder y no se sube nunca a ARCA. El CSR sí: es el pedido de certificado.',
    pasos: [
      { titulo: 'Correr los dos comandos de abajo en una terminal.' },
      {
        titulo: 'Guardar produccion.key donde lo guardarías a una llave.',
        detalle: 'Si se pierde, hay que rehacer el certificado. Si se filtra, cualquiera puede facturar con tu CUIT.',
      },
    ],
    ojo: 'El serialNumber del CSR lleva el CUIT del contribuyente que emite. Ése es el dato que no se puede equivocar.',
  },
  {
    id: 'certificado',
    titulo: 'Obtener el certificado de producción',
    resumen: 'Se sube el CSR a ARCA y se descarga el .crt que corresponde.',
    pasos: [
      { titulo: 'Entrar a Administración de Certificados Digitales.' },
      { titulo: 'Seleccionar el CUIT y presionar "Agregar alias".' },
      { titulo: 'Poner un alias identificable y subir el archivo .csr.' },
      { titulo: 'Volver al listado, abrir el alias y descargar el certificado .crt.' },
    ],
    ojo: 'El .crt descargado tiene que corresponder a la misma clave privada con la que se generó el CSR. No mezclar archivos de intentos distintos.',
  },
  {
    id: 'wsfe',
    titulo: 'Autorizar el Web Service de Facturación Electrónica',
    resumen: 'El certificado tiene que quedar habilitado para operar el servicio. Sin esto, ARCA no deja emitir.',
    pasos: [
      { titulo: 'Volver a Administrador de Relaciones de Clave Fiscal.' },
      { titulo: 'Crear una nueva relación y buscar el servicio.' },
      { titulo: 'Elegir ARCA y entrar en Web Services (no en Servicios Interactivos).' },
      { titulo: 'Seleccionar Facturación Electrónica.' },
      { titulo: 'Buscar el computador fiscal, elegir el alias creado y confirmar.' },
    ],
    ojo: 'Es el paso que más se olvida. Sin él, el panel carga el certificado sin protestar y recién falla al validar contra ARCA.',
  },
  {
    id: 'panel',
    titulo: 'Entregar el certificado para dejarlo operativo',
    resumen: 'Último tramo, ya fuera de ARCA y sin cuentas nuevas que crear.',
    pasos: [
      { titulo: 'Tener a mano el certificado .crt y la clave privada .key generados arriba.' },
      {
        titulo: 'Confirmar el punto de venta habilitado para web services.',
        detalle: 'Es el que cargaste más arriba en los datos del contribuyente.',
      },
      {
        titulo: 'Escribinos para coordinar la entrega del certificado.',
        detalle: 'Es el único paso que todavía se hace a mano; estamos viendo cómo evitarlo del todo.',
      },
    ],
    ojo: 'El punto de venta tiene que estar habilitado para web services. El que se usa en Comprobantes en Línea es de otro tipo y ARCA rechaza la emisión.',
  },
]

interface Props {
  datos: DatosEmisorFiscal
  onCambiar: (datos: DatosEmisorFiscal) => void
}

/** Alta del CUIT como emisor. No crea ninguna cuenta para el cliente: es un registro dentro de la
 * cuenta de FinCorp, y la API lo verifica contra el padrón de ARCA antes de aceptarlo. */
function PanelEmisor({ datos, onCambiar }: Props) {
  const [dando, setDando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cuit = limpiarCuit(datos.cuit)
  const listo = esCuitValido(cuit)

  async function handleAlta() {
    setDando(true)
    setError(null)
    try {
      const { emisor } = await darDeAltaEmisor(cuit, datos.razonSocial)
      if (!emisor?.emisor_id) throw new Error('El alta no devolvió un emisor.')
      onCambiar({
        ...datos,
        emisorId: emisor.emisor_id,
        // La razón social del padrón manda sobre la tipeada a mano.
        razonSocial: emisor.razon_social || datos.razonSocial,
      })
    } catch (e) {
      setError(
        e instanceof ErrorFacturacion && e.status === 403
          ? 'La facturación electrónica es parte del plan Full.'
          : e instanceof Error
            ? e.message
            : 'No se pudo dar de alta el CUIT.',
      )
    } finally {
      setDando(false)
    }
  }

  if (datos.emisorId) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border p-3"
        style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--status-good-text)' }}>
          CUIT registrado para facturar
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Ya podés emitir desde Comprobantes, una vez completado el circuito de ARCA.
        </span>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {listo
            ? 'Tu CUIT todavía no está registrado para facturar.'
            : 'Completá arriba un CUIT válido para registrarlo.'}
        </span>
        <button
          type="button"
          onClick={handleAlta}
          disabled={!listo || dando}
          className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{
            background: listo ? 'var(--series-blue)' : 'var(--surface-1)',
            color: listo ? '#fff' : 'var(--text-muted)',
          }}
        >
          {dando ? 'Registrando…' : 'Registrar mi CUIT'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--status-critical)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(texto).then(
          () => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          },
          () => undefined,
        )
      }}
      className="shrink-0 rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }}
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Comando({ texto }: { texto: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border p-2"
      style={{ borderColor: 'var(--gridline)', background: 'var(--surface-1)' }}
    >
      <code
        className="flex-1 overflow-x-auto whitespace-pre text-xs"
        style={{ color: 'var(--text-primary)' }}
      >
        {texto}
      </code>
      <BotonCopiar texto={texto} />
    </div>
  )
}

function FilaEtapa({
  etapa,
  numero,
  completada,
  onAlternar,
  extra,
}: {
  etapa: Etapa
  numero: number
  completada: boolean
  onAlternar: () => void
  extra?: React.ReactNode
}) {
  const [abierta, setAbierta] = useState(false)

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={completada}
          onChange={onAlternar}
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-label={`Marcar como hecha la etapa ${numero}`}
        />
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          className="flex-1 text-left"
          aria-expanded={abierta}
        >
          <p
            className="text-sm font-medium"
            style={{
              color: completada ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: completada ? 'line-through' : undefined,
            }}
          >
            {numero}. {etapa.titulo}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {etapa.resumen}
          </p>
        </button>
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {abierta ? '▲' : '▼'}
        </span>
      </div>

      {abierta && (
        <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: 'var(--gridline)' }}>
          <ol className="ml-4 list-decimal space-y-1.5">
            {etapa.pasos.map((p) => (
              <li key={p.titulo} className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {p.titulo}
                {p.detalle && (
                  <span className="block" style={{ color: 'var(--text-secondary)' }}>
                    {p.detalle}
                  </span>
                )}
              </li>
            ))}
          </ol>

          {extra && <div className="mt-3 space-y-2">{extra}</div>}

          {etapa.ojo && (
            <p
              className="mt-3 rounded-md border-l-2 py-1 pl-2 text-xs"
              style={{ borderColor: 'var(--status-critical)', color: 'var(--text-secondary)' }}
            >
              {etapa.ojo}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function FacturacionElectronica({ datos, onCambiar }: Props) {
  const cuitLimpio = limpiarCuit(datos.cuit)
  const cuitOk = esCuitValido(cuitLimpio)
  const organizacion = (datos.razonSocial.trim() || 'MI_EMPRESA').toUpperCase().replace(/\s+/g, '_')

  const comandoKey = 'openssl genrsa -out produccion.key 2048'
  const comandoCsr = `openssl req -new \\
  -key produccion.key \\
  -subj "/C=AR/O=${organizacion}/CN=FINCORP/serialNumber=CUIT ${cuitLimpio || '20123456789'}" \\
  -out produccion.csr`

  const hechas = ETAPAS.filter((e) => datos.etapasCompletadas.includes(e.id)).length

  const alternarEtapa = (id: string) => {
    const etapasCompletadas = datos.etapasCompletadas.includes(id)
      ? datos.etapasCompletadas.filter((e) => e !== id)
      : [...datos.etapasCompletadas, id]
    onCambiar({ ...datos, etapasCompletadas })
  }

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Facturación electrónica
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Para emitir un comprobante con <strong>CAE</strong> hace falta habilitar el circuito una sola
          vez ante ARCA: adherir el servicio de certificados, generar la clave privada, obtener el
          certificado y autorizar el web service de facturación. Todo eso va sobre{' '}
          <strong>el CUIT que factura</strong>, no sobre el de FinCorp. No hace falta que abras
          cuenta en ningún otro lado: el servicio de facturación lo contratamos nosotros.
        </p>

        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Datos del contribuyente que emite
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="CUIT del emisor"
              value={datos.cuit}
              onChange={(e) => onCambiar({ ...datos, cuit: e.target.value })}
              className="w-44 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{
                borderColor: datos.cuit && !cuitOk ? 'var(--status-critical)' : 'var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Razón social"
              value={datos.razonSocial}
              onChange={(e) => onCambiar({ ...datos, razonSocial: e.target.value })}
              className="min-w-[200px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <select
              value={datos.condicion}
              onChange={(e) => onCambiar({ ...datos, condicion: e.target.value as DatosEmisorFiscal['condicion'] })}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              {CONDICIONES_EMISOR.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Punto de venta"
              value={datos.puntoVenta}
              onChange={(e) => onCambiar({ ...datos, puntoVenta: e.target.value.replace(/\D/g, '') })}
              className="w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          </div>
          {datos.cuit && !cuitOk && (
            <p className="mt-2 text-xs" style={{ color: 'var(--status-critical)' }}>
              El CUIT no pasa la validación del dígito verificador.
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Un monotributista emite siempre factura C. Un responsable inscripto emite A a otro
            inscripto y B al resto.
          </p>
        </div>

        <PanelEmisor datos={datos} onCambiar={onCambiar} />

        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Circuito de habilitación
          </p>
          <p className="text-xs" style={{ color: hechas === ETAPAS.length ? 'var(--status-good-text)' : 'var(--text-secondary)' }}>
            {hechas} de {ETAPAS.length} etapas
          </p>
        </div>

        <div className="space-y-2">
          {ETAPAS.map((etapa, i) => (
            <FilaEtapa
              key={etapa.id}
              etapa={etapa}
              numero={i + 1}
              completada={datos.etapasCompletadas.includes(etapa.id)}
              onAlternar={() => alternarEtapa(etapa.id)}
              extra={
                etapa.id === 'claves' ? (
                  <>
                    <Comando texto={comandoKey} />
                    <Comando texto={comandoCsr} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Los comandos ya vienen con tu razón social y tu CUIT. Cambiá{' '}
                      <code>CN=FINCORP</code> si querés identificar al sistema con otro nombre: ese
                      campo nombra al sistema, no al contribuyente.
                    </p>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      </Card>

    </div>
  )
}
