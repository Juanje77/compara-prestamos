import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth, firebaseHabilitado } from './firebase'
import { borrarNegocioDataLocal } from './negocioData'
import { vaciarSemana } from './movimientosSemana'

interface AuthContextValue {
  user: User | null
  cargando: boolean
  habilitado: boolean
  registrarse: (email: string, password: string, nombre: string) => Promise<void>
  iniciarSesion: (email: string, password: string) => Promise<void>
  iniciarSesionConGoogle: () => Promise<void>
  cerrarSesion: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [cargando, setCargando] = useState(firebaseHabilitado)

  useEffect(() => {
    if (!auth) return
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setCargando(false)
    })
    return unsubscribe
  }, [])

  async function registrarse(email: string, password: string, nombre: string) {
    if (!auth) throw new Error('Firebase no está configurado todavía.')
    const credencial = await createUserWithEmailAndPassword(auth, email, password)
    if (nombre.trim()) await updateProfile(credencial.user, { displayName: nombre.trim() })
  }

  async function iniciarSesion(email: string, password: string) {
    if (!auth) throw new Error('Firebase no está configurado todavía.')
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function iniciarSesionConGoogle() {
    if (!auth) throw new Error('Firebase no está configurado todavía.')
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function cerrarSesion() {
    if (!auth) return
    await firebaseSignOut(auth)
    // Limpiamos la copia local para que, en un navegador compartido, la próxima persona
    // que use la app no vea ni un instante los datos de esta cuenta.
    borrarNegocioDataLocal()
    vaciarSemana()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        cargando,
        habilitado: firebaseHabilitado,
        registrarse,
        iniciarSesion,
        iniciarSesionConGoogle,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
