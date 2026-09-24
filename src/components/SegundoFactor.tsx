import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { pedirCodigo, verificarCodigo } from '../lib/mfa'
import { Card } from './Card'
import { Button } from './Button'

// La pantalla del segundo factor: aparece solo en un dispositivo que todavía no se verificó.
//
// No decide nada: el servidor valida el código, cuenta los intentos y bloquea. Acá se muestra lo
// que el servidor contesta, tal cual, porque los mensajes de por qué no entró son parte de la
// seguridad —"quedan 2 intentos" le sirve al dueño y no le regala nada a quien está probando—.

interface Props {
  /** Se llama cuando el código se verificó y el token ya trae la marca nueva. */
  onVerificado: () => void
}

export function SegundoFactor({ onVerificado }: Props) {
  const [codigo, setCodigo] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [mail, setMail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const yaPidio = useRef(false)

  // El código se pide solo al abrir: llegar a esta pantalla ya significa que hace falta.
  useEffect(() => {
    if (yaPidio.current) return
    yaPidio.current = true
    void enviar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enviar() {
    setError(null)
    setOcupado(true)
    try {
      const { mail } = await pedirCodigo()
      setMail(mail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el código.')
    } finally {
      setOcupado(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (codigo.length !== 6) return
    setError(null)
    setOcupado(true)
    try {
      await verificarCodigo(codigo, recordar)
      onVerificado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código.')
      setCodigo('')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Card as="section" padding="lg">
        <ShieldCheck size={26} style={{ color: 'var(--series-blue)' }} aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Confirmá que sos vos
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Estás entrando desde un dispositivo nuevo, así que te mandamos un código
          {mail ? ` a ${mail}` : ' a tu mail'}. Vence en 10 minutos y se usa una sola vez.
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="mb-1 block">Código de 6 dígitos</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="tabular w-full rounded-lg border px-3 py-2 text-center text-2xl tracking-[0.4em]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            No volver a pedirlo en este dispositivo por 30 días
          </label>

          {error && (
            <p className="mt-3 text-sm" style={{ color: 'var(--status-critical)' }}>
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" variante="primario" disabled={ocupado || codigo.length !== 6}>
              {ocupado ? 'Verificando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              onClick={enviar}
              disabled={ocupado}
              className="text-sm underline disabled:opacity-60"
              style={{ color: 'var(--series-blue)' }}
            >
              Reenviar el código
            </button>
          </div>
        </form>

        <p className="mt-5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Si no pediste este código, alguien tiene tu contraseña: cambiala. Nadie de FinCorp te lo
          va a pedir por teléfono ni por WhatsApp.
        </p>
      </Card>
    </div>
  )
}
