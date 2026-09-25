import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Gavel, LoaderCircle, Settings2, Users, WifiOff } from 'lucide-react'
import type { Detalle } from '../../shared/api/types'
import { formatFechaHora, formatHora, iniciales } from '../../shared/format'
import { rutaInicio, rutas } from '../../shared/routes'
import { tokenActual, useSesion } from '../../shared/session'
import type { EstadoConexion } from '../../shared/ws/salaSocket'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { Esqueleto, EstadoError, EstadoVacio } from '../../shared/ui/Estados'
import { IconoOrbe, Monto } from '../../shared/ui/Orbe'
import { IniciarSubastaBoton } from '../subasta/IniciarSubastaBoton'
import { FichaLoteCard } from './FichaLoteCard'
import { PanelPuja } from './PanelPuja'
import { useSala } from './useSala'

// El SDK de video (LiveKit) es pesado: se descarga solo al entrar a una sala.
const VideoLive = lazy(() => import('./VideoLive').then((m) => ({ default: m.VideoLive })))

/** Sala de una subasta (HU-05): lote, precio, líder, pujas, conectados y video. */
export function SalaPage() {
  const { id = '' } = useParams()
  const { usuario } = useSesion()
  const token = tokenActual()
  if (!usuario || !token) return null
  return <Sala subastaId={id} token={token} usuarioId={usuario.id} esSubastador={usuario.rol === 'SUBASTADOR'} />
}

function Sala({ subastaId, token, usuarioId, esSubastador }: { subastaId: string; token: string; usuarioId: string; esSubastador: boolean }) {
  const { estado, pujar, limpiarAviso, dispatch } = useSala(subastaId, token)
  const { detalle } = estado
  const { usuario } = useSesion()

  // Un rechazo de puja no debe quedarse en pantalla para siempre.
  useEffect(() => {
    if (!estado.aviso) return
    const t = window.setTimeout(limpiarAviso, 6000)
    return () => window.clearTimeout(t)
  }, [estado.aviso, limpiarAviso])

  if (estado.errorDeCarga) {
    return (
      <EstadoError titulo="No pudimos abrir la sala" mensaje={estado.errorDeCarga}>
        <Link to={rutaInicio(usuario!.rol)} className="boton boton--secundario">
          <ArrowLeft aria-hidden="true" />
          Volver al home
        </Link>
      </EstadoError>
    )
  }
  if (estado.cargando || !detalle) return <SalaCargando />

  // HU-05: una subasta que ya finalizó lleva a los resultados, no a la sala.
  if (detalle.estado === 'FINALIZADA' || detalle.estado === 'DESIERTA') {
    return <Navigate to={rutas.resultados(subastaId)} replace />
  }

  return (
    <>
      <EstadoDeConexion conexion={estado.conexion} />

      <div className="encabezado">
        <div className="encabezado__texto">
          <p className="sobretitulo">
            <EtiquetaEstado estado={detalle.estado} />
            <span>Subasta de {detalle.subastadorNombre}</span>
          </p>
          <h1>{detalle.nombre}</h1>
          <p className="subtitulo">
            <CalendarClock aria-hidden="true" />
            {formatFechaHora(detalle.fechaInicio)}
          </p>
        </div>
        <span className="conectados" title="Personas conectadas a la sala">
          <span className="conectados__punto" aria-hidden="true" />
          <Users aria-hidden="true" />
          <span>
            <strong>{estado.conectados}</strong> conectados
          </span>
        </span>
      </div>

      <div className={`sala${esSubastador ? '' : ' sala--comprador'}`}>
        <div className="sala__principal">
          <Suspense fallback={<VideoCargando />}>
            <VideoLive subastaId={subastaId} esSubastador={esSubastador} transmitiendo={estado.transmitiendo} />
          </Suspense>
          <FichaLoteCard subasta={detalle} />
        </div>

        <aside className="sala__lateral" aria-label="Puja y actividad">
          {esSubastador ? (
            <section className="tarjeta panel-control">
              <div className="tarjeta__cabecera">
                <h2>
                  <Gavel aria-hidden="true" />
                  Control de la subasta
                </h2>
              </div>
              <div>
                <p className="panel-puja__etiqueta">Precio actual</p>
                <p className="precio precio--chico" aria-live="polite">
                  {detalle.precioActual !== null ? (
                    <>
                      <IconoOrbe />
                      <span className="precio__valor" key={detalle.precioActual}>
                        {detalle.precioActual}
                      </span>
                    </>
                  ) : (
                    'Sin reglas'
                  )}
                </p>
                {detalle.lider && <p className="lider">Lidera {detalle.lider.nombre}</p>}
              </div>
              <IniciarSubastaBoton subasta={detalle} alIniciar={(d) => dispatch({ tipo: 'DETALLE', detalle: d })} />
              {/* Hallazgo 19: salir de la sala desmonta el video y corta la transmisión a los compradores. */}
              {detalle.estado === 'PROGRAMADA' &&
                (estado.transmitiendo ? (
                  <p className="campo__ayuda">Detén la transmisión para configurar la ficha y las reglas.</p>
                ) : (
                  <Link to={rutas.gestionar(detalle.id)} className="boton boton--secundario boton--ancho">
                    <Settings2 aria-hidden="true" />
                    Configurar ficha y reglas
                  </Link>
                ))}
            </section>
          ) : (
            <PanelPuja
              subasta={detalle}
              usuarioId={usuarioId}
              conectado={estado.conexion === 'abierta'}
              aviso={estado.aviso}
              onPujar={pujar}
              onLimpiarAviso={limpiarAviso}
            />
          )}

          <FeedPujas detalle={detalle} usuarioId={usuarioId} />
        </aside>
      </div>
    </>
  )
}

