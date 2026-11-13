const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8085'

/** Cada cuánto se envía un PING para mantener viva la conexión. */
const INTERVALO_PING_MS = 15_000
/** Si tras un PING no llega nada en este tiempo, la conexión se da por muerta. */
const ESPERA_RESPUESTA_MS = 8_000
/** SEG-05: el servidor cerró la conexión porque la sesión se cerró o venció. No tiene sentido reconectar. */
export const CIERRE_SESION = 4401
/** SEG-03: el usuario quedó bloqueado por abuso; el bloqueo dura 60 s. */
export const CIERRE_BLOQUEO = 4429
const ESPERA_TRAS_BLOQUEO_MS = 60_000

export type EstadoConexion = 'conectando' | 'abierta' | 'cerrada'

/** Mensaje que envía el realtime-gateway: {tipo, subastaId, datos, secuencia?}. */
export interface MensajeSala {
  tipo: string
  subastaId: string
  datos: Record<string, unknown>
  /** REN-01: número de secuencia de los eventos de auction; crece con cada evento. */
  secuencia?: number
}

interface Oyentes {
  mensaje: (mensaje: MensajeSala) => void
  estado: (estado: EstadoConexion) => void
  /** SEG-05: la sesión ya no es válida (se cerró o venció en el servidor). */
  sesionTerminada?: () => void
}

/**
 * SEG-04: la URL lleva un ticket de un solo uso, nunca el token de sesión. Si la URL queda en un log del
 * servidor o de un proxy, el ticket ya se consumió y venció a los pocos segundos.
 */
function urlDeSalaSegura(subastaId: string, ticket: string): string {
  const url = `${WS_BASE}/ws/salas/${encodeURIComponent(subastaId)}?ticket=${encodeURIComponent(ticket)}`
  if (new URL(url).origin !== new URL(WS_BASE).origin) throw new Error('La sala apunta a un servidor no permitido')
  return url
}

/**
 * Cliente WebSocket único de la sala: pide un ticket nuevo antes de cada conexión, reconecta solo con espera
 * creciente, mantiene la conexión viva y descarta los eventos repetidos o atrasados.
 */
export class SalaSocket {
  private ws: WebSocket | null = null
  private cerrado = false
  private intentos = 0
  private ultimaSecuencia = -1
  private temporizadorPing: number | undefined
  private temporizadorRespuesta: number | undefined
  private temporizadorReintento: number | undefined

  constructor(
    private readonly subastaId: string,
    private readonly obtenerTicket: () => Promise<string>,
    private readonly oyentes: Oyentes,
  ) {
    // Valida el destino desde el principio: un subastaId que saque la URL del servidor no llega a pedir ticket.
    urlDeSalaSegura(subastaId, 'x')
  }

  async conectar(): Promise<void> {
    this.cerrado = false
    this.oyentes.estado('conectando')
    let ticket: string
    try {
      ticket = await this.obtenerTicket()
    } catch {
      // Sin ticket (red caída o servicio no disponible) se reintenta igual que si la conexión se hubiera caído.
      // Si la sesión venció, el cliente HTTP ya avisó y la página saldrá de la sala.
      this.reintentar()
      return
    }
    if (this.cerrado) return
    const ws = new WebSocket(urlDeSalaSegura(this.subastaId, ticket))
    this.ws = ws

    ws.onopen = () => {
      this.intentos = 0
      this.oyentes.estado('abierta')
      this.temporizadorPing = window.setInterval(() => this.latir(ws), INTERVALO_PING_MS)
    }
    ws.onmessage = (evento) => {
      // Cualquier mensaje prueba que la conexión sigue viva.
      window.clearTimeout(this.temporizadorRespuesta)
      this.temporizadorRespuesta = undefined
      let mensaje: MensajeSala
      try {
        mensaje = JSON.parse(evento.data as string) as MensajeSala
      } catch {
        // Un mensaje que no es JSON no debe romper la sala.
        return
      }
      // El PONG solo sirve para comprobar la conexión: no es un evento de la sala.
      if (mensaje.tipo === 'PONG') return
      // REN-01: un evento ya visto (reentrega del broker) o más viejo que el último se descarta.
      if (typeof mensaje.secuencia === 'number') {
        if (mensaje.secuencia <= this.ultimaSecuencia) return
        this.ultimaSecuencia = mensaje.secuencia
      }
      this.oyentes.mensaje(mensaje)
    }
    ws.onclose = (evento?: CloseEvent) => this.alCerrarse(ws, evento?.code)
  }

  /**
   * Envía el PING y vigila que llegue respuesta. Una conexión puede morir sin avisar (cambio de red, equipo
   * suspendido, corte intermedio): el navegador la sigue viendo abierta y la sala se queda congelada con el
   * temporizador corriendo. Si no llega nada a tiempo se descarta y se reconecta.
   */
  private latir(ws: WebSocket) {
    if (!this.enviar({ tipo: 'PING' }) || this.temporizadorRespuesta !== undefined) return
    this.temporizadorRespuesta = window.setTimeout(() => {
      this.temporizadorRespuesta = undefined
      // Cerrar una conexión muerta puede tardar en notificarse: se reconecta ya, sin esperar su onclose.
      ws.onclose = null
      ws.close()
      this.alCerrarse(ws)
    }, ESPERA_RESPUESTA_MS)
  }

  private alCerrarse(ws: WebSocket, codigo?: number) {
    if (this.ws !== ws) return
    this.ws = null
    window.clearInterval(this.temporizadorPing)
    window.clearTimeout(this.temporizadorRespuesta)
    this.temporizadorRespuesta = undefined
    this.oyentes.estado('cerrada')
    if (codigo === CIERRE_SESION) {
      this.cerrado = true
      this.oyentes.sesionTerminada?.()
      return
    }
    this.reintentar(codigo === CIERRE_BLOQUEO ? ESPERA_TRAS_BLOQUEO_MS : undefined)
  }

  private reintentar(esperaFija?: number) {
    if (this.cerrado) return
    const base = Math.min(1000 * 2 ** this.intentos++, 10_000)
    // Espera aleatoria añadida: si el servidor se reinicia, no reconectan todos los compradores a la vez.
    const jitter = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (base * 0.3)
    const espera = esperaFija ?? base + Math.floor(jitter)
    this.temporizadorReintento = window.setTimeout(() => void this.conectar(), espera)
  }

  enviar(mensaje: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(mensaje))
    return true
  }

  cerrar() {
    this.cerrado = true
    window.clearInterval(this.temporizadorPing)
    window.clearTimeout(this.temporizadorRespuesta)
    window.clearTimeout(this.temporizadorReintento)
    this.temporizadorRespuesta = undefined
    this.ws?.close()
  }
}
