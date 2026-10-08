// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalaSocket } from './salaSocket'

class WebSocketFalso {
  static readonly OPEN = 1
  static instancias: WebSocketFalso[] = []
  readyState = 0
  enviados: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((evento: { data: string }) => void) | null = null
  onclose: (() => void) | null = null

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

  abrir() {
    this.readyState = WebSocketFalso.OPEN
    this.onopen?.()
  }
}

const ultimo = () => WebSocketFalso.instancias[WebSocketFalso.instancias.length - 1]

function crear() {
  const oyentes = { mensaje: vi.fn(), estado: vi.fn() }
  const socket = new SalaSocket('s1', 'a b/c', oyentes)
  return { socket, oyentes }
}

beforeEach(() => {
  vi.useFakeTimers()
  WebSocketFalso.instancias = []
  vi.stubGlobal('WebSocket', WebSocketFalso)
  // La espera de reconexión lleva una parte al azar; con 0 queda en su valor base.
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SalaSocket', () => {
  it('se conecta a la sala con el token en la URL y avisa cada cambio de estado', () => {
    const { socket, oyentes } = crear()

    socket.conectar()
    expect(ultimo().url).toBe('ws://localhost:8085/ws/salas/s1?token=a%20b%2Fc')
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')

    ultimo().abrir()
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
  })

  it('mantiene la conexión viva con un PING cada 15 segundos mientras el servidor responde', () => {
    const { socket, oyentes } = crear()
    socket.conectar()
    const ws = ultimo()
    ws.abrir()

    vi.advanceTimersByTime(15_000)
    ws.onmessage?.({ data: '{"tipo":"PONG","subastaId":"s1","datos":{}}' })
    vi.advanceTimersByTime(15_000)
    ws.onmessage?.({ data: '{"tipo":"PONG","subastaId":"s1","datos":{}}' })
    vi.advanceTimersByTime(14_000)

    expect(ws.enviados).toEqual(['{"tipo":"PING"}', '{"tipo":"PING"}'])
    expect(WebSocketFalso.instancias).toHaveLength(1)
    // El PONG solo comprueba la conexión: no es un evento de la sala.
    expect(oyentes.mensaje).not.toHaveBeenCalled()
  })

  it('si el servidor deja de responder da la conexión por muerta y reconecta', () => {
    const { socket, oyentes } = crear()
    socket.conectar()
    const muerta = ultimo()
    muerta.abrir()
    // Una conexión colgada no avisa de su cierre aunque se le pida cerrar.
    muerta.close = () => undefined

    vi.advanceTimersByTime(15_000 + 7_999)
    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')

    vi.advanceTimersByTime(1)
    expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

    vi.advanceTimersByTime(1000)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    expect(oyentes.estado).toHaveBeenLastCalledWith('conectando')
  })

  it('cualquier evento de la sala cuenta como señal de vida', () => {
    const { socket } = crear()
    socket.conectar()
    ultimo().abrir()

    vi.advanceTimersByTime(15_000)
    ultimo().onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{"conectados":2}}' })
    vi.advanceTimersByTime(8_000)

    expect(WebSocketFalso.instancias).toHaveLength(1)
  })

  it('el cierre tardío de una conexión ya descartada no afecta a la nueva', () => {
    const { socket, oyentes } = crear()
    socket.conectar()
    const vieja = ultimo()
    vieja.abrir()
    const avisar = vieja.onclose
    vieja.close = () => undefined
    vi.advanceTimersByTime(15_000 + 8_000 + 1000)
    ultimo().abrir()

    avisar?.()

    expect(oyentes.estado).toHaveBeenLastCalledWith('abierta')
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('reparte las reconexiones en el tiempo para que no lleguen todas a la vez', () => {
    vi.mocked(Math.random).mockReturnValue(0.5)
    const { socket } = crear()
    socket.conectar()
    ultimo().close()

    // Espera base de 1 s más hasta un 30 % al azar: con 0,5 son 1150 ms.
    vi.advanceTimersByTime(1149)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(WebSocketFalso.instancias).toHaveLength(2)
  })

  it('entrega los mensajes JSON e ignora los que no lo son', () => {
    const { socket, oyentes } = crear()
    socket.conectar()
    ultimo().abrir()

    ultimo().onmessage?.({ data: 'no es json' })
    ultimo().onmessage?.({ data: '{"tipo":"CONECTADOS","subastaId":"s1","datos":{"conectados":4}}' })

    expect(oyentes.mensaje).toHaveBeenCalledTimes(1)
    expect(oyentes.mensaje).toHaveBeenCalledWith({ tipo: 'CONECTADOS', subastaId: 's1', datos: { conectados: 4 } })
  })

  it('solo envía con la conexión abierta', () => {
    const { socket } = crear()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(false)

    socket.conectar()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(false)

    ultimo().abrir()
    expect(socket.enviar({ tipo: 'PUJAR', monto: 110 })).toBe(true)
    expect(ultimo().enviados).toEqual(['{"tipo":"PUJAR","monto":110}'])
  })

  it('si la conexión se cae reintenta con espera creciente, hasta 10 segundos', () => {
    const { socket, oyentes } = crear()
    socket.conectar()

    // Cada caída sin haber llegado a abrir duplica la espera: 1 s, 2 s, 4 s, 8 s y luego el tope de 10 s.
    for (const espera of [1000, 2000, 4000, 8000, 10_000, 10_000]) {
      const antes = WebSocketFalso.instancias.length
      ultimo().close()
      expect(oyentes.estado).toHaveBeenLastCalledWith('cerrada')

      vi.advanceTimersByTime(espera - 1)
      expect(WebSocketFalso.instancias).toHaveLength(antes)
      vi.advanceTimersByTime(1)
      expect(WebSocketFalso.instancias).toHaveLength(antes + 1)
    }
  })

  it('al abrir se reinicia la espera de reconexión', () => {
    const { socket } = crear()
    socket.conectar()
    ultimo().close()
    vi.advanceTimersByTime(1000)
    ultimo().close()
    vi.advanceTimersByTime(2000)

    ultimo().abrir()
    ultimo().close()
    vi.advanceTimersByTime(1000)

    expect(WebSocketFalso.instancias).toHaveLength(4)
  })

  it('cerrar la sala detiene los PING y no vuelve a conectar', () => {
    const { socket } = crear()
    socket.conectar()
    ultimo().abrir()

    socket.cerrar()
    vi.advanceTimersByTime(60_000)

    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(ultimo().enviados).toEqual([])
  })
})
