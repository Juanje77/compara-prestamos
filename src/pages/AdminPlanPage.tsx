import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import type { PlanTier } from '../lib/plan'

const PLAN_LABEL: Record<PlanTier, string> = {
  basico: 'Básico',
  premium: 'Medio',
  full: 'Full',
}

/**
 * Página interna, sin link en la navegación: para asignarle a mano un plan a una cuenta de
 * prueba (por ejemplo la propia), sin pasar por Mercado Pago. Requiere conocer el ADMIN_SECRET
 * configurado en el servidor — sin eso, /api/admin-set-plan rechaza el pedido.
 */
export function AdminPlanPage() {
  const { user } = useAuth()
  const [secret, setSecret] = useState('')
  const [uid, setUid] = useState('')
  const [plan, setPlan] = useState<PlanTier>('full')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const uidEfectivo = uid.trim() || user?.uid || ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!secret.trim() || !uidEfectivo) return
    setEnviando(true)
    setMensaje(null)
    try {
      const resp = await fetch('/api/admin-set-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secret.trim(), uid: uidEfectivo, plan }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'No se pudo actualizar el plan.')
      setMensaje({ tipo: 'ok', texto: `Listo — el plan quedó en ${PLAN_LABEL[plan]}. Recargá /empresas para verlo.` })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'Ocurrió un error inesperado.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Asignar plan (uso interno)
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Solo para pruebas — hace falta el ADMIN_SECRET configurado en el servidor. No pasa por Mercado Pago.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            ADMIN_SECRET
          </span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            UID del usuario {user?.uid && <span style={{ color: 'var(--text-secondary)' }}>(vacío = tu propia cuenta)</span>}
          </span>
          <input
            type="text"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder={user?.uid ?? 'uid'}
            className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          {user?.email && (
            <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
              Sesión actual: {user.email}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Plan
          </span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanTier)}
            className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="basico">Básico</option>
            <option value="premium">Medio</option>
            <option value="full">Full</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={enviando || !secret.trim() || !uidEfectivo}
          className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--series-blue)' }}
        >
          {enviando ? 'Aplicando…' : 'Asignar plan'}
        </button>
      </form>

      {mensaje && (
        <p
          className="mt-4 rounded-lg border p-3 text-sm"
          style={{
            borderColor: mensaje.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)',
            color: mensaje.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)',
          }}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  )
}
