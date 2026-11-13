// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalaSocket, ticketValido } from './salaSocket'

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

    await vi.advanceTimersByTimeAsync(1000)
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
    await vi.advanceTimersByTimeAsync(15_000 + 8_000 + 1000)
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

    // Espera base de 1 s más hasta un 30 % al azar: con 0,5 son 1150 ms.
    await vi.advanceTimersByTimeAsync(1149)
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

  it('si la conexión se cae reintenta con espera creciente, hasta 10 segundos', async () => {
    const { socket, oyentes } = crear()
    await socket.conectar()

    // Cada caída sin haber llegado a abrir duplica la espera: 1 s, 2 s, 4 s, 8 s y luego el tope de 10 s.
    for (const espera of [1000, 2000, 4000, 8000, 10_000, 10_000]) {
      const antes = WebSocketFalso.instancias.length
      ultimo().close()
      expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

      await vi.advanceTimersByTimeAsync(espera - 1)
      expect(WebSocketFalso.instancias).toHaveLength(antes)
      await vi.advanceTimersByTimeAsync(1)
      expect(WebSocketFalso.instancias).toHaveLength(antes + 1)
    }
  })

  it('al abrir se reinicia la espera de reconexión', async () => {
    const { socket } = crear()
    await socket.conectar()
    ultimo().close()
    await vi.advanceTimersByTimeAsync(1000)
    ultimo().close()
    await vi.advanceTimersByTimeAsync(2000)

    ultimo().abrir()
    ultimo().close()
    await vi.advanceTimersByTimeAsync(1000)

    expect(WebSocketFalso.instancias).toHaveLength(4)
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
    await vi.advanceTimersByTimeAsync(1000)

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

    await vi.advanceTimersByTimeAsync(1000)
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

})
