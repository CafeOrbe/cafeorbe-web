import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Plus, Settings2 } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Resumen } from '../../shared/api/types'
import { rutas } from '../../shared/routes'
import { CargandoLotes, EstadoError, EstadoVacio } from '../../shared/ui/Estados'
import { TarjetaLote } from '../../shared/ui/TarjetaLote'

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
        <div className="encabezado__texto">
          <p className="sobretitulo">Panel del Subastador</p>
          <h1>Mis subastas</h1>
        </div>
        <Link to={rutas.crearSubasta} className="boton boton--primario">
          <Plus aria-hidden="true" />
          Crear subasta
        </Link>
      </div>

      {error && <EstadoError titulo="No pudimos cargar tus subastas" mensaje={error} />}
      {!error && subastas === null && <CargandoLotes texto="Cargando…" />}
      {subastas?.length === 0 && (
        <EstadoVacio icono={ClipboardList} titulo="Aún no has creado ninguna subasta." texto="Crea tu primera subasta, registra la ficha del lote y sal en vivo.">
          <Link to={rutas.crearSubasta} className="boton boton--primario">
            <Plus aria-hidden="true" />
            Crear subasta
          </Link>
        </EstadoVacio>
      )}

      {subastas && subastas.length > 0 && (
        <ul className="rejilla-lotes">
          {subastas.map((s) => (
            <TarjetaLote key={s.id} subasta={s} mostrarSubastador={false}>
              {s.estado === 'PROGRAMADA' && (
                <Link to={rutas.gestionar(s.id)} className="boton boton--secundario boton--chico">
                  <Settings2 aria-hidden="true" />
                  Configurar
                </Link>
              )}
              <Link to={rutas.sala(s.id)} className="boton boton--primario boton--chico">
                Ir a la sala
                <ArrowRight aria-hidden="true" />
              </Link>
            </TarjetaLote>
          ))}
        </ul>
      )}
    </>
  )
}
