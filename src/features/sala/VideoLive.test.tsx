// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import { VideoLive } from './VideoLive'

/** Sustituto del SDK de LiveKit: registra a qué sala se conectó cada navegador y qué pistas adjuntó. */
const { salas, RoomFalsa, estado } = vi.hoisted(() => {
  interface Pista {
    kind: string
    attach: (elemento: unknown) => void
  }
  const estado = { falloAlConectar: null as Error | null, falloDeMicrofono: false, pistasPublicadas: [] as Pista[] }

  class RoomFalsa {
    conectadaA: { url: string; token: string } | null = null
    desconectada = false
    camaraEncendida = false
    oyentes = new Map<string, (pista?: Pista) => void>()
    pistaDeCamara = { attach: () => undefined }
    remoteParticipants = new Map([['emisor', { trackPublications: new Map<string, { track: Pista | null }>() }]])
    localParticipant = {
      setCameraEnabled: async (activa: boolean) => {
        this.camaraEncendida = activa
      },
      setMicrophoneEnabled: async () => {
        if (estado.falloDeMicrofono) throw new Error('micrófono ocupado')
      },
      getTrackPublication: () => ({ track: this.pistaDeCamara }),
    }

    constructor(readonly opciones?: unknown) {
      salas.push(this)
      estado.pistasPublicadas.forEach((pista, i) => this.remoteParticipants.get('emisor')!.trackPublications.set(`p${i}`, { track: pista }))
      // Una publicación todavía sin pista (el emisor la está negociando) no debe romper nada.
      this.remoteParticipants.get('emisor')!.trackPublications.set('pendiente', { track: null })
    }

    on(evento: string, oyente: (pista?: Pista) => void) {
      this.oyentes.set(evento, oyente)
    }

    /** Simula un aviso de LiveKit sobre el estado de la conexión. */
    avisar(evento: 'reconnecting' | 'reconnected' | 'disconnected') {
      this.oyentes.get(evento)?.()
    }

    async connect(url: string, token: string) {
      if (estado.falloAlConectar) throw estado.falloAlConectar
      this.conectadaA = { url, token }
    }

    disconnect() {
      this.desconectada = true
    }
  }
  const salas: RoomFalsa[] = []
  return { salas, RoomFalsa, estado }
})

vi.mock('livekit-client', () => ({
  Room: RoomFalsa,
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Video: 'video', Audio: 'audio' }, Source: { Camera: 'camera' } },
}))
vi.mock('../../shared/api/endpoints', () => ({
  api: {
    credencialesTransmision: vi.fn(),
    iniciarTransmision: vi.fn(),
    detenerTransmision: vi.fn(),
    detenerTransmisionAlSalir: vi.fn(),
  },
}))

const CREDENCIALES = { url: 'wss://livekit.test', token: 'tk', sala: 's1' }
const pedirMedios = vi.fn()
const sala = () => salas[salas.length - 1]
const pista = (kind: string) => ({ kind, attach: vi.fn() })

/** Simula lo que responde el navegador al pedir cada dispositivo. */
function permisos({ camara = true, microfono = true } = {}) {
  pedirMedios.mockImplementation(async (restricciones: MediaStreamConstraints) => {
    if (restricciones.video && !camara) throw new Error('NotAllowedError')
    if (restricciones.audio && !microfono) throw new Error('NotFoundError')
    return { getTracks: () => [{ stop: vi.fn() }] }
  })
}

const comprador = (transmitiendo: boolean) => <VideoLive subastaId="s1" esSubastador={false} transmitiendo={transmitiendo} />
const subastador = (transmitiendo = false) => <VideoLive subastaId="s1" esSubastador transmitiendo={transmitiendo} />

async function iniciarTransmision() {
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar transmisión' }))
  await screen.findByRole('button', { name: 'Detener transmisión' })
}

beforeEach(() => {
  vi.resetAllMocks()
  salas.length = 0
  estado.falloAlConectar = null
  estado.falloDeMicrofono = false
  estado.pistasPublicadas = []
  permisos()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: pedirMedios } })
  vi.mocked(api.credencialesTransmision).mockResolvedValue(CREDENCIALES)
  vi.mocked(api.iniciarTransmision).mockResolvedValue(CREDENCIALES)
  vi.mocked(api.detenerTransmision).mockResolvedValue({ transmitiendo: false, sala: 's1' })
})

