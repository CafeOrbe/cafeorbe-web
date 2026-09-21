const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8085'

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
      this.temporizadorPing = window.setInterval(() => this.enviar({ tipo: 'PING' }), 25_000)
    }
    ws.onmessage = (evento) => {
      try {
        this.oyentes.mensaje(JSON.parse(evento.data as string) as MensajeSala)
      } catch {
        // Un mensaje que no es JSON no debe romper la sala.
      }
    }
    ws.onclose = () => {
      window.clearInterval(this.temporizadorPing)
      this.oyentes.estado('cerrada')
      if (!this.cerrado) {
        const espera = Math.min(1000 * 2 ** this.intentos++, 10_000)
        this.temporizadorReintento = window.setTimeout(() => this.conectar(), espera)
      }
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
    window.clearTimeout(this.temporizadorReintento)
    this.ws?.close()
  }
}
