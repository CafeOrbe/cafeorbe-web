const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Error de la API con el formato uniforme {status, mensaje, campos}. */
export class ApiError extends Error {
  readonly status: number
  readonly campos: Record<string, string>

  constructor(status: number, mensaje: string, campos: Record<string, string> = {}) {
    super(mensaje)
    this.status = status
    this.campos = campos
  }
}

let token: string | null = null
let alExpirarSesion: (() => void) | null = null

/** La sesión registra aquí el token vigente y qué hacer si el servidor responde 401. */
export function configurarCliente(nuevoToken: string | null, alExpirar: (() => void) | null) {
  token = nuevoToken
  alExpirarSesion = alExpirar
}

export async function peticion<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const cabeceras: Record<string, string> = {}
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
  if (token) cabeceras.Authorization = `Bearer ${token}`

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.')
  }

  if (respuesta.status === 401 && token) alExpirarSesion?.()

  const texto = await respuesta.text()
  const json = texto ? safeJson(texto) : null
  if (!respuesta.ok) {
    const mensaje = typeof json?.mensaje === 'string' ? json.mensaje : `Error ${respuesta.status}`
    throw new ApiError(respuesta.status, mensaje, (json?.campos as Record<string, string>) ?? {})
  }
  return json as T
}

/**
 * Petición que sobrevive al cierre de la pestaña (`keepalive`). No espera respuesta ni lanza errores:
 * sirve para avisar al servidor en `pagehide`, cuando la página ya no puede procesar nada.
 */
export function peticionAlSalir(metodo: string, ruta: string): void {
  const cabeceras: Record<string, string> = {}
  if (token) cabeceras.Authorization = `Bearer ${token}`
  try {
    void fetch(`${BASE}${ruta}`, { method: metodo, headers: cabeceras, keepalive: true }).catch(() => undefined)
  } catch {
    // El navegador puede rechazar la petición al descargar la página; el servidor se entera igual por LiveKit.
  }
}

function safeJson(texto: string): Record<string, unknown> | null {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}
