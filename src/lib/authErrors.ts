const MENSAJES: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email — probá iniciar sesión en vez de registrarte.',
  'auth/invalid-email': 'El email no parece válido.',
  'auth/weak-password': 'La contraseña es muy corta — usá al menos 6 caracteres.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
  'auth/too-many-requests': 'Demasiados intentos — esperá un momento antes de volver a probar.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/network-request-failed': 'Falló la conexión — revisá tu internet e intentá de nuevo.',
}

export function mensajeErrorAuth(error: unknown): string {
  const codigo = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return MENSAJES[codigo] ?? 'Ocurrió un error inesperado. Probá de nuevo en un momento.'
}
