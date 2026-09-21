import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { formatFechaHora, formatOrbes } from '../../shared/format'
import { rutaInicio } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'

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
      <h1>Resultados</h1>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      {!error && !subasta && <p className="vacio">Cargando…</p>}
      {subasta && (
        <div className="tarjeta">
          <h2>{subasta.nombre}</h2>
          <p>
            <EtiquetaEstado estado={subasta.estado} /> · {formatFechaHora(subasta.fechaInicio)}
          </p>
          {subasta.lider ? (
            <p>
              Ganador: <strong>{subasta.lider.nombre}</strong> con {formatOrbes(subasta.precioActual ?? 0)} ({subasta.cantidadPujas} pujas)
            </p>
          ) : (
            <p>Subasta desierta: no hubo ganador</p>
          )}
        </div>
      )}
      {usuario && (
        <Link to={rutaInicio(usuario.rol)} className="boton boton--secundario">
          Volver al home
        </Link>
      )}
    </>
  )
}
