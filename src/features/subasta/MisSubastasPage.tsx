import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../shared/api/endpoints'
import type { Resumen } from '../../shared/api/types'
import { formatFechaHora, formatOrbes } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'

/** HU-03: las subastas que creó el Subastador. */
export function MisSubastasPage() {
  const [subastas, setSubastas] = useState<Resumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api
      .misSubastas()
      .then((lista) => vivo && setSubastas(lista))
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <>
      <div className="encabezado">
        <h1>Mis subastas</h1>
        <Link to={rutas.crearSubasta} className="boton boton--primario">
          Crear subasta
        </Link>
      </div>

      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      {!error && subastas === null && <p className="vacio">Cargando…</p>}
      {subastas?.length === 0 && <p className="vacio">Aún no has creado ninguna subasta.</p>}

      <ul className="lista">
        {subastas?.map((s) => (
          <li key={s.id} className="tarjeta tarjeta--fila">
            <div>
              <h2 className="tarjeta__titulo">{s.nombre}</h2>
              <p className="tarjeta__texto">
                <EtiquetaEstado estado={s.estado} /> · {formatFechaHora(s.fechaInicio)}
                {s.precioActual !== null && <> · {formatOrbes(s.precioActual)}</>} · {s.cantidadPujas} pujas
              </p>
            </div>
            <div className="acciones">
              {s.estado === 'PROGRAMADA' && (
                <Link to={rutas.gestionar(s.id)} className="boton boton--secundario">
                  Configurar
                </Link>
              )}
              <Link to={rutas.sala(s.id)} className="boton boton--primario">
                Ir a la sala
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
