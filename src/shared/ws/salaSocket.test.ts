// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ESPERA_CONEXION_MS, ESPERA_RESPALDO_MS, SalaSocket, ticketValido } from './salaSocket'

class WebSocketFalso {
  static readonly OPEN = 1
  static instancias: WebSocketFalso[] = []
  readyState = 0
  enviados: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((evento: { data: string }) => void) | null = null
  onclose: ((evento?: { code: number }) => void) | null = null

  constructor(readonly url: string) {
    WebSocketFalso.instancias.push(this)
  }

  send(texto: string) {
    this.enviados.push(texto)
  }

  close() {
    this.readyState = 3
    this.onclose?.()
  }

  cerrarConCodigo(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }

  abrir() {
    this.readyState = WebSocketFalso.OPEN
    this.onopen?.()
  }
}

const ultimo = () => WebSocketFalso.instancias[WebSocketFalso.instancias.length - 1]

function crear() {
  const oyentes = { mensaje: vi.fn(), estado: vi.fn() }
  const obtenerTicket = vi.fn(() => Promise.resolve('Tk_9-xZ'))
  const socket = new SalaSocket('s1', obtenerTicket, oyentes)
  return { socket, oyentes, obtenerTicket }
}

let azar = 0

beforeEach(() => {
  vi.useFakeTimers()
  WebSocketFalso.instancias = []
  vi.stubGlobal('WebSocket', WebSocketFalso)
  // La espera de reconexión lleva una parte al azar; con 0 queda en su valor base.
  azar = 0
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint32Array) => {
      arr[0] = Math.floor(azar * 2 ** 32)
      return arr
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SalaSocket', () => {
  it('SEG-04 · se conecta a la sala con un ticket (no el token) en la URL y avisa cada cambio de estado', async () => {
    const { socket, oyentes } = crear()

    await socket.conectar()
    expect(ultimo().url).toBe('ws://localhost:8085/ws/salas/s1?ticket=Tk_9-xZ')
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')

    ultimo().abrir()
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
  })

  it('mantiene la conexión viva con un PING cada 15 segundos mientras el servidor responde', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    const ws = ultimo()
    ws.abrir()

    await vi.advanceTimersByTimeAsync(15_000)
    ws.onmessage?.({ data: '{"tipo":"PONG","subastaId":"s1","datos":{}}' })
    await vi.advanceTimersByTimeAsync(15_000)
    ws.onmessage?.({ data: '{"tipo":"PONG","subastaId":"s1","datos":{}}' })
    await vi.advanceTimersByTimeAsync(14_000)

    expect(ws.enviados).toEqual(['{"tipo":"PING"}', '{"tipo":"PING"}'])
    expect(WebSocketFalso.instancias).toHaveLength(1)
    // El PONG solo comprueba la conexión: no es un evento de la sala.
    expect(oyentes.mensaje).not.toHaveBeenCalled()
  })

  it('si el servidor deja de responder da la conexión por muerta y reconecta', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    const muerta = ultimo()
    muerta.abrir()
    // Una conexión colgada no avisa de su cierre aunque se le pida cerrar.
    muerta.close = () => undefined

    await vi.advanceTimersByTimeAsync(15_000 + 7_999)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')

    await vi.advanceTimersByTimeAsync(1)
    expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

    // Reintento rápido (200 ms) dentro de la ventana de 10 s.
    await vi.advanceTimersByTimeAsync(200)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')
  })

  it('cualquier evento de la sala cuenta como señal de vida', async () => {
    const { socket } = crear()
    await socket.conectar()
    ultimo().abrir()

    await vi.advanceTimersByTimeAsync(15_000)
    ultimo().onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{"conectados":2}}' })
    await vi.advanceTimersByTimeAsync(8_000)

    expect(WebSocketFalso.instancias).toHaveLength(1)
  })

  it('el cierre tardío de una conexión ya descartada no afecta a la nueva', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    const vieja = ultimo()
    vieja.abrir()
    const avisar = vieja.onclose
    vieja.close = () => undefined
    // Reconecta a los 200 ms; abre antes de que haga falta la conexión de respaldo.
    await vi.advanceTimersByTimeAsync(15_000 + 8_000 + 200)
    ultimo().abrir()

    avisar?.()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('reparte las reconexiones en el tiempo para que no lleguen todas a la vez', async () => {
    azar = 0.5
    const { socket } = crear()
    await socket.conectar()
    ultimo().close()

    // Primer reintento: base de 200 ms más hasta un 30 % al azar; con 0,5 son 230 ms.
    await vi.advanceTimersByTimeAsync(229)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('entrega los mensajes JSON e ignora los que no lo son', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()

    ultimo().onmessage?.({ data: 'no es json' })
    ultimo().onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{"conectados":4}}' })

    expect(oyentes.mensaje).toHaveBeenCalledTimes(1)
    expect(oyentes.mensaje).toHaveBeenCalledWith({ tipo: 'CONECTADOS', subastaId: 's1', datos: { conectados: 4 } })
  })

  it('solo envía con la conexión abierta', async () => {
    const { socket } = crear()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(false)

    await socket.conectar()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(false)

    ultimo().abrir()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(true)
    expect(ultimo().enviados).toEqual(['{"tipo":"PUJAR","monto":110}'])
  })

  /** Cierra la conexión actual y comprueba que la siguiente llega justo a los `espera` ms. */
  async function cerrarYEsperar(espera: number) {
    const antes = WebSocketFalso.instancias.length
    ultimo().close()
    await vi.advanceTimersByTimeAsync(espera - 1)
    expect(WebSocketFalso.instancias).toHaveLength(antes)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(antes + 1)
  }

  it('DIS-01 · durante 10 s tras el corte reintenta cada 200 ms; después con espera creciente, hasta 10 s', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    const corte = Date.now()

    // Ventana rápida: ritmo constante, sin duplicar la espera, mientras no pasen 10 s desde el corte. Si la mitad
    // de los intentos cae en una réplica que reinicia, cada uno es otra oportunidad de llegar a la sana.
    let rapidos = 0
    while (Date.now() - corte < 10_000) {
      await cerrarYEsperar(200)
      expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')
      rapidos++
    }
    expect(rapidos).toBe(50)

    // Pasada la ventana, caída real: 1 s, 2 s, 4 s, 8 s y el tope de 10 s, para no saturar el servidor.
    for (const espera of [1000, 2000, 4000, 8000, 10_000, 10_000]) await cerrarYEsperar(espera)
  })

  it('al abrir se reinicia la ventana rápida', async () => {
    const { socket } = crear()
    await socket.conectar()
    const corte = Date.now()
    while (Date.now() - corte < 10_000) await cerrarYEsperar(200)
    await cerrarYEsperar(1000)
    await cerrarYEsperar(2000)

    // Tras abrir, un corte nuevo vuelve a empezar con los reintentos rápidos.
    ultimo().abrir()
    await cerrarYEsperar(200)
  })

  /** Deja que los intentos colgados venzan hasta pasar la ventana rápida y devuelve el primer intento posterior. */
  async function primerIntentoTrasLaVentana(corte: number) {
    while (Date.now() - corte < 10_000) await vi.advanceTimersByTimeAsync(50)
    const antes = WebSocketFalso.instancias.length
    while (WebSocketFalso.instancias.length === antes) await vi.advanceTimersByTimeAsync(10)
    return ultimo()
  }

  /** Comprueba que la conexión sigue intentando abrir hasta `limite` ms y se descarta justo ahí. */
  async function seDescartaA(ws: WebSocketFalso, limite: number) {
    await vi.advanceTimersByTimeAsync(limite - 1)
    expect(ws.readyState).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(ws.readyState).toBe(3)
  }

  it('DIS-01 · el límite para abrir se adapta a la red: 3 veces la última conexión buena, entre 0,8 y 3 s', async () => {
    const { socket } = crear()
    await socket.conectar()
    // Red lenta: la primera conexión tarda 900 ms en abrir, así que el límite pasa a 2,7 s.
    await vi.advanceTimersByTimeAsync(900)
    ultimo().abrir()
    ultimo().close()
    const corte = Date.now()

    // Dentro de la ventana rápida el límite no pasa de 1,5 s (caso de 10,1 s del 17 nov).
    await vi.advanceTimersByTimeAsync(200)
    await seDescartaA(ultimo(), 1_500)

    // Pasada la ventana vuelve el límite adaptativo completo: una red de verdad lenta termina conectando.
    await seDescartaA(await primerIntentoTrasLaVentana(corte), 2_700)
  })

  it('DIS-01 · cerca del servidor el límite baja al mínimo de 0,8 s', async () => {
    const { socket } = crear()
    await socket.conectar()
    await vi.advanceTimersByTimeAsync(900)
    ultimo().abrir()
    ultimo().close()
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(1_500)

    // Red cercana: abre al instante y el límite baja al mínimo de 0,8 s.
    await vi.advanceTimersByTimeAsync(200)
    ultimo().abrir()
    ultimo().close()
    await vi.advanceTimersByTimeAsync(200)
    const cercana = ultimo()
    await vi.advanceTimersByTimeAsync(799)
    expect(cercana.readyState).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(cercana.readyState).toBe(3)
  })

  it('DIS-01 · con una red muy lenta el límite no pasa de 1,5 s en la ventana ni de 3 s después', async () => {
    const { socket } = crear()
    await socket.conectar()
    await vi.advanceTimersByTimeAsync(1_400)
    ultimo().abrir()
    ultimo().close()
    const corte = Date.now()

    await vi.advanceTimersByTimeAsync(200)
    await seDescartaA(ultimo(), 1_500)
    await seDescartaA(await primerIntentoTrasLaVentana(corte), 3_000)
  })

  it('DIS-01 · con el límite en 3 s, tres intentos colgados ya no suman 10 s (caso del 17 nov)', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    // La primera conexión fue lenta porque todos entraron a la vez: el límite quedó en 3 s.
    await vi.advanceTimersByTimeAsync(1_000)
    ultimo().abrir()
    const inicio = Date.now()
    ultimo().cerrarConCodigo(1006)

    for (let i = 0; i < 3; i++) {
      while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
      const colgada = ultimo()
      while (colgada.readyState !== 3) await vi.advanceTimersByTimeAsync(10)
    }
    while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(0)
    ultimo().abrir()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    // Antes: 3 × 3 s + esperas ≈ 10 s. Ahora: 3 × 1,5 s + esperas < 6 s.
    expect(Date.now() - inicio).toBeLessThan(6_000)
  })

  it('DIS-01 · una conexión que no se abre en 1,5 s se descarta y se reintenta (réplica que reinicia)', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    const colgada = ultimo()

    await vi.advanceTimersByTimeAsync(ESPERA_CONEXION_MS - 1)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(colgada.readyState).toBe(3)
    expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

    // Reintento rápido con un ticket nuevo.
    await vi.advanceTimersByTimeAsync(200)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    expect(ultimo()).not.toBe(colgada)
  })

  it('DIS-01 · si la conexión se abre a tiempo no se descarta', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()

    await vi.advanceTimersByTimeAsync(ESPERA_CONEXION_MS * 2)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
  })

  it('DIS-01 · con la mitad de los intentos en una réplica que no responde, reconecta en menos de 10 s', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()
    const inicio = Date.now()
    ultimo().cerrarConCodigo(1012) // la réplica empieza a apagarse

    // Peor caso razonable: 4 intentos seguidos caen en la réplica caída y quedan colgados; el 5.º llega a la sana.
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(10)
      while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
      await vi.advanceTimersByTimeAsync(ESPERA_CONEXION_MS)
    }
    while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(0)
    ultimo().abrir()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(Date.now() - inicio).toBeLessThan(10_000)
  })

  it('DIS-01 · aun con 8 intentos colgados seguidos (el caso de 16,6 s del 16 nov), reconecta en menos de 10 s', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir() // conexión cercana: el límite para abrir queda en 0,8 s
    const inicio = Date.now()
    ultimo().cerrarConCodigo(1006)

    for (let i = 0; i < 8; i++) {
      while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
      const colgada = ultimo()
      while (colgada.readyState !== 3) await vi.advanceTimersByTimeAsync(10)
    }
    while (oyentes.estado.mock.lastCall?.[0] !== 'conectando') await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(0)
    ultimo().abrir()

    // 8 rondas colgadas, cada una con su conexión de respaldo, más la inicial y la que abre.
    expect(WebSocketFalso.instancias).toHaveLength(18)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(Date.now() - inicio).toBeLessThan(10_000)
  })

  it('cerrar la sala detiene los PING y no vuelve a conectar', async () => {
    const { socket } = crear()
    await socket.conectar()
    ultimo().abrir()

    socket.cerrar()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(ultimo().enviados).toEqual([])
  })

  it('SEG-04 · cada reconexión pide un ticket nuevo: una URL usada no se vuelve a usar', async () => {
    const { socket, obtenerTicket } = crear()
    obtenerTicket.mockResolvedValueOnce('t1').mockResolvedValueOnce('t2')
    await socket.conectar()
    ultimo().abrir()
    ultimo().close()
    await vi.advanceTimersByTimeAsync(300)

    expect(obtenerTicket).toHaveBeenCalledTimes(2)
    expect(WebSocketFalso.instancias.map((w) => w.url)).toEqual([
      'ws://localhost:8085/ws/salas/s1?ticket=t1',
      'ws://localhost:8085/ws/salas/s1?ticket=t2',
    ])
  })

  it('un ticket con otra forma (espacios, barras, parámetros) no llega a la URL: se reintenta', async () => {
    const { socket, obtenerTicket } = crear()
    obtenerTicket.mockResolvedValueOnce('a b/c&host=evil')
    await socket.conectar()
    expect(WebSocketFalso.instancias).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1000)
    expect(ultimo().url).toBe('ws://localhost:8085/ws/salas/s1?ticket=Tk_9-xZ')
  })

  it('ticketValido acepta solo base64url', () => {
    expect(ticketValido('Tk_9-xZ')).toBe(true)
    expect(ticketValido('')).toBe(false)
    expect(ticketValido('a b')).toBe(false)
    expect(ticketValido('x'.repeat(257))).toBe(false)
    expect(ticketValido(42)).toBe(false)
  })

  it('si no se pudo obtener el ticket reintenta con la espera de siempre, sin abrir conexión', async () => {
    const { socket, oyentes, obtenerTicket } = crear()
    obtenerTicket.mockRejectedValueOnce(new Error('sin red'))
    await socket.conectar()
    expect(WebSocketFalso.instancias).toHaveLength(0)
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')

    await vi.advanceTimersByTimeAsync(300)
    expect(WebSocketFalso.instancias).toHaveLength(1)
  })

  it('SEG-05 · un cierre 4401 (sesión cerrada o vencida) no reconecta y avisa que la sesión terminó', async () => {
    const sesionTerminada = vi.fn()
    const oyentes = { mensaje: vi.fn(), estado: vi.fn(), sesionTerminada }
    const socket = new SalaSocket('s1', () => Promise.resolve('t'), oyentes)
    await socket.conectar()
    ultimo().abrir()

    ultimo().cerrarConCodigo(4401)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(sesionTerminada).toHaveBeenCalledTimes(1)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')
  })

  it('SEG-03 · tras un cierre 4429 (bloqueo por abuso) espera 60 s antes de reconectar', async () => {
    const { socket } = crear()
    await socket.conectar()
    ultimo().abrir()

    ultimo().cerrarConCodigo(4429)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('REN-01 · descarta los eventos repetidos o atrasados según su número de secuencia', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()
    const evento = (secuencia: number) =>
      ultimo().onmessage?.({ data: JSON.stringify({ tipo: 'PUJA_ACEPTADA', subastaId: 's1', datos: {}, secuencia }) })

    evento(5)
    evento(5)
    evento(4)
    evento(7)
    ultimo().onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{}}' })

    expect(oyentes.mensaje.mock.calls.map(([m]) => m.secuencia)).toEqual([5, 7, undefined])
  })

  it('cerrar la sala mientras se pide el ticket no abre la conexión', async () => {
    let entregar: (t: string) => void = () => undefined
    const socket = new SalaSocket('s1', () => new Promise<string>((r) => (entregar = r)), { mensaje: vi.fn(), estado: vi.fn() })
    const conectando = socket.conectar()
    socket.cerrar()
    entregar('t')
    await conectando
    expect(WebSocketFalso.instancias).toHaveLength(0)
  })


  /** Abre la sala y corta la conexión, para quedar dentro de la ventana rápida con un intento recién creado. */
  async function cortadaEnLaVentana() {
    const contexto = crear()
    await contexto.socket.conectar()
    ultimo().abrir()
    ultimo().cerrarConCodigo(1006)
    await vi.advanceTimersByTimeAsync(200)
    return contexto
  }

  it('DIS-01 · en la ventana rápida, si no abre en 400 ms abre una conexión de respaldo con su propio ticket', async () => {
    const { obtenerTicket } = await cortadaEnLaVentana()
    const principal = ultimo()

    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS - 1)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(3)
    expect(ultimo()).not.toBe(principal)
    // Inicial, principal y respaldo: cada una con un ticket nuevo (SEG-04).
    expect(obtenerTicket).toHaveBeenCalledTimes(3)
  })

  it('DIS-01 · si el respaldo abre primero reemplaza a la principal colgada, que se descarta', async () => {
    const { socket, oyentes } = await cortadaEnLaVentana()
    const principal = ultimo()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    const respaldo = ultimo()

    respaldo.abrir()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(principal.readyState).toBe(3)
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(true)
    expect(respaldo.enviados).toEqual(['{"tipo":"PUJAR","monto":110}'])
    // La principal descartada ya no reconecta ni cambia el estado si llega a abrir o cerrarse tarde.
    principal.onopen?.()
    principal.onclose?.()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(WebSocketFalso.instancias).toHaveLength(3)
  })

  it('DIS-01 · el respaldo recibe los eventos de la sala y sus PING mantienen la conexión', async () => {
    const { oyentes } = await cortadaEnLaVentana()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    const respaldo = ultimo()
    respaldo.abrir()

    respaldo.onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{"conectados":3}}' })
    await vi.advanceTimersByTimeAsync(15_000)

    expect(oyentes.mensaje).toHaveBeenCalledTimes(1)
    expect(respaldo.enviados).toEqual(['{"tipo":"PING"}'])
  })

  it('DIS-01 · si la principal abre primero el respaldo se cierra', async () => {
    const { oyentes } = await cortadaEnLaVentana()
    const principal = ultimo()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    const respaldo = ultimo()

    principal.abrir()

    expect(respaldo.readyState).toBe(3)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    respaldo.onopen?.()
    expect(WebSocketFalso.instancias).toHaveLength(3)
  })

  it('DIS-01 · una conexión que abre antes de 400 ms no abre respaldo', async () => {
    await cortadaEnLaVentana()
    ultimo().abrir()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('DIS-01 · fuera de la ventana rápida (primera conexión) no se abre respaldo', async () => {
    const { socket } = crear()
    await socket.conectar()

    await vi.advanceTimersByTimeAsync(ESPERA_CONEXION_MS - 1)
    expect(WebSocketFalso.instancias).toHaveLength(1)
  })

  it('DIS-01 · si principal y respaldo quedan colgados, se descartan los dos y la ronda siguiente vuelve a intentar', async () => {
    const { oyentes } = await cortadaEnLaVentana()
    const principal = ultimo()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    const respaldo = ultimo()

    while (principal.readyState !== 3) await vi.advanceTimersByTimeAsync(10)
    expect(respaldo.readyState).toBe(3)
    expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

    await vi.advanceTimersByTimeAsync(200)
    expect(WebSocketFalso.instancias).toHaveLength(4)
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')
  })

  it('cerrar la sala descarta también la conexión de respaldo', async () => {
    const { socket } = await cortadaEnLaVentana()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    const respaldo = ultimo()

    socket.cerrar()

    expect(respaldo.readyState).toBe(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(WebSocketFalso.instancias).toHaveLength(3)
  })

  it('un ticket de respaldo inválido no abre conexión y la principal sigue', async () => {
    const { socket, obtenerTicket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()
    ultimo().cerrarConCodigo(1006)
    obtenerTicket.mockResolvedValueOnce('Tk_9-xZ').mockResolvedValueOnce('mal ticket')
    await vi.advanceTimersByTimeAsync(200 + ESPERA_RESPALDO_MS)
    expect(WebSocketFalso.instancias).toHaveLength(2)

    ultimo().abrir()
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
  })


  it('DIS-01 · si el servidor cierra el respaldo antes de abrir, la principal sigue y puede abrir', async () => {
    const { oyentes } = await cortadaEnLaVentana()
    const principal = ultimo()
    await vi.advanceTimersByTimeAsync(ESPERA_RESPALDO_MS)
    ultimo().cerrarConCodigo(1006)

    principal.abrir()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(WebSocketFalso.instancias).toHaveLength(3)
  })

  it('si no se pudo pedir el ticket del respaldo no abre conexión y la principal sigue', async () => {
    const { socket, obtenerTicket, oyentes } = crear()
    await socket.conectar()
    ultimo().abrir()
    ultimo().cerrarConCodigo(1006)
    obtenerTicket.mockResolvedValueOnce('Tk_9-xZ').mockRejectedValueOnce(new Error('sin red'))
    await vi.advanceTimersByTimeAsync(200 + ESPERA_RESPALDO_MS)
    expect(WebSocketFalso.instancias).toHaveLength(2)

    ultimo().abrir()
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
  })

})
