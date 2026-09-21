import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api/endpoints'
import { configurarCliente } from './api/client'
import type { Rol, Usuario } from './api/types'

const CLAVE = 'cafeorbe.sesion'
const EVENTO_EXPIRADA = 'cafeorbe:sesion-expirada'

interface SesionGuardada {
  token: string
  usuario: Usuario
}

interface ContextoSesion {
  usuario: Usuario | null
  /** true justo después del primer ingreso de un Comprador: hay que avisarle de la carga automática (HU-07). */
  bienvenidaPendiente: boolean
  iniciarSesion: (nombre: string, rol: Rol) => Promise<Usuario>
  cerrarSesion: () => void
  bienvenidaMostrada: () => void
}

const Contexto = createContext<ContextoSesion | null>(null)

function leer(): SesionGuardada | null {
  try {
    const texto = sessionStorage.getItem(CLAVE)
    return texto ? (JSON.parse(texto) as SesionGuardada) : null
  } catch {
    return null
  }
}

function guardar(sesion: SesionGuardada | null) {
  try {
    if (sesion) sessionStorage.setItem(CLAVE, JSON.stringify(sesion))
    else sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento disponible: la sesión vive solo en memoria.
  }
}

/** Avisa al cliente HTTP cuál es el token vigente. Se llama de forma síncrona para que las peticiones ya lo usen. */
function fijarToken(token: string | null) {
  configurarCliente(token, () => window.dispatchEvent(new Event(EVENTO_EXPIRADA)))
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionGuardada | null>(() => {
    const guardada = leer()
    fijarToken(guardada?.token ?? null)
    return guardada
  })
  const [bienvenidaPendiente, setBienvenidaPendiente] = useState(false)

  const cerrarSesion = useCallback(() => {
    guardar(null)
    fijarToken(null)
    setBienvenidaPendiente(false)
    setSesion(null)
  }, [])

  // El servidor respondió 401: el token venció o no es válido.
  useEffect(() => {
    window.addEventListener(EVENTO_EXPIRADA, cerrarSesion)
    return () => window.removeEventListener(EVENTO_EXPIRADA, cerrarSesion)
  }, [cerrarSesion])

  const iniciarSesion = useCallback(async (nombre: string, rol: Rol) => {
    const respuesta = await api.iniciarSesion(nombre, rol)
    const nueva = { token: respuesta.token, usuario: respuesta.usuario }
    guardar(nueva)
    fijarToken(nueva.token)
    setBienvenidaPendiente(respuesta.nuevo && respuesta.usuario.rol === 'COMPRADOR')
    setSesion(nueva)
    return respuesta.usuario
  }, [])

  const valor = useMemo<ContextoSesion>(
    () => ({
      usuario: sesion?.usuario ?? null,
      bienvenidaPendiente,
      iniciarSesion,
      cerrarSesion,
      bienvenidaMostrada: () => setBienvenidaPendiente(false),
    }),
    [sesion, bienvenidaPendiente, iniciarSesion, cerrarSesion],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion')
  return contexto
}

/** El token de la sesión activa, para abrir el WebSocket. */
export function tokenActual(): string | null {
  return leer()?.token ?? null
}
