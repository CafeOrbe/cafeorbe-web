import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleOff, Gavel, Radio, Trophy } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { api } from '../../shared/api/endpoints'
import type { Resultados } from '../../shared/api/types'
import { formatFechaHora, formatHora, formatOrbes, iniciales } from '../../shared/format'
import { rutaInicio, rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { Esqueleto, EstadoError, EstadoVacio } from '../../shared/ui/Estados'
import { Monto } from '../../shared/ui/Orbe'
import { PortadaLote } from '../../shared/ui/PortadaLote'

/**
 * HU-22: resumen de una subasta cerrada: lote, ganador, monto final, cantidad de pujas y las últimas pujas.
 * Lo ve igual cualquier participante, haya ganado o no. HU-23: desde aquí se vuelve al home del rol.
 */
export function ResultadosPage() {
  const { id = '' } = useParams()
  const { usuario } = useSesion()
  const [resultados, setResultados] = useState<Resultados | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinFinalizar, setSinFinalizar] = useState(false)

  useEffect(() => {
    let vivo = true
    api
      .resultados(id)
      .then((r) => vivo && setResultados(r))
      .catch((e: unknown) => {
        if (!vivo) return
        // 409: la subasta todavía no ha cerrado, no hay resultados que mostrar.
        if (e instanceof ApiError && e.status === 409) setSinFinalizar(true)
        else setError(e instanceof Error ? e.message : 'No se pudieron cargar los resultados')
      })
    return () => {
      vivo = false
    }
  }, [id])

  const ficha = resultados?.ficha ?? null

  return (
    <>
      <div className="encabezado">
        <div className="encabezado__texto">
          <p className="sobretitulo">Subasta cerrada</p>
          <h1>Resultados</h1>
        </div>
      </div>

      {error && <EstadoError titulo="No pudimos cargar los resultados" mensaje={error} />}
      {sinFinalizar && (
        <EstadoVacio icono={Radio} titulo="La subasta aún no ha finalizado" texto="Los resultados aparecen cuando se acaba el tiempo.">
          <Link to={rutas.sala(id)} className="boton boton--primario">
            Ir a la sala
          </Link>
        </EstadoVacio>
      )}
      {!error && !sinFinalizar && !resultados && (
        <div role="status">
          <span className="solo-lectores">Cargando…</span>
          <Esqueleto alto="22rem" />
        </div>
      )}

      {resultados && (
        <>
          <article className="tarjeta resultado">
            <div className="resultado__portada">
              <PortadaLote semilla={resultados.id} />
              <div className="resultado__rotulo">
                <p className="sobretitulo">
                  <EtiquetaEstado estado={resultados.estado} />
                  {resultados.cerradaEn && <span>Cerró el {formatFechaHora(resultados.cerradaEn)}</span>}
                </p>
                <h2>{resultados.nombre}</h2>
              </div>
            </div>
            <div className="resultado__cuerpo">
              {resultados.ganador ? (
                <div className="ganador">
                  <span className="ganador__icono">
                    <Trophy aria-hidden="true" />
                  </span>
                  <div>
                    <p className="panel-puja__etiqueta">Ganador</p>
                    <p className="ganador__nombre">
                      {resultados.ganador.nombre}
                      {resultados.ganador.id === usuario?.id && ' (tú)'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ganador ganador--desierta">
                  <span className="ganador__icono">
                    <CircleOff aria-hidden="true" />
                  </span>
                  <p className="ganador__nombre">Subasta desierta: no hubo ganador</p>
                </div>
              )}

              <dl className="cifras">
                <div>
                  <dt>Monto final</dt>
                  <dd className="monto">{resultados.montoFinal !== null ? formatOrbes(resultados.montoFinal) : '—'}</dd>
                </div>
                <div>
                  <dt>Pujas</dt>
                  <dd>{resultados.cantidadPujas}</dd>
                </div>
                <div>
                  <dt>Lote</dt>
                  <dd>{ficha ? `${ficha.tipoCafe} · ${ficha.pesoKg} kg` : 'Sin ficha registrada'}</dd>
                </div>
                {ficha && (
                  <div>
                    <dt>Identificación</dt>
                    <dd>{ficha.identificacion}</dd>
                  </div>
                )}
              </dl>
              <p className="tarjeta__texto">Subastado por {resultados.subastadorNombre}.</p>
            </div>
          </article>

          <section className="tarjeta" aria-labelledby="titulo-historial">
            <div className="tarjeta__cabecera">
              <h2 id="titulo-historial">Últimas pujas</h2>
              <span className="etiqueta tabular">{resultados.cantidadPujas} pujas</span>
            </div>
            {resultados.ultimasPujas.length === 0 ? (
              <EstadoVacio compacto icono={Gavel} titulo="Nadie pujó en esta subasta." />
            ) : (
              <ol className="pujas">
                {resultados.ultimasPujas.map((p, i) => (
                  <li key={p.id} className={`puja${i === 0 ? ' puja--lider' : ''}${p.usuarioId === usuario?.id ? ' puja--mia' : ''}`}>
                    <span className="avatar avatar--chico" aria-hidden="true">
                      {iniciales(p.usuarioNombre)}
                    </span>
                    <span className="puja__quien">
                      <span className="puja__nombre">
                        {p.usuarioNombre}
                        {p.usuarioId === usuario?.id && ' (tú)'}
                      </span>
                      <time className="puja__hora" dateTime={p.creadaEn}>
                        {formatHora(p.creadaEn)}
                      </time>
                    </span>
                    <span className="puja__monto">
                      <Monto cantidad={p.monto} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {usuario && (
        <div className="acciones">
          <Link to={rutaInicio(usuario.rol)} className="boton boton--secundario">
            <ArrowLeft aria-hidden="true" />
            Volver al home
          </Link>
        </div>
      )}
    </>
  )
}
