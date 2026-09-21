import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { formatFechaHora, formatOrbes } from '../../shared/format'
import { rutaInicio, rutas } from '../../shared/routes'
import { tokenActual, useSesion } from '../../shared/session'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
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
      <>
        <p className="campo__error" role="alert">
          {estado.errorDeCarga}
        </p>
        <Link to={rutaInicio(usuario!.rol)} className="boton boton--secundario">
          Volver al home
        </Link>
      </>
    )
  }
  if (estado.cargando || !detalle) return <p className="vacio">Entrando a la sala…</p>

  // HU-05: una subasta que ya finalizó lleva a los resultados, no a la sala.
  if (detalle.estado === 'FINALIZADA' || detalle.estado === 'DESIERTA') {
    return <Navigate to={rutas.resultados(subastaId)} replace />
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{detalle.nombre}</h1>
          <p className="subtitulo">
            <EtiquetaEstado estado={detalle.estado} /> · {formatFechaHora(detalle.fechaInicio)} · por {detalle.subastadorNombre}
          </p>
        </div>
        <span className="conectados" title="Personas conectadas a la sala">
          👥 {estado.conectados} conectados
        </span>
      </div>

      <div className="sala">
        <div className="sala__principal">
          <Suspense fallback={<div className="tarjeta video"><p className="vacio">Cargando video…</p></div>}>
            <VideoLive subastaId={subastaId} esSubastador={esSubastador} transmitiendo={estado.transmitiendo} />
          </Suspense>
          <FichaLoteCard subasta={detalle} />
        </div>

        <aside className="sala__lateral">
          {esSubastador ? (
            <div className="tarjeta">
              <h2>Control de la subasta</h2>
              <p className="precio precio--chico">{detalle.precioActual !== null ? formatOrbes(detalle.precioActual) : 'Sin reglas'}</p>
              {detalle.lider && <p className="lider">Lidera {detalle.lider.nombre}</p>}
              <IniciarSubastaBoton subasta={detalle} alIniciar={(d) => dispatch({ tipo: 'DETALLE', detalle: d })} />
              {detalle.estado === 'PROGRAMADA' && (
                <Link to={rutas.gestionar(detalle.id)} className="boton boton--secundario boton--ancho">
                  Configurar ficha y reglas
                </Link>
              )}
            </div>
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

          <div className="tarjeta">
            <h2>Últimas pujas</h2>
            {detalle.ultimasPujas.length === 0 ? (
              <p className="vacio">Todavía no hay pujas.</p>
            ) : (
              <ol className="pujas">
                {detalle.ultimasPujas.map((p) => (
                  <li key={p.id}>
                    <span>{p.usuarioNombre}</span>
                    <strong>{formatOrbes(p.monto)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
