// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { api } from '../../shared/api/endpoints'
import type { Detalle, Usuario } from '../../shared/api/types'
import type { EstadoConexion, MensajeSala } from '../../shared/ws/salaSocket'
import { ANA, LUIS, detalle, renderEnApp } from '../../test/utilidades'
import { SalaPage } from './SalaPage'

/** Sustituto del WebSocket de la sala: la prueba decide qué mensajes llegan y cuándo cambia la conexión. */
const { sockets, SalaSocketFalso } = vi.hoisted(() => {
  interface Oyentes {
    mensaje: (mensaje: MensajeSala) => void
    estado: (estado: EstadoConexion) => void
  }
  class SalaSocketFalso {
    enviados: unknown[] = []
    cerrado = false
    constructor(
      readonly subastaId: string,
      readonly token: string,
      readonly oyentes: Oyentes,
    ) {
      sockets.push(this)
    }
    conectar() {
      this.oyentes.estado('conectando')
    }
    enviar(mensaje: unknown) {
      this.enviados.push(mensaje)
      return true
    }
    cerrar() {
      this.cerrado = true
    }
  }
  const sockets: SalaSocketFalso[] = []
  return { sockets, SalaSocketFalso }
})

vi.mock('../../shared/ws/salaSocket', () => ({ SalaSocket: SalaSocketFalso }))
vi.mock('../../shared/api/endpoints', () => ({
  api: { detalle: vi.fn(), estadoTransmision: vi.fn(), saldo: vi.fn(), iniciarSubasta: vi.fn() },
}))
// El video (LiveKit) tiene sus propias pruebas; aquí solo importa qué le pide la sala.
vi.mock('./VideoLive', () => ({
  VideoLive: (props: { esSubastador: boolean; transmitiendo: boolean }) => (
    <p data-testid="video">{`${props.esSubastador ? 'emisor' : 'receptor'}:${props.transmitiendo ? 'en vivo' : 'sin señal'}`}</p>
  ),
}))

const AHORA = Date.parse('2026-10-05T15:00:00Z')
const socket = () => sockets[sockets.length - 1]
/** Deja pasar el tiempo y espera a que termine de cargarse el video, que la sala importa de forma diferida. */
const esperar = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await vi.dynamicImportSettled()
  })

function recibir(tipo: string, datos: Record<string, unknown> = {}) {
  act(() => socket().oyentes.mensaje({ tipo, subastaId: 's1', datos }))
}

async function conexion(estado: EstadoConexion) {
  act(() => socket().oyentes.estado(estado))
  await esperar()
}

/** Abre la sala con la subasta dada y la conexión en vivo ya establecida. */
async function abrir(subasta: Detalle, usuario: Usuario = ANA) {
  vi.mocked(api.detalle).mockResolvedValue(subasta)
  const vista = renderEnApp(<SalaPage />, { usuario, ruta: '/subastas/s1/sala', patron: '/subastas/:id/sala' })
  await esperar()
  await conexion('abierta')
  return vista
}

