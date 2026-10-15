import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { accesoDeDueno, leerAcceso, type AccesoEmpresa } from './empresa'

/**
 * El acceso del usuario logueado: si es el dueño de la cuenta o un empleado, y de quién son los
 * datos que hay que leer.
 *
 * Se resuelve una sola vez por sesión, porque sale del token y el token no cambia solo. Después
 * de aceptar una invitación hay que llamar a `refrescar`: el token que el navegador tiene en la
 * mano todavía es el de antes, y sin renovarlo la app seguiría mostrando una cuenta vacía.
 */
export function useAcceso(): { acceso: AccesoEmpresa | null; cargando: boolean; refrescar: () => Promise<void> } {
  const { user } = useAuth()
  const [acceso, setAcceso] = useState<AccesoEmpresa | null>(null)
  const [cargando, setCargando] = useState(true)

  const refrescar = useCallback(async () => {
    if (!user) {
      setAcceso(null)
      setCargando(false)
      return
    }
    setAcceso(await leerAcceso(user, true))
  }, [user])

  useEffect(() => {
    if (!user) {
      setAcceso(null)
      setCargando(false)
      return
    }
    let cancelado = false
    setCargando(true)
    leerAcceso(user)
      .then((a) => {
        if (!cancelado) setAcceso(a)
      })
      .catch(() => {
        // leerAcceso ya no lanza, pero si algún día lo hiciera: dueño de su propia cuenta es el
        // lado seguro, porque no da acceso a datos de nadie más.
        if (!cancelado) setAcceso(accesoDeDueno(user.uid))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [user])

  return { acceso, cargando, refrescar }
}
