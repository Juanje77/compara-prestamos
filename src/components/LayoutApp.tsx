import { Outlet } from 'react-router-dom'
import { WhatsAppFloatingButton } from './WhatsAppContact'

// El marco de las rutas de la aplicación.
//
// A diferencia de Layout, no pone barra del sitio, ni ancho máximo, ni pie: de eso se encarga
// AppShell, que necesita el ancho completo para su barra lateral. Lo único que queda acá es el
// botón de contacto, que vale en las dos.
export function LayoutApp() {
  return (
    <>
      <Outlet />
      <WhatsAppFloatingButton />
    </>
  )
}