const cierreConGanador = { estado: 'FINALIZADA', ganadorId: ANA.id, ganadorNombre: 'Ana', montoFinal: 300, cantidadPujas: 2 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
  vi.resetAllMocks()
  sockets.length = 0
  vi.mocked(api.estadoTransmision).mockResolvedValue({ transmitiendo: false, sala: 's1' })
  vi.mocked(api.saldo).mockResolvedValue({ usuarioId: ANA.id, saldo: 1000 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SalaPage · entrada a la sala', () => {
  it('HU-05 · Ingreso a una subasta activa: muestra el lote y el precio actual sin esperar al WebSocket', async () => {
    vi.mocked(api.detalle).mockResolvedValue(detalle({ ficha: { identificacion: 'L-001', tipoCafe: 'Geisha', pesoKg: 70, edadMeses: 2, observaciones: null } }))
    renderEnApp(<SalaPage />, { usuario: ANA, ruta: '/subastas/s1/sala', patron: '/subastas/:id/sala' })
    expect(screen.getByText('Entrando a la sala…')).toBeTruthy()

    await esperar()

    expect(socket().subastaId).toBe('s1')
    expect(socket().token).toBe('token-u-ana')
    expect(screen.getByRole('heading', { name: 'Geisha lavado' })).toBeTruthy()
    expect(screen.getByText('Subasta de Luis')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Geisha' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Panel de puja' })).getByText('Precio actual').nextElementSibling?.textContent).toBe('100 Orbes')
    expect(screen.getByText('Conectando con la sala en vivo…')).toBeTruthy()
    expect(screen.getByTestId('video')).toBeTruthy()
  })

  it('HU-05 · Ingreso a una subasta finalizada: lleva a los resultados en lugar de la sala', async () => {
    await abrir(detalle({ estado: 'FINALIZADA' }))
    expect(screen.getByTestId('ubicacion').textContent).toBe('/subastas/s1/resultados')
  })

  it('Hallazgo 24 · una subasta inexistente muestra el error y deja de reintentar la conexión', async () => {
    vi.mocked(api.detalle).mockRejectedValue(new ApiError(404, 'La subasta no existe'))
    renderEnApp(<SalaPage />, { usuario: ANA, ruta: '/subastas/s1/sala', patron: '/subastas/:id/sala' })
    await esperar()

    expect(screen.getByRole('alert').textContent).toContain('No pudimos abrir la sala')
    expect(screen.getByRole('alert').textContent).toContain('La subasta no existe')
    expect(socket().cerrado).toBe(true)
    expect(screen.getByRole('link', { name: 'Volver al home' }).getAttribute('href')).toBe('/comprador')
  })

  it('un fallo de red al cargar no cierra la conexión: se sigue reintentando', async () => {
    vi.mocked(api.detalle).mockRejectedValue('sin red')
    renderEnApp(<SalaPage />, { usuario: ANA, ruta: '/subastas/s1/sala', patron: '/subastas/:id/sala' })
    await esperar()

    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar la sala')
    expect(socket().cerrado).toBe(false)
  })

  it('sin sesión la sala no se abre', () => {
    renderEnApp(<SalaPage />, { usuario: null, ruta: '/subastas/s1/sala', patron: '/subastas/:id/sala' })
    expect(sockets).toHaveLength(0)
  })

  it('al salir de la sala se cierra la conexión en vivo', async () => {
    const { unmount } = await abrir(detalle())
    unmount()
    expect(socket().cerrado).toBe(true)
  })
})

