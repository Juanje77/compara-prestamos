import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// "Hay una versión nueva — Actualizar".
//
// La app se guarda a sí misma en el navegador para abrir rápido y andar sin internet. Eso tiene
// un costo: después de publicar una actualización, el primer refresh sigue mostrando la versión
// vieja, porque la nueva recién se está bajando de fondo. La única salida era que la persona
// supiera apretar Ctrl+Shift+R, que es justo lo que un usuario no tiene por qué saber. Peor: con
// un arreglo recién publicado, seguía viendo el error ya corregido.
//
// Antes la versión nueva tomaba el control sola (skipWaiting), pero eso cambia el código abajo de
// los pies de una pantalla ya abierta. Ahora espera, y es la persona la que decide cuándo —
// apretando el botón, que es lo que la activa y recarga.
//
// Recargar no pierde nada: lo cargado ya está en el navegador y en la nube.

export function AvisoVersionNueva() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayVersionNueva) return null

  return (
    <div
      // Abajo y al medio: arriba compite con la barra de la app, y a un costado pasa desapercibido.
      // z alto para que no quede tapado por un modal abierto.
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      role="status"
    >
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        Hay una versión nueva de FinCorp
      </span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
        style={{ background: 'var(--series-blue)', color: '#fff' }}
      >
        <RefreshCw size={14} aria-hidden="true" /> Actualizar
      </button>
      <button
        type="button"
        onClick={() => setHayVersionNueva(false)}
        aria-label="Ahora no"
        title="Ahora no"
        className="rounded-full p-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
