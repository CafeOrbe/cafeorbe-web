import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleOff, Trophy } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { formatFechaHora, formatOrbes } from '../../shared/format'
import { rutaInicio } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { Esqueleto, EstadoError } from '../../shared/ui/Estados'
import { PortadaLote } from '../../shared/ui/PortadaLote'

/**
 * Destino de HU-05 para una subasta que ya finalizó. La pantalla completa de resultados
 * (ganador anunciado, historial y regreso al home, HU-21 a HU-23) es del Sprint 2.
 */
export function ResultadosPage() {
  const { id = '' } = useParams()
  const { usuario } = useSesion()
  const [subasta, setSubasta] = useState<Detalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api
      .detalle(id)
      .then((d) => vivo && setSubasta(d))
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [id])

  return (
    <>
      <div className="encabezado">
        <div className="encabezado__texto">
          <p className="sobretitulo">Subasta cerrada</p>
          <h1>Resultados</h1>
        </div>
      </div>

      {error && <EstadoError titulo="No pudimos cargar los resultados" mensaje={error} />}
      {!error && !subasta && (
        <div role="status">
          <span className="solo-lectores">Cargando…</span>
          <Esqueleto alto="22rem" />
        </div>
      )}
      {subasta && (
        <article className="tarjeta resultado">
          <div className="resultado__portada">
            <PortadaLote semilla={subasta.id} />
            <div className="resultado__rotulo">
              <p className="sobretitulo">
                <EtiquetaEstado estado={subasta.estado} />
                <span>{formatFechaHora(subasta.fechaInicio)}</span>
              </p>
              <h2>{subasta.nombre}</h2>
            </div>
          </div>
          <div className="resultado__cuerpo">
            {subasta.lider ? (
              <>
                <div className="ganador">
                  <span className="ganador__icono">
                    <Trophy aria-hidden="true" />
                  </span>
                  <div>
                    <p className="panel-puja__etiqueta">Ganador</p>
                    <p className="ganador__nombre">{subasta.lider.nombre}</p>
                  </div>
                </div>
                <dl className="cifras">
                  <div>
                    <dt>Monto final</dt>
                    <dd className="monto">{formatOrbes(subasta.precioActual ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Pujas</dt>
                    <dd>{subasta.cantidadPujas}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="ganador ganador--desierta">
                <span className="ganador__icono">
                  <CircleOff aria-hidden="true" />
                </span>
                <p className="ganador__nombre">Subasta desierta: no hubo ganador</p>
              </div>
            )}
          </div>
        </article>
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