describe('VideoLive · Comprador (HU-15)', () => {
  it('Sin transmisión: muestra "La transmisión aún no ha iniciado"', () => {
    const { container } = render(comprador(false))

    expect(screen.getByText('La transmisión aún no ha iniciado')).toBeTruthy()
    expect(screen.queryByText('EN VIVO')).toBeNull()
    expect(container.querySelector('.video__controles')).toBeNull()
    expect(api.credencialesTransmision).not.toHaveBeenCalled()
  })

  it('Transmisión activa: se conecta a la sala de video y muestra EN VIVO', async () => {
    const video = pista('video')
    const audio = pista('audio')
    estado.pistasPublicadas = [video]
    const { container } = render(comprador(true))

    await waitFor(() => expect(sala()?.conectadaA).toEqual({ url: 'wss://livekit.test', token: 'tk' }))
    expect(api.credencialesTransmision).toHaveBeenCalledWith('s1')
    expect(screen.getByText('EN VIVO')).toBeTruthy()
    expect(screen.queryByText('La transmisión aún no ha iniciado')).toBeNull()
    // El video ya publicado se adjunta al entrar; el audio llega después como evento.
    await waitFor(() => expect(video.attach).toHaveBeenCalledWith(container.querySelector('video')))
    act(() => sala().oyentes.get('trackSubscribed')?.(audio))
    expect(audio.attach).toHaveBeenCalledWith(container.querySelector('audio'))
  })

  it('HU-11 · Detener la transmisión: el video se corta y se ve "Transmisión finalizada"', async () => {
    const { rerender } = render(comprador(true))
    await waitFor(() => expect(sala()?.conectadaA).toBeTruthy())

    rerender(comprador(false))

    expect(screen.getByText('Transmisión finalizada')).toBeTruthy()
    expect(screen.queryByText('EN VIVO')).toBeNull()
    expect(sala().desconectada).toBe(true)
  })

  it('si no puede conectarse a la transmisión muestra el motivo', async () => {
    vi.mocked(api.credencialesTransmision).mockRejectedValueOnce(new Error('No hay transmisión activa'))
    const { rerender } = render(comprador(true))
    expect((await screen.findByRole('alert')).textContent).toBe('No hay transmisión activa')

    vi.mocked(api.credencialesTransmision).mockRejectedValueOnce('fallo')
    rerender(comprador(false))
    rerender(comprador(true))
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo conectar con la transmisión')
  })

  it('pide a LiveKit solo la calidad que cada espectador necesita', async () => {
    render(comprador(true))
    await waitFor(() => expect(sala()?.conectadaA).toBeTruthy())
    expect(sala().opciones).toEqual({ adaptiveStream: true, dynacast: true })
  })

  it('si la red parpadea avisa que está reconectando y lo retira al volver', async () => {
    render(comprador(true))
    await waitFor(() => expect(sala()?.conectadaA).toBeTruthy())

    act(() => sala().avisar('reconnecting'))
    expect(screen.getByRole('status').textContent).toBe('Reconectando el video…')
    expect(screen.getByText('EN VIVO')).toBeTruthy()

    act(() => sala().avisar('reconnected'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('si el video se cae con la transmisión activa vuelve a conectarse solo', async () => {
    render(comprador(true))
    await waitFor(() => expect(sala()?.conectadaA).toBeTruthy())

    act(() => sala().avisar('disconnected'))
    expect(screen.getByRole('status').textContent).toBe('Reconectando el video…')

    await waitFor(() => expect(salas).toHaveLength(2), { timeout: 5000 })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(sala().conectadaA).toEqual({ url: 'wss://livekit.test', token: 'tk' })
    expect(api.credencialesTransmision).toHaveBeenCalledTimes(2)
  })

  it('si la reconexión falla sigue intentando sin mostrar un error nuevo', async () => {
    render(comprador(true))
    await waitFor(() => expect(sala()?.conectadaA).toBeTruthy())
    vi.mocked(api.credencialesTransmision).mockRejectedValueOnce(new Error('Error 502'))

    act(() => sala().avisar('disconnected'))

    await waitFor(() => expect(api.credencialesTransmision).toHaveBeenCalledTimes(2), { timeout: 5000 })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Reconectando el video…')
  })

  it('si sale de la sala mientras se conectaba no deja la conexión abierta', async () => {
    let entregar: (c: typeof CREDENCIALES) => void = () => undefined
    vi.mocked(api.credencialesTransmision).mockReturnValueOnce(new Promise((resolver) => (entregar = resolver)))
    const { unmount } = render(comprador(true))

    unmount()
    await act(async () => entregar(CREDENCIALES))

    expect(salas).toHaveLength(0)
  })

  it('si la transmisión termina justo al conectar se desconecta', async () => {
    const conectar = vi.spyOn(RoomFalsa.prototype, 'connect')
    let terminar: () => void = () => undefined
    conectar.mockImplementationOnce(() => new Promise<void>((resolver) => (terminar = resolver)))
    const { rerender } = render(comprador(true))
    await waitFor(() => expect(conectar).toHaveBeenCalled())

    rerender(comprador(false))
    await act(async () => terminar())

    expect(sala().desconectada).toBe(true)
    conectar.mockRestore()
  })
})

describe('VideoLive · Subastador (HU-11)', () => {
  it('Inicio de transmisión: pide la cámara, publica el video y muestra EN VIVO', async () => {
    render(subastador())
    expect(screen.getByText('La transmisión aún no ha iniciado')).toBeTruthy()

    await iniciarTransmision()

    expect(pedirMedios.mock.calls.map(([r]) => r)).toEqual([{ video: true }, { audio: true }])
    expect(api.iniciarTransmision).toHaveBeenCalledWith('s1')
    expect(sala().conectadaA).toEqual({ url: 'wss://livekit.test', token: 'tk' })
    expect(sala().camaraEncendida).toBe(true)
    expect(screen.getByText('EN VIVO')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Detener la transmisión: corta el video y avisa al servidor', async () => {
    render(subastador())
    await iniciarTransmision()

    fireEvent.click(screen.getByRole('button', { name: 'Detener transmisión' }))

    expect(await screen.findByRole('button', { name: 'Iniciar transmisión' })).toBeTruthy()
    expect(api.detenerTransmision).toHaveBeenCalledWith('s1')
    expect(sala().desconectada).toBe(true)
    expect(screen.getByText('Transmisión finalizada')).toBeTruthy()
  })

  it('Permiso de cámara denegado: muestra "No se pudo acceder a la cámara" y no cambia el indicador', async () => {
    permisos({ camara: false })
    render(subastador())

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar transmisión' }))

    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo acceder a la cámara')
    expect(api.iniciarTransmision).not.toHaveBeenCalled()
    expect(screen.queryByText('EN VIVO')).toBeNull()
    expect(screen.getByRole('button', { name: 'Iniciar transmisión' })).toBeTruthy()
  })

  it('Hallazgo 15 · sin micrófono transmite solo video y lo avisa', async () => {
    permisos({ microfono: false })
    render(subastador())

    await iniciarTransmision()

    expect(screen.getByRole('status').textContent).toBe('No se pudo acceder al micrófono: la transmisión va sin audio')
    expect(screen.getByText('EN VIVO')).toBeTruthy()
  })

  it('Hallazgo 15 · si el micrófono falla al publicar, la transmisión sigue sin audio', async () => {
    estado.falloDeMicrofono = true
    render(subastador())

    await iniciarTransmision()

    expect(screen.getByRole('status').textContent).toBe('No se pudo acceder al micrófono: la transmisión va sin audio')
  })

  it('si no se puede conectar con el video, deshace el inicio y muestra el motivo', async () => {
    estado.falloAlConectar = new Error('LiveKit no responde')
    render(subastador())

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar transmisión' }))

    expect((await screen.findByRole('alert')).textContent).toBe('LiveKit no responde')
    // El servidor ya había marcado la transmisión como activa: se le avisa que no arrancó.
    expect(api.detenerTransmision).toHaveBeenCalledWith('s1')
    expect(screen.queryByText('EN VIVO')).toBeNull()
  })

  it('un fallo sin detalle al iniciar o detener se explica con un mensaje genérico', async () => {
    vi.mocked(api.iniciarTransmision).mockRejectedValueOnce('fallo')
    vi.mocked(api.detenerTransmision).mockRejectedValueOnce(new Error('ya estaba detenida'))
    render(subastador())
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar transmisión' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo iniciar la transmisión')

    await iniciarTransmision()
    vi.mocked(api.detenerTransmision).mockRejectedValueOnce(new Error('Error 500')).mockRejectedValueOnce('fallo')
    fireEvent.click(screen.getByRole('button', { name: 'Detener transmisión' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Error 500')

    await iniciarTransmision()
    fireEvent.click(screen.getByRole('button', { name: 'Detener transmisión' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo detener la transmisión')
  })

  it('si la emisión se cae vuelve a emitir sola, sin que el Subastador haga nada', async () => {
    render(subastador())
    await iniciarTransmision()

    act(() => sala().avisar('disconnected'))
    expect(screen.getByRole('status').textContent).toBe('Reconectando el video…')

    await waitFor(() => expect(salas).toHaveLength(2), { timeout: 5000 })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(sala().camaraEncendida).toBe(true)
    expect(api.iniciarTransmision).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Detener transmisión' })).toBeTruthy()
    expect(api.detenerTransmision).not.toHaveBeenCalled()
  })

  it('si no logra volver a emitir lo dice y deja de mostrarse EN VIVO', async () => {
    render(subastador())
    await iniciarTransmision()
    estado.falloAlConectar = new Error('sin red')

    act(() => sala().avisar('disconnected'))

    expect((await screen.findByRole('alert', undefined, { timeout: 10_000 })).textContent).toBe(
      'Se perdió la conexión del video. Pulsa Iniciar transmisión para volver a emitir.',
    )
    expect(screen.getByRole('button', { name: 'Iniciar transmisión' })).toBeTruthy()
    expect(screen.queryByText('EN VIVO')).toBeNull()
    expect(api.iniciarTransmision).toHaveBeenCalledTimes(4)
    expect(api.detenerTransmision).toHaveBeenCalledWith('s1')
  })

  it('detener mientras se reconectaba no vuelve a poner el video al aire', async () => {
    render(subastador())
    await iniciarTransmision()

    act(() => sala().avisar('disconnected'))
    fireEvent.click(screen.getByRole('button', { name: 'Detener transmisión' }))
    await screen.findByRole('button', { name: 'Iniciar transmisión' })
    await act(() => new Promise((listo) => setTimeout(listo, 2500)))

    expect(salas).toHaveLength(1)
    expect(api.iniciarTransmision).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('EN VIVO')).toBeNull()
  })

  it('el aviso de desconexión de una sala que el propio Subastador cerró se ignora', async () => {
    render(subastador())
    await iniciarTransmision()
    const cerrada = sala()
    fireEvent.click(screen.getByRole('button', { name: 'Detener transmisión' }))
    await screen.findByRole('button', { name: 'Iniciar transmisión' })

    act(() => cerrada.avisar('disconnected'))

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Hallazgo 12 · al cerrar la pestaña mientras transmite avisa al servidor', async () => {
    render(subastador())

    // Sin transmisión en curso no hay nada que avisar.
    fireEvent(window, new Event('pagehide'))
    expect(api.detenerTransmisionAlSalir).not.toHaveBeenCalled()

    await iniciarTransmision()
    fireEvent(window, new Event('pagehide'))

    expect(api.detenerTransmisionAlSalir).toHaveBeenCalledWith('s1')
  })

  it('Hallazgo 19 · al salir de la sala mientras transmite se corta el video', async () => {
    const { unmount } = render(subastador())
    await iniciarTransmision()

    unmount()

    expect(sala().desconectada).toBe(true)
    expect(api.detenerTransmision).toHaveBeenCalledWith('s1')
  })

  it('salir de la sala sin haber transmitido no avisa a nadie', () => {
    const { unmount } = render(subastador())
    unmount()
    expect(api.detenerTransmision).not.toHaveBeenCalled()
  })
})
