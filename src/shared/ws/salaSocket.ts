const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8085'

/** Cada cuánto se envía un PING para mantener viva la conexión. */
const INTERVALO_PING_MS = 15_000
/** Si tras un PING no llega nada en este tiempo, la conexión se da por muerta. */
const ESPERA_RESPUESTA_MS = 8_000
/**
 * DIS-01: si la conexión no se abre a tiempo se descarta y se reintenta. Mientras una réplica reinicia, el
 * balanceador de Azure le sigue mandando parte de las conexiones y quedan colgadas "conectando"; sin este límite
 * el navegador espera su propio tiempo (decenas de segundos) antes de reintentar.
 *
 * El límite se adapta a la red del comprador: 3 veces lo que tardó en abrir la última conexión buena, entre
 * ESPERA_CONEXION_MIN_MS y ESPERA_CONEXION_MAX_MS. Antes de la primera conexión se usa ESPERA_CONEXION_MS. Así,
 * cerca del servidor un intento colgado cuesta menos de 1 s (caben más intentos en la ventana rápida) y con una
 * red lenta el límite sube solo y la conexión no se descarta antes de poder abrir.
 */
export const ESPERA_CONEXION_MS = 1_500
export const ESPERA_CONEXION_MIN_MS = 800
export const ESPERA_CONEXION_MAX_MS = 3_000
/**
 * DIS-01: tope del límite durante la ventana rápida. En la corrida de caos del 17 nov, dos compradores cuya primera
 * conexión fue lenta (los 60 entraron a la vez) tenían el límite en 2,9–3 s: tres intentos colgados en la réplica
 * caída les costaron 9,7 y 10,1 s. Con este tope, cada intento colgado cuesta ≤ 1,7 s y caben al menos 5 en 10 s.
 * Pasada la ventana vuelve a valer el límite adaptativo completo, para que una red de verdad lenta conecte.
 */
export const ESPERA_CONEXION_VENTANA_MAX_MS = 1_500
const FACTOR_ESPERA_CONEXION = 3
/**
 * DIS-01: durante los primeros 10 s después del corte se reintenta rápido y a ritmo constante. En la corrida de
 * caos del 16 nov, la mitad de los intentos seguía cayendo en la réplica que reiniciaba: con la espera duplicándose
 * desde el 4.º intento, un comprador con 5 intentos fallidos seguidos tardó 16,6 s en volver. A ritmo constante
 * caben unos 9 intentos en 10 s. Pasada la ventana, la espera crece (caída real) para no saturar el servidor.
 */
export const VENTANA_RAPIDA_MS = 10_000
const ESPERA_REINTENTO_RAPIDO_MS = 200
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
/** Forma de los tickets que emite identity: 256 bits aleatorios en base64url, sin relleno. */
const FORMA_DEL_TICKET = /^[A-Za-z0-9_-]{1,256}$/

/** Un ticket que no tiene la forma esperada no se pone en la URL: se trata como si no se hubiera podido obtener. */
export function ticketValido(ticket: unknown): ticket is string {
  return typeof ticket === 'string' && FORMA_DEL_TICKET.test(ticket)
}

/**
 * URL de la sala. El servidor sale siempre de la configuración (VITE_WS_URL); la ruta y el ticket se agregan
 * codificados con la API de URL, y se comprueba que el destino final siga siendo ese servidor.
 */
function urlDeSalaSegura(subastaId: string, ticket: string): string {
  const base = new URL(WS_BASE)
  const url = new URL(`${base.pathname.replace(/\/$/, '')}/ws/salas/${encodeURIComponent(subastaId)}`, base)
  url.searchParams.set('ticket', ticket)
  if (url.origin !== base.origin) throw new Error('La sala apunta a un servidor no permitido')
  return url.toString()
}

/**
 * Cliente WebSocket único de la sala: pide un ticket nuevo antes de cada conexión, reconecta solo (rápido durante
 * los primeros 10 s, luego con espera creciente), mantiene la conexión viva y descarta los eventos repetidos o
 * atrasados.
 */
export class SalaSocket {
  private ws: WebSocket | null = null
  private cerrado = false
  /** Reintentos lentos (con espera creciente) hechos después de la ventana rápida. */
  private intentos = 0
  /** DIS-01: cuándo se perdió la conexión; marca el inicio de la ventana rápida. */
  private desconectadoDesde: number | null = null
  /** DIS-01: límite para que abra cada conexión, ajustado con la última conexión buena. */
  private esperaConexion = ESPERA_CONEXION_MS
  private ultimaSecuencia = -1
  private temporizadorPing: number | undefined
  private temporizadorRespuesta: number | undefined
  private temporizadorReintento: number | undefined
  private temporizadorConexion: number | undefined

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
      const recibido = await this.obtenerTicket()
      if (!ticketValido(recibido)) throw new Error('Ticket con formato inválido')
      ticket = recibido
    } catch {
      // Sin ticket (red caída o servicio no disponible) se reintenta igual que si la conexión se hubiera caído.
      // Si la sesión venció, el cliente HTTP ya avisó y la página saldrá de la sala.
      this.reintentar()
      return
    }
    if (this.cerrado) return
    const ws = new WebSocket(urlDeSalaSegura(this.subastaId, ticket))
    this.ws = ws
    const abriendoDesde = Date.now()
    const enVentanaRapida =
      this.desconectadoDesde !== null && abriendoDesde - this.desconectadoDesde < VENTANA_RAPIDA_MS
    const limite = enVentanaRapida ? Math.min(this.esperaConexion, ESPERA_CONEXION_VENTANA_MAX_MS) : this.esperaConexion
    this.temporizadorConexion = window.setTimeout(() => {
      this.temporizadorConexion = undefined
      // No se abrió a tiempo: se descarta sin esperar su onclose (puede tardar) y se reintenta ya.
      ws.onclose = null
      ws.close()
      this.alCerrarse(ws)
    }, limite)

    ws.onopen = () => {
      window.clearTimeout(this.temporizadorConexion)
      this.temporizadorConexion = undefined
      this.esperaConexion = Math.min(
        ESPERA_CONEXION_MAX_MS,
        Math.max(ESPERA_CONEXION_MIN_MS, (Date.now() - abriendoDesde) * FACTOR_ESPERA_CONEXION),
      )
      this.intentos = 0
      this.desconectadoDesde = null
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
    window.clearTimeout(this.temporizadorConexion)
    this.temporizadorRespuesta = undefined
    this.temporizadorConexion = undefined
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
    const ahora = Date.now()
    this.desconectadoDesde ??= ahora
    // Dentro de la ventana rápida, ritmo constante; después, 1 s, 2 s, 4 s, 8 s y el tope de 10 s.
    const base =
      ahora - this.desconectadoDesde < VENTANA_RAPIDA_MS
        ? ESPERA_REINTENTO_RAPIDO_MS
        : Math.min(1000 * 2 ** this.intentos++, 10_000)
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
    window.clearTimeout(this.temporizadorConexion)
    this.temporizadorRespuesta = undefined
    this.temporizadorConexion = undefined
    this.ws?.close()
  }
}
