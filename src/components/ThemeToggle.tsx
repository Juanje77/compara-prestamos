import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { aplicarTema, temaEfectivo, type Tema } from '../lib/theme'
import { IconButton } from './IconButton'

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => temaEfectivo())

  function alternar() {
    const siguiente: Tema = tema === 'dark' ? 'light' : 'dark'
    aplicarTema(siguiente)
    setTema(siguiente)
  }

  return (
    <IconButton
      icon={tema === 'dark' ? Sun : Moon}
      label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={alternar}
    />
  )
}