/** Banner visible cuando el WebSocket de la sala no está abierto (conectando o reconectando). */
function EstadoDeConexion({ conexion }: { conexion: EstadoConexion }) {
  if (conexion === 'abierta') return null
  const caida = conexion === 'cerrada'
  return (
    <div className={`conexion${caida ? ' conexion--caida' : ''}`} role="status">
      {caida ? <WifiOff aria-hidden="true" /> : <LoaderCircle className="conexion__giro" aria-hidden="true" />}
      <span>
        {caida
          ? 'Se perdió la conexión con la sala. Reconectando… las pujas se sincronizan al volver.'
          : 'Conectando con la sala en vivo…'}
      </span>
    </div>
  )
}

function FeedPujas({ detalle, usuarioId }: { detalle: Detalle; usuarioId: string }) {
  return (
    <section className="tarjeta" aria-labelledby="titulo-pujas">
      <div className="tarjeta__cabecera">
        <h2 id="titulo-pujas">Últimas pujas</h2>
        <span className="etiqueta tabular">{detalle.cantidadPujas} pujas</span>
      </div>
      {detalle.ultimasPujas.length === 0 && (
        <EstadoVacio compacto icono={Gavel} titulo="Todavía no hay pujas." texto="La primera puja marca el ritmo de la subasta." />
      )}
      <ol className="pujas" aria-live="polite" aria-relevant="additions">
        {detalle.ultimasPujas.map((p, i) => {
          const mia = p.usuarioId === usuarioId
          return (
            <li key={p.id} className={`puja${i === 0 ? ' puja--lider' : ''}${mia ? ' puja--mia' : ''}`}>
              <span className="avatar avatar--chico" aria-hidden="true">
                {iniciales(p.usuarioNombre)}
              </span>
              <span className="puja__quien">
                <span className="puja__nombre">
                  {p.usuarioNombre}
                  {mia && ' (tú)'}
                </span>
                <time className="puja__hora" dateTime={p.creadaEn}>
                  {formatHora(p.creadaEn)}
                </time>
              </span>
              <span className="puja__monto">
                <Monto cantidad={p.monto} />
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function VideoCargando() {
  return (
    <div className="tarjeta video" role="status">
      <div className="video__marco">
        <p className="video__mensaje">
          <LoaderCircle className="conexion__giro" aria-hidden="true" />
          Cargando video…
        </p>
      </div>
    </div>
  )
}

function SalaCargando() {
  return (
    <div role="status">
      <span className="solo-lectores">Entrando a la sala…</span>
      <div className="encabezado" aria-hidden="true">
        <div className="encabezado__texto">
          <Esqueleto ancho="12rem" alto="1.2rem" />
          <Esqueleto ancho="min(28rem, 80vw)" alto="2.6rem" />
        </div>
      </div>
      <div className="sala" aria-hidden="true" style={{ marginTop: '1.5rem' }}>
        <div className="sala__principal">
          <Esqueleto alto="auto" className="esqueleto--video" />
          <Esqueleto alto="10rem" />
        </div>
        <div className="sala__lateral">
          <Esqueleto alto="14rem" />
          <Esqueleto alto="12rem" />
        </div>
      </div>
    </div>
  )
}
