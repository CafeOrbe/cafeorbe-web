const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8085'

/** Cada cuánto se envía un PING para mantener viva la conexión. */
const INTERVALO_PING_MS = 15_000
/** Si tras un PING no llega nada en este tiempo, la conexión se da por muerta. */
const ESPERA_RESPUESTA_MS = 8_000

export type EstadoConexion = 'conectando' | 'abierta' | 'cerrada'

/** Mensaje que envía el realtime-gateway: {tipo, subastaId, datos}. */
export interface MensajeSala {
  tipo: string
  subastaId: string
  datos: Record<string, unknown>
}

interface Oyentes {
  mensaje: (mensaje: MensajeSala) => void
  estado: (estado: EstadoConexion) => void
}

/** Cliente WebSocket único de la sala: reconecta solo, con espera creciente, y mantiene la conexión viva. */
export class SalaSocket {
  private ws: WebSocket | null = null
  private cerrado = false
  private intentos = 0
  private temporizadorPing: number | undefined
  private temporizadorRespuesta: number | undefined
  private temporizadorReintento: number | undefined
  private readonly url: string

  constructor(subastaId: string, token: string, private readonly oyentes: Oyentes) {
    this.url = `${WS_BASE}/ws/salas/${subastaId}?token=${encodeURIComponent(token)}`
  }

  conectar() {
    this.cerrado = false
    this.oyentes.estado('conectando')
    const ws = new WebSocket(this.url)
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
      if (mensaje.tipo !== 'PONG') this.oyentes.mensaje(mensaje)
    }
    ws.onclose = () => this.alCerrarse(ws)
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

  private alCerrarse(ws: WebSocket) {
    if (this.ws !== ws) return
    this.ws = null
    window.clearInterval(this.temporizadorPing)
    window.clearTimeout(this.temporizadorRespuesta)
    this.temporizadorRespuesta = undefined
    this.oyentes.estado('cerrada')
    if (!this.cerrado) {
      const base = Math.min(1000 * 2 ** this.intentos++, 10_000)
      // Espera aleatoria añadida: si el servidor se reinicia, no reconectan todos los compradores a la vez.
      const espera = base + Math.floor(Math.random() * base * 0.3)
      this.temporizadorReintento = window.setTimeout(() => this.conectar(), espera)
    }
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
