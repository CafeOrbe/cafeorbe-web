import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../shared/api/endpoints'
import type { Resumen } from '../../shared/api/types'
import { etiquetaRol, formatFechaHora, formatOrbes } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisos } from '../../shared/ui/Avisos'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'

/** HU-04: subastas disponibles. HU-07: aviso de la carga automática de Orbes en el primer ingreso. */
export function HomeCompradorPage() {
  const { usuario, bienvenidaPendiente, bienvenidaMostrada } = useSesion()
  const { mostrar } = useAvisos()
  const [subastas, setSubastas] = useState<Resumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useAvisoDeRuta()

  useEffect(() => {
    let vivo = true
    api
      .subastasDisponibles(['PROGRAMADA', 'EN_CURSO'])
      .then((lista) => vivo && setSubastas(lista))
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [])

  // La carga la hace wallet al recibir el evento, así que el saldo puede tardar un instante en aparecer.
  useEffect(() => {
    if (!bienvenidaPendiente) return
    let vivo = true
    ;(async () => {
      for (let intento = 0; intento < 8 && vivo; intento++) {
        const { saldo } = await api.saldo().catch(() => ({ saldo: 0 }))
        if (saldo > 0) {
          if (vivo) {
            mostrar(`¡Bienvenido! Recibiste ${formatOrbes(saldo)} para pujar.`, 'exito')
            bienvenidaMostrada()
          }
          return
        }
        await new Promise((r) => setTimeout(r, 750))
      }
    })()
    return () => {
      vivo = false
    }
  }, [bienvenidaPendiente, bienvenidaMostrada, mostrar])

  if (!usuario) return null

  return (
    <>
      <h1>
        Hola, {usuario.nombre} <span className="etiqueta etiqueta--rol-comprador">{etiquetaRol(usuario.rol)}</span>
      </h1>
      <p className="subtitulo">Estas son las subastas disponibles.</p>

      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      {!error && subastas === null && <p className="vacio">Cargando subastas…</p>}
      {subastas?.length === 0 && <p className="vacio">No hay subastas disponibles por ahora</p>}

      <ul className="lista">
        {subastas?.map((s) => (
          <li key={s.id} className="tarjeta tarjeta--fila">
            <div>
              <h2 className="tarjeta__titulo">{s.nombre}</h2>
              <p className="tarjeta__texto">
                <EtiquetaEstado estado={s.estado} /> · {formatFechaHora(s.fechaInicio)} · por {s.subastadorNombre}
                {s.precioActual !== null && <> · desde {formatOrbes(s.precioActual)}</>}
              </p>
            </div>
            <Link to={rutas.sala(s.id)} className="boton boton--primario">
              Entrar
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
