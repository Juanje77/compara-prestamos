export type Tema = 'light' | 'dark'

const CLAVE = 'fincorp-theme'

/** Preferencia guardada explícitamente por el usuario, o null si todavía sigue al sistema. */
export function temaGuardado(): Tema | null {
  const valor = localStorage.getItem(CLAVE)
  return valor === 'light' || valor === 'dark' ? valor : null
}

export function sistemaPrefiereOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function temaEfectivo(): Tema {
  return temaGuardado() ?? (sistemaPrefiereOscuro() ? 'dark' : 'light')
}

/** `null` saca la preferencia guardada y vuelve a seguir el sistema. */
export function aplicarTema(tema: Tema | null) {
  if (tema) {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem(CLAVE, tema)
  } else {
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(CLAVE)
  }
}
