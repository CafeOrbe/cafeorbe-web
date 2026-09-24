import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { api } from '../../shared/api/endpoints'
import { verificarDispositivos } from './dispositivos'

export const MSG_SIN_TRANSMISION = 'La transmisión aún no ha iniciado'
export const MSG_TRANSMISION_FINALIZADA = 'Transmisión finalizada'
export const MSG_CAMARA = 'No se pudo acceder a la cámara'
export const MSG_SIN_MICROFONO = 'No se pudo acceder al micrófono: la transmisión va sin audio'

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
  const [publicando, setPublicando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const enVivo = publicando || transmitiendo
  if (enVivo) estuvoEnVivo.current = true

  const desconectar = useCallback(() => {
    sala.current?.disconnect()
    sala.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // ── Comprador: se conecta cuando hay transmisión y se desconecta cuando termina ──
  useEffect(() => {
    if (esSubastador || !transmitiendo) return
    let cancelado = false
    setError(null)

    const adjuntar = (pista: RemoteTrack) => {
      if (pista.kind === Track.Kind.Video && videoRef.current) pista.attach(videoRef.current)
      if (pista.kind === Track.Kind.Audio && audioRef.current) pista.attach(audioRef.current)
    }

    ;(async () => {
      try {
        const credenciales = await api.credencialesTransmision(subastaId)
        if (cancelado) return
        const nueva = new Room()
        nueva.on(RoomEvent.TrackSubscribed, adjuntar)
        await nueva.connect(credenciales.url, credenciales.token)
        if (cancelado) {
          nueva.disconnect()
          return
        }
        sala.current = nueva
        // Puede haber pistas ya publicadas antes de que este navegador entrara.
        nueva.remoteParticipants.forEach((p) =>
          p.trackPublications.forEach((pub) => {
            if (pub.track) adjuntar(pub.track as RemoteTrack)
          }),
        )
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo conectar con la transmisión')
      }
    })()

    return () => {
      cancelado = true
      desconectar()
    }
  }, [esSubastador, transmitiendo, subastaId, desconectar])

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
      window.removeEventListener('pagehide', alCerrarPestana)
      if (sala.current) {
        desconectar()
        void api.detenerTransmision(subastaId).catch(() => undefined)
      }
    }
  }, [esSubastador, subastaId, desconectar])

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

      const credenciales = await api.iniciarTransmision(subastaId)
      const nueva = new Room()
      await nueva.connect(credenciales.url, credenciales.token)
      sala.current = nueva
      await nueva.localParticipant.setCameraEnabled(true)
      let conAudio = microfono
      if (conAudio) {
        conAudio = await nueva.localParticipant.setMicrophoneEnabled(true).then(
          () => true,
          () => false,
        )
      }
      if (!conAudio) setAviso(MSG_SIN_MICROFONO)
      nueva.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.attach(videoRef.current!)
      setPublicando(true)
    } catch (e) {
      desconectar()
      await api.detenerTransmision(subastaId).catch(() => undefined)
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la transmisión')
    } finally {
      setOcupado(false)
    }
  }

  async function detener() {
    setOcupado(true)
    setAviso(null)
    desconectar()
    try {
      await api.detenerTransmision(subastaId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo detener la transmisión')
    } finally {
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
        {mensaje && <p className="video__mensaje">{mensaje}</p>}
        {enVivo && <span className="en-vivo">● EN VIVO</span>}
      </div>

      {esSubastador && (
        <div className="acciones">
          {!publicando ? (
            <button type="button" className="boton boton--primario" onClick={iniciar} disabled={ocupado}>
              {ocupado ? 'Iniciando…' : 'Iniciar transmisión'}
            </button>
          ) : (
            <button type="button" className="boton boton--peligro" onClick={detener} disabled={ocupado}>
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
  )
}
