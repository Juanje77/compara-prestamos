const WHATSAPP_NUMBER = '5492392583117'
const DEFAULT_MESSAGE = 'Hola Juan! Vi FinCorp y quisiera asesoramiento sobre el sistema de gestión para mi negocio.'
const MENSAJE_PRESTAMOS = 'Hola Juan! Vi el comparador de préstamos y quisiera asesoramiento.'

export function buildWhatsAppLink(message: string = DEFAULT_MESSAGE) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.35A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 6.86 12.7l-.24.38.62 2.27-2.33-.62-.37.22A8.2 8.2 0 1 1 12 3.8Zm-3.1 3.9c-.2 0-.5.06-.77.36s-1 1-1 2.3 1.03 2.7 1.17 2.88c.15.19 2.02 3.2 5 4.35 2.48.96 2.98.77 3.52.72.54-.05 1.73-.7 1.97-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34-.29-.14-1.73-.85-2-.95-.26-.1-.46-.14-.66.15-.19.28-.75.94-.92 1.14-.17.19-.34.21-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.76-1.44-1.71-1.6-2-.17-.29-.02-.44.13-.58.13-.13.29-.34.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5Z" />
    </svg>
  )
}

export function WhatsAppFloatingButton() {
  return (
    <a
      href={buildWhatsAppLink(DEFAULT_MESSAGE)}
      target="_blank"
      rel="noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
      style={{ background: '#25D366', color: 'white' }}
    >
      <WhatsAppIcon size={28} />
    </a>
  )
}

export function WhatsAppBanner() {
  return (
    <div
      className="mb-8 flex flex-col items-start justify-between gap-3 rounded-xl border p-5 sm:flex-row sm:items-center"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          ¿Necesitás asesoramiento personalizado?
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Escribime y te ayudo a elegir la mejor opción para tu situación.
        </p>
      </div>
      <a
        href={buildWhatsAppLink(MENSAJE_PRESTAMOS)}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: '#25D366' }}
      >
        <WhatsAppIcon size={18} />
        Contactar por WhatsApp
      </a>
    </div>
  )
}
