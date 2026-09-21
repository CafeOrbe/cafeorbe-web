import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { formatFechaHora } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { FichaForm } from './FichaForm'
import { IniciarSubastaBoton } from './IniciarSubastaBoton'
import { ReglasForm } from './ReglasForm'

/** Panel de preparación de una subasta: ficha del lote (HU-09), reglas (HU-10) e inicio (HU-12). */
export function GestionSubastaPage() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
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

  if (error) {
    return (
      <p className="campo__error" role="alert">
        {error}
      </p>
    )
  }
  if (!subasta) return <p className="vacio">Cargando…</p>

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{subasta.nombre}</h1>
          <p className="subtitulo">
            <EtiquetaEstado estado={subasta.estado} /> · Inicio programado: {formatFechaHora(subasta.fechaInicio)}
          </p>
          {subasta.descripcion && <p>{subasta.descripcion}</p>}
        </div>
        <Link to={rutas.misSubastas} className="boton boton--secundario">
          Mis subastas
        </Link>
      </div>

      <FichaForm key={`ficha-${subasta.estado}`} subasta={subasta} alGuardar={setSubasta} />
      <ReglasForm key={`reglas-${subasta.estado}`} subasta={subasta} alGuardar={setSubasta} />

      <div className="tarjeta">
        <h2>Listo para salir al aire</h2>
        <p>Entra a la sala para transmitir tu cámara y abrir las pujas cuando estés listo.</p>
        <div className="acciones">
          <IniciarSubastaBoton
            subasta={subasta}
            alIniciar={(d) => {
              setSubasta(d)
              navegar(rutas.sala(d.id))
            }}
          />
          <Link to={rutas.sala(subasta.id)} className="boton boton--secundario">
            Ir a la sala
          </Link>
        </div>
      </div>
    </>
  )
}