describe('SalaPage · subasta en vivo', () => {
  it('HU-15 · Conteo actualizado: todos ven el contador sin recargar', async () => {
    await abrir(detalle())
    recibir('CONECTADOS', { conectados: 3 })
    expect(screen.getByTitle('Personas conectadas a la sala').textContent).toBe('3 conectados')

    recibir('CONECTADOS', { conectados: 4 })
    expect(screen.getByTitle('Personas conectadas a la sala').textContent).toBe('4 conectados')
  })

  it('HU-15 · el video sigue el estado de la transmisión', async () => {
    vi.mocked(api.estadoTransmision).mockResolvedValue({ transmitiendo: true, sala: 's1' })
    await abrir(detalle())
    expect(screen.getByTestId('video').textContent).toBe('receptor:en vivo')

    recibir('TRANSMISION_DETENIDA')
    expect(screen.getByTestId('video').textContent).toBe('receptor:sin señal')

    recibir('TRANSMISION_INICIADA')
    expect(screen.getByTestId('video').textContent).toBe('receptor:en vivo')
  })

  it('si no se puede consultar la transmisión la sala abre igual, sin señal', async () => {
    vi.mocked(api.estadoTransmision).mockRejectedValue(new Error('streaming caído'))
    await abrir(detalle())
    expect(screen.getByTestId('video').textContent).toBe('receptor:sin señal')
  })

  it('HU-13 · la puja rápida viaja por el WebSocket', async () => {
    await abrir(detalle())

    fireEvent.click(screen.getByRole('button', { name: 'Pujar 110' }))

    expect(socket().enviados).toEqual([{ tipo: 'PUJAR', monto: 110 }])
  })

  it('HU-16 · Actualización tras una puja: precio, líder e historial sin recargar', async () => {
    await abrir(detalle())
    expect(screen.getByText('Todavía no hay pujas.')).toBeTruthy()

    recibir('PUJA_ACEPTADA', {
      pujaId: 'p1',
      usuarioId: 'u-bruno',
      usuarioNombre: 'Bruno',
      monto: 120,
      cantidadPujas: 1,
      siguienteMinimo: 130,
      ocurridaEn: '2026-10-05T15:01:00Z',
    })
    recibir('PUJA_ACEPTADA', {
      pujaId: 'p2',
      usuarioId: ANA.id,
      usuarioNombre: 'Ana',
      monto: 130,
      cantidadPujas: 2,
      siguienteMinimo: 140,
      ocurridaEn: '2026-10-05T15:02:00Z',
    })

    expect(within(screen.getByRole('region', { name: 'Panel de puja' })).getByText('Precio actual').nextElementSibling?.textContent).toBe('130 Orbes')
    expect(screen.getByText('Vas ganando, Ana')).toBeTruthy()
    const pujas = within(screen.getByRole('region', { name: 'Últimas pujas' }))
    expect(pujas.getByText('2 pujas')).toBeTruthy()
    expect(pujas.getAllByRole('listitem').map((p) => p.querySelector('.puja__nombre')?.textContent)).toEqual(['Ana (tú)', 'Bruno'])
    expect(pujas.getAllByRole('listitem')[0].className).toBe('puja puja--lider puja--mia')
  })

  it('HU-14 · el motivo del rechazo de una puja se muestra y se retira solo', async () => {
    await abrir(detalle())

    recibir('PUJA_RECHAZADA', { mensaje: 'Orbes insuficientes' })
    expect(screen.getByRole('alert').textContent).toBe('Orbes insuficientes')

    await esperar(6000)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('HU-17 · el temporizador solo se muestra con la subasta en curso', async () => {
    await abrir(detalle({ estado: 'PROGRAMADA', horaInicio: null, horaFin: null }))
    expect(screen.queryByRole('timer')).toBeNull()

    recibir('SUBASTA_INICIADA', { precioBase: 100, incrementoMinimo: 10, horaInicio: '2026-10-05T15:00:00Z', horaFin: '2026-10-05T15:10:00Z' })

    expect(screen.getByRole('timer').textContent).toBe('10:00')
    expect(screen.getByRole('button', { name: 'Pujar 110' })).toBeTruthy()
  })

  it('HU-17 · el temporizador usa la hora del servidor aunque el reloj del navegador esté desajustado', async () => {
    // El servidor va 5 minutos por delante de este navegador.
    await abrir(detalle({ horaServidor: '2026-10-05T15:05:00Z' }))
    expect(screen.getByRole('timer').textContent).toBe('05:00')
  })

  it('HU-18 · Extensión por puja al final: avisa a los conectados y el temporizador toma el nuevo tiempo', async () => {
    await abrir(detalle({ horaFin: '2026-10-05T15:00:15Z' }))
    expect(screen.getByRole('timer').textContent).toContain('00:15')

    recibir('TIEMPO_EXTENDIDO', { segundosExtendidos: 30, extension: 1, maximoExtensiones: 3, horaFin: '2026-10-05T15:00:45Z' })

    expect(screen.getByText('Tiempo extendido')).toBeTruthy()
    expect(screen.getByText('Tiempo extendido').parentElement?.textContent).toBe('Tiempo extendido 30 segundos por una puja al final (extensión 1 de 3).')
    expect(screen.getByRole('timer').textContent).toContain('00:45')

    // El aviso se retira solo.
    await esperar(6000)
    expect(screen.queryByText('Tiempo extendido')).toBeNull()
  })

  it('HU-18 · sin un máximo de extensiones el aviso no lo menciona', async () => {
    await abrir(detalle())
    recibir('TIEMPO_EXTENDIDO', { segundosExtendidos: 30, extension: 1, maximoExtensiones: 0, horaFin: '2026-10-05T15:10:30Z' })
    expect(screen.getByText('Tiempo extendido').parentElement?.textContent).toBe('Tiempo extendido 30 segundos por una puja al final.')
  })

  it('si la conexión se cae lo avisa y al volver se sincroniza con el servidor', async () => {
    await abrir(detalle())
    expect(screen.queryByText(/Conectando|Se perdió la conexión/)).toBeNull()

    await conexion('cerrada')
    expect(screen.getByText(/Se perdió la conexión con la sala/)).toBeTruthy()
    expect(screen.getByText('Reconectando con la sala…')).toBeTruthy()

    // Mientras estaba caída hubo una puja: al reconectar se vuelve a pedir el detalle.
    vi.mocked(api.detalle).mockResolvedValue(detalle({ precioActual: 150, siguienteMinimo: 160, lider: { id: 'u-bruno', nombre: 'Bruno' }, cantidadPujas: 1 }))
    await conexion('abierta')

    expect(screen.getByText('Lidera Bruno')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pujar 160' })).toBeTruthy()
  })
})

describe('SalaPage · cierre de la subasta', () => {
  it('HU-19 y HU-21 · Cierre con ganador: la sala pasa a Finalizada y anuncia ganador y monto final', async () => {
    await abrir(detalle())

    recibir('SUBASTA_CERRADA', { ...cierreConGanador, ganadorId: 'u-bruno', ganadorNombre: 'Bruno' })

    const anuncio = within(screen.getByRole('dialog'))
    expect(anuncio.getByRole('heading', { name: 'Ganó Bruno' })).toBeTruthy()
    expect(anuncio.getByText('300 Orbes')).toBeTruthy()
    expect(screen.getByText('Finalizada')).toBeTruthy()
    expect(screen.queryByRole('timer')).toBeNull()
    expect((screen.getByRole('button', { name: 'Subasta cerrada' }) as HTMLButtonElement).disabled).toBe(true)
    // HU-23: desde el anuncio se vuelve al home del rol o se pasa a los resultados.
    expect(anuncio.getByRole('link', { name: 'Ver resultados' }).getAttribute('href')).toBe('/subastas/s1/resultados')
    expect(anuncio.getByRole('link', { name: 'Volver al home' }).getAttribute('href')).toBe('/comprador')
  })

  it('HU-21 · al ganador el anuncio le habla directamente y toma el foco', async () => {
    await abrir(detalle())

    recibir('SUBASTA_CERRADA', cierreConGanador)

    expect(screen.getByRole('heading', { name: '¡Ganaste, Ana!' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Ver resultados' }))
  })

  it('HU-21 · Anuncio de subasta desierta: "Subasta desierta: no hubo ganador"', async () => {
    await abrir(detalle())

    recibir('SUBASTA_CERRADA', { estado: 'DESIERTA', ganadorId: null, ganadorNombre: null, montoFinal: null, cantidadPujas: 0 })

    const anuncio = within(screen.getByRole('dialog'))
    expect(anuncio.getByRole('heading', { name: 'Subasta desierta: no hubo ganador' })).toBeTruthy()
    expect(anuncio.queryByText(/Monto final/)).toBeNull()
    expect(screen.getByText('Desierta')).toBeTruthy()
  })

  it('el anuncio se cierra con Escape o con "Seguir en la sala" para ver el estado final', async () => {
    await abrir(detalle())
    recibir('SUBASTA_CERRADA', cierreConGanador)

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // La sala se queda abierta con el estado final, no salta a los resultados.
    expect(screen.getByRole('heading', { name: 'Geisha lavado' })).toBeTruthy()
  })

  it('"Seguir en la sala" cierra el anuncio', async () => {
    await abrir(detalle())
    recibir('SUBASTA_CERRADA', cierreConGanador)

    fireEvent.click(screen.getByRole('button', { name: 'Seguir en la sala' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('HU-20 · tras el cierre y tras el cobro se vuelve a consultar el saldo', async () => {
    const consultas = vi.fn()
    window.addEventListener('cafeorbe:saldo-cambio', consultas)
    await abrir(detalle())

    recibir('SUBASTA_CERRADA', cierreConGanador)
    expect(consultas).not.toHaveBeenCalled()
    await esperar(2000)
    expect(consultas).toHaveBeenCalledTimes(1)

    recibir('ORBES_COBRADOS', { monto: 300, saldo: 700 })
    expect(consultas).toHaveBeenCalledTimes(2)
    window.removeEventListener('cafeorbe:saldo-cambio', consultas)
  })

  it('HU-19 · si el aviso de cierre se pierde, pasada la hora de fin la sala consulta al servidor', async () => {
    await abrir(detalle({ horaFin: '2026-10-05T15:00:10Z' }))
    const consultasAntes = vi.mocked(api.detalle).mock.calls.length

    // Antes de la hora de fin no hay nada que consultar.
    await esperar(9000)
    expect(vi.mocked(api.detalle).mock.calls.length).toBe(consultasAntes)

    vi.mocked(api.detalle).mockResolvedValue(detalle({ estado: 'FINALIZADA' }))
    await esperar(6000)

    expect(vi.mocked(api.detalle).mock.calls.length).toBeGreaterThan(consultasAntes)
    expect(screen.getByTestId('ubicacion').textContent).toBe('/subastas/s1/resultados')
  })
})

describe('SalaPage · Subastador', () => {
  const programada = () => detalle({ estado: 'PROGRAMADA', horaInicio: null, horaFin: null })

  it('ve el control de la subasta en lugar del botón de puja', async () => {
    await abrir(detalle({ precioActual: 120, lider: { id: ANA.id, nombre: 'Ana' } }), LUIS)

    expect(screen.getByRole('heading', { name: 'Control de la subasta' })).toBeTruthy()
    expect(screen.getByText('Lidera Ana')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Panel de puja' })).toBeNull()
    expect(screen.getByTestId('video').textContent).toBe('emisor:sin señal')
  })

  it('HU-12 · inicia la subasta desde la sala', async () => {
    vi.mocked(api.iniciarSubasta).mockResolvedValue(detalle())
    await abrir(programada(), LUIS)
    expect(screen.getByRole('link', { name: 'Configurar ficha y reglas' }).getAttribute('href')).toBe('/subastador/subastas/s1')

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar subasta' }))
    await esperar()

    expect(api.iniciarSubasta).toHaveBeenCalledWith('s1')
    expect(screen.getByText('En curso')).toBeTruthy()
    expect(screen.getByRole('timer')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Configurar ficha y reglas' })).toBeNull()
  })

  it('Hallazgo 19 · mientras transmite no se ofrece salir a configurar', async () => {
    vi.mocked(api.estadoTransmision).mockResolvedValue({ transmitiendo: true, sala: 's1' })
    await abrir(programada(), LUIS)

    expect(screen.getByText('Detén la transmisión para configurar la ficha y las reglas.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Configurar ficha y reglas' })).toBeNull()
  })

  it('sin reglas configuradas no hay precio que mostrar', async () => {
    await abrir(detalle({ estado: 'PROGRAMADA', reglas: null, precioActual: null, siguienteMinimo: null, horaInicio: null, horaFin: null }), LUIS)
    expect(screen.getByText('Sin reglas')).toBeTruthy()
  })

  it('HU-23 · tras el cierre vuelve al home del Subastador', async () => {
    await abrir(detalle(), LUIS)
    recibir('SUBASTA_CERRADA', cierreConGanador)

    expect(screen.getByRole('heading', { name: 'Ganó Ana' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver al home' }).getAttribute('href')).toBe('/subastador')
  })
})
