import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { api } from './api/endpoints'
import { configurarCliente } from './api/client'
import type { Rol, SesionRespuesta, Usuario } from './api/types'

const CLAVE = 'cafeorbe.sesion'
/** El servidor dio la sesión por terminada (401 o cierre 4401 del WebSocket). */
export const EVENTO_EXPIRADA = 'cafeorbe:sesion-expirada'

// 1. Definimos el esquema estricto con Zod
const SesionGuardadaSchema = z.object({
  token: z.string().min(1),
  usuario: z.object({
    id: z.string(),
    nombre: z.string(),
    rol: z.enum(['COMPRADOR', 'SUBASTADOR'])
  })
})

// 2. Inferimos la interfaz automáticamente (ya no necesitas escribir interface SesionGuardada)
type SesionGuardada = z.infer<typeof SesionGuardadaSchema>

interface ContextoSesion {
  usuario: Usuario | null
  /** true justo después del primer ingreso de un Comprador: hay que avisarle de la carga automática (HU-07). */
  bienvenidaPendiente: boolean
  /** SEG-01: acceso con el ID token que entregó Google. */
  iniciarSesionConGoogle: (idToken: string, rol: Rol) => Promise<Usuario>
  cerrarSesion: () => void
  bienvenidaMostrada: () => void
}

const Contexto = createContext<ContextoSesion | null>(null)

function leer(): SesionGuardada | null {
  try {
    const texto = sessionStorage.getItem(CLAVE)
    if (!texto) return null
    
    // safeParse no lanza errores si falla, solo devuelve { success: false }
    const resultado = SesionGuardadaSchema.safeParse(JSON.parse(texto))
    return resultado.success ? resultado.data : null
  } catch {
    return null
  }
}

function guardar(sesion: SesionGuardada | null) {
  try {
    if (sesion) {
      // parse() aquí limpia cualquier propiedad inyectada que no esté en el Schema
      const limpia = SesionGuardadaSchema.parse(sesion)
      sessionStorage.setItem(CLAVE, JSON.stringify(limpia))
    } else {
      sessionStorage.removeItem(CLAVE)
    }
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

  const olvidarSesion = useCallback(() => {
    guardar(null)
    fijarToken(null)
    setBienvenidaPendiente(false)
    setSesion(null)
  }, [])

  /** HU-02 y SEG-05: avisa al servidor, que invalida el token aunque no haya vencido, y luego limpia lo local. */
  const cerrarSesion = useCallback(() => {
    if (leer()) api.cerrarSesion()
    olvidarSesion()
  }, [olvidarSesion])

  // El servidor respondió 401: el token venció o ya no es válido. No hace falta avisarle.
  useEffect(() => {
    window.addEventListener(EVENTO_EXPIRADA, olvidarSesion)
    return () => window.removeEventListener(EVENTO_EXPIRADA, olvidarSesion)
  }, [olvidarSesion])

  // HU-02: con Atrás el navegador puede restaurar una página anterior tal como quedó (bfcache), con la sesión
  // todavía en memoria. Si ya se cerró la sesión, esa página también debe volver al acceso.
  useEffect(() => {
    const alRestaurar = (evento: PageTransitionEvent) => {
      if (evento.persisted && !leer()) olvidarSesion()
    }
    window.addEventListener('pageshow', alRestaurar)
    return () => window.removeEventListener('pageshow', alRestaurar)
  }, [olvidarSesion])

  const abrirSesion = useCallback((respuesta: SesionRespuesta) => {
    const nueva = SesionGuardadaSchema.parse({ 
      token: respuesta.token, 
      usuario: respuesta.usuario 
    })
    
    guardar(nueva)
    fijarToken(nueva.token)
    
    setBienvenidaPendiente(respuesta.nuevo && nueva.usuario.rol === 'COMPRADOR')
    setSesion(nueva)
    
    return nueva.usuario
  }, [])

  const iniciarSesionConGoogle = useCallback(
    async (idToken: string, rol: Rol) => abrirSesion(await api.iniciarSesionConGoogle(idToken, rol)),
    [abrirSesion],
  )

  const valor = useMemo<ContextoSesion>(
    () => ({
      usuario: sesion?.usuario ?? null,
      bienvenidaPendiente,
      iniciarSesionConGoogle,
      cerrarSesion,
      bienvenidaMostrada: () => setBienvenidaPendiente(false),
    }),
    [sesion, bienvenidaPendiente, iniciarSesionConGoogle, cerrarSesion],
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