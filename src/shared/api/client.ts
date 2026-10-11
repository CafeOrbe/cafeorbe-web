import { z } from 'zod'

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

export function configurarCliente(nuevoToken: string | null, alExpirar: (() => void) | null) {
  token = nuevoToken
  alExpirarSesion = alExpirar
}

const ErrorApiSchema = z.object({
  mensaje: z.string().optional(),
  campos: z.record(z.string()).optional()
}).passthrough()

export async function peticion<T>(
  metodo: string, 
  ruta: string, 
  cuerpo?: unknown,
  esquemaRespuesta?: z.ZodSchema<T> 
): Promise<T> {
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

    const errorParseado = json ? ErrorApiSchema.safeParse(json) : null
    const datosError = errorParseado?.success ? errorParseado.data : null

    const mensaje = datosError?.mensaje ?? `Error ${respuesta.status}`
    throw new ApiError(respuesta.status, mensaje, datosError?.campos ?? {})
  }
  
  if (esquemaRespuesta && json !== null) {
    return esquemaRespuesta.parse(json)
  }

  return json as T
}

export function peticionAlSalir(metodo: string, ruta: string): void {
  const cabeceras: Record<string, string> = {}
  if (token) cabeceras.Authorization = `Bearer ${token}`
  void fetch(`${BASE}${ruta}`, { method: metodo, headers: cabeceras, keepalive: true }).catch(() => undefined)
}

function safeJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}