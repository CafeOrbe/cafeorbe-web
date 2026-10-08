import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { api } from '../../shared/api/endpoints'
import { EnVivo } from '../../shared/ui/EtiquetaEstado'
import { LoaderCircle, Radio, Square, Video, VideoOff } from 'lucide-react'
import { verificarDispositivos } from './dispositivos'

export const MSG_SIN_TRANSMISION = 'La transmisión aún no ha iniciado'
export const MSG_TRANSMISION_FINALIZADA = 'Transmisión finalizada'
export const MSG_CAMARA = 'No se pudo acceder a la cámara'
export const MSG_SIN_MICROFONO = 'No se pudo acceder al micrófono: la transmisión va sin audio'
export const MSG_RECONECTANDO = 'Reconectando el video…'
export const MSG_TRANSMISION_CAIDA = 'Se perdió la conexión del video. Pulsa Iniciar transmisión para volver a emitir.'

/** Espera antes de reintentar la conexión del video cuando se cae. */
const ESPERA_REINTENTO_MS = 2000
/** Veces que el Subastador intenta volver a emitir solo antes de pedirle que lo haga a mano. */
const REINTENTOS_DEL_EMISOR = 3

/**
 * Sala de LiveKit con los ajustes para muchos espectadores: cada navegador recibe solo la calidad que su
 * reproductor necesita (adaptiveStream) y el emisor deja de enviar las calidades que nadie está viendo (dynacast).
 */
function nuevaSala(): Room {
  return new Room({ adaptiveStream: true, dynacast: true })
}

interface Props {
  subastaId: string
  esSubastador: boolean
  /** Estado de la transmisión según el servidor (consulta inicial y eventos de la sala). */
  transmitiendo: boolean
}

/**
 * HU-11: el Subastador emite su cámara; los compradores la reciben. El video viaja por LiveKit (WebRTC);
 * el streaming-service solo entrega las credenciales y guarda si hay transmisión activa.
 */
export function VideoLive({ subastaId, esSubastador, transmitiendo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const sala = useRef<Room | null>(null)
  const estuvoEnVivo = useRef(false)
  const reintentosDelEmisor = useRef(0)
  /** Cambia cuando el Subastador detiene o sale: una reconexión automática en curso debe abandonar. */
  const emision = useRef(0)
  const [publicando, setPublicando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [reconectando, setReconectando] = useState(false)
  /** Cambia cada vez que el comprador debe volver a conectarse al video. */
  const [intento, setIntento] = useState(0)

  const enVivo = publicando || transmitiendo
  if (enVivo) estuvoEnVivo.current = true

  const desconectar = useCallback(() => {
    // Se suelta la referencia antes de desconectar: así el aviso de desconexión de LiveKit se reconoce como
    // provocado aquí y no dispara una reconexión.
    const actual = sala.current
    sala.current = null
    actual?.disconnect()
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // ── Comprador: se conecta cuando hay transmisión y se desconecta cuando termina ──
  useEffect(() => {
    if (esSubastador || !transmitiendo) {
      setReconectando(false)
      setIntento(0)
      return
    }
    let cancelado = false
    let reintento: number | undefined
    if (intento === 0) setError(null)

    const adjuntar = (pista: RemoteTrack) => {
      if (pista.kind === Track.Kind.Video && videoRef.current) pista.attach(videoRef.current)
      if (pista.kind === Track.Kind.Audio && audioRef.current) pista.attach(audioRef.current)
    }
    // La transmisión sigue activa pero el video no llegó o se cayó: se vuelve a intentar en lugar de dejar al
    // comprador con la pantalla en negro hasta que recargue la página.
    const reintentar = () => {
      if (cancelado) return
      setReconectando(true)
      // Espera creciente (2, 4, 8 y 16 s): si el servicio de video está caído no se le insiste sin pausa.
      reintento = window.setTimeout(() => setIntento((n) => n + 1), ESPERA_REINTENTO_MS * 2 ** Math.min(intento, 3))
    }

    ;(async () => {
      try {
        const credenciales = await api.credencialesTransmision(subastaId)
        if (cancelado) return
        const nueva = nuevaSala()
        nueva.on(RoomEvent.TrackSubscribed, adjuntar)
        nueva.on(RoomEvent.Reconnecting, () => !cancelado && setReconectando(true))
        nueva.on(RoomEvent.Reconnected, () => !cancelado && setReconectando(false))
        nueva.on(RoomEvent.Disconnected, () => {
          if (sala.current !== nueva) return
          sala.current = null
          reintentar()
        })
        await nueva.connect(credenciales.url, credenciales.token)
        if (cancelado) {
          nueva.disconnect()
          return
        }
        sala.current = nueva
        setReconectando(false)
        setError(null)
        // Puede haber pistas ya publicadas antes de que este navegador entrara.
        nueva.remoteParticipants.forEach((p) =>
          p.trackPublications.forEach((pub) => {
            if (pub.track) adjuntar(pub.track as RemoteTrack)
          }),
        )
      } catch (e) {
        if (cancelado) return
        // La primera vez se muestra el motivo; después se sigue intentando mientras la transmisión esté activa.
        if (intento === 0) setError(e instanceof Error ? e.message : 'No se pudo conectar con la transmisión')
        reintentar()
      }
    })()

    return () => {
      cancelado = true
      window.clearTimeout(reintento)
      desconectar()
    }
  }, [esSubastador, transmitiendo, subastaId, desconectar, intento])

  // ── Subastador: si sale de la sala mientras transmite, se corta el video ──
  useEffect(() => {
    if (!esSubastador) return
    // Hallazgo 12: al cerrar o recargar la pestaña React no alcanza a desmontar el componente, así que se avisa
    // con una petición keepalive. Si tampoco llega (sin conexión), el servidor se entera por el webhook de LiveKit.
    const alCerrarPestana = () => {
      if (sala.current) api.detenerTransmisionAlSalir(subastaId)
    }
    window.addEventListener('pagehide', alCerrarPestana)
    return () => {
      emision.current++
      window.removeEventListener('pagehide', alCerrarPestana)
      if (sala.current) {
        desconectar()
        void api.detenerTransmision(subastaId).catch(() => undefined)
      }
    }
  }, [esSubastador, subastaId, desconectar])

  /** Conecta la sala de video y publica la cámara. Lanza si algo falla; quien llama decide qué mostrar. */
  async function publicar(conMicrofono: boolean) {
    const credenciales = await api.iniciarTransmision(subastaId)
    const nueva = nuevaSala()
    nueva.on(RoomEvent.Reconnecting, () => setReconectando(true))
    nueva.on(RoomEvent.Reconnected, () => setReconectando(false))
    nueva.on(RoomEvent.Disconnected, () => {
      if (sala.current !== nueva) return
      sala.current = null
      void alPerderLaEmision(conMicrofono)
    })
    await nueva.connect(credenciales.url, credenciales.token)
    sala.current = nueva
    await nueva.localParticipant.setCameraEnabled(true)
    let conAudio = conMicrofono
    if (conAudio) {
      conAudio = await nueva.localParticipant.setMicrophoneEnabled(true).then(
        () => true,
        () => false,
      )
    }
    if (!conAudio) setAviso(MSG_SIN_MICROFONO)
    nueva.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.attach(videoRef.current!)
    setReconectando(false)
    setPublicando(true)
  }

  /**
   * La emisión se cayó sin que el Subastador la detuviera. Antes la pantalla seguía mostrando EN VIVO mientras
   * los compradores ya no veían nada. Ahora intenta volver a emitir sola (el servidor espera unos segundos
   * antes de dar la transmisión por terminada) y, si no puede, lo dice.
   */
  async function alPerderLaEmision(conMicrofono: boolean) {
    const estaEmision = emision.current
    const abandonada = () => emision.current !== estaEmision
    setReconectando(true)
    while (reintentosDelEmisor.current < REINTENTOS_DEL_EMISOR) {
      reintentosDelEmisor.current++
      await new Promise((listo) => window.setTimeout(listo, ESPERA_REINTENTO_MS))
      if (abandonada()) return
      try {
        await publicar(conMicrofono)
        // Si detuvo o salió mientras se reconectaba, no debe quedar emitiendo.
        if (abandonada()) desconectar()
        reintentosDelEmisor.current = 0
        return
      } catch {
        desconectar()
        if (abandonada()) return
      }
    }
    reintentosDelEmisor.current = 0
    setReconectando(false)
    setPublicando(false)
    setError(MSG_TRANSMISION_CAIDA)
    await api.detenerTransmision(subastaId).catch(() => undefined)
  }

  async function iniciar() {
    setError(null)
    setAviso(null)
    setOcupado(true)
    try {
      // Primero se piden los permisos: si se niega la cámara, no se cambia el indicador ni se avisa a nadie.
      // El micrófono es opcional (hallazgo 15): sin él se transmite solo video.
      const { camara, microfono } = await verificarDispositivos((r) => navigator.mediaDevices.getUserMedia(r))
      if (!camara) {
        setError(MSG_CAMARA)
        return
      }
      await publicar(microfono)
    } catch (e) {
      desconectar()
      await api.detenerTransmision(subastaId).catch(() => undefined)
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la transmisión')
    } finally {
      setOcupado(false)
    }
  }

  async function detener() {
    emision.current++
    reintentosDelEmisor.current = 0
    setOcupado(true)
    setAviso(null)
    desconectar()
    try {
      await api.detenerTransmision(subastaId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo detener la transmisión')
    } finally {
      setReconectando(false)
      setPublicando(false)
      setOcupado(false)
    }
  }

  let mensaje: string | null = null
  if (!enVivo) mensaje = estuvoEnVivo.current ? MSG_TRANSMISION_FINALIZADA : MSG_SIN_TRANSMISION

  return (
    <div className="tarjeta video">
      <div className="video__marco">
        <video ref={videoRef} autoPlay playsInline muted={esSubastador} />
        <audio ref={audioRef} autoPlay />
        {mensaje && (
          <p className="video__mensaje">
            <span className="video__mensaje-icono" aria-hidden="true">
              {estuvoEnVivo.current ? <VideoOff /> : <Radio />}
            </span>
            {mensaje}
          </p>
        )}
        {enVivo && reconectando && (
          <p className="video__mensaje" role="status">
            <LoaderCircle className="conexion__giro" aria-hidden="true" />
            {MSG_RECONECTANDO}
          </p>
        )}
        {enVivo && (
          <div className="video__insignias">
            <EnVivo />
          </div>
        )}
      </div>

      {(esSubastador || aviso || error) && (
        <div className="video__controles">
          {esSubastador && (
            <div className="acciones">
              {!publicando ? (
                <button type="button" className="boton boton--primario" onClick={iniciar} disabled={ocupado}>
                  <Video aria-hidden="true" />
                  {ocupado ? 'Iniciando…' : 'Iniciar transmisión'}
                </button>
              ) : (
                <button type="button" className="boton boton--peligro" onClick={detener} disabled={ocupado}>
                  <Square aria-hidden="true" />
                  Detener transmisión
                </button>
              )}
            </div>
          )}
          {aviso && (
            <p className="campo__ayuda" role="status">
              {aviso}
            </p>
          )}
          {error && (
            <p className="campo__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
