import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Check, Radio } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { formatFechaHora } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { EtiquetaEstado } from '../../shared/ui/EtiquetaEstado'
import { Esqueleto, EstadoError } from '../../shared/ui/Estados'
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
      <EstadoError titulo="No pudimos cargar la subasta" mensaje={error}>
        <Link to={rutas.misSubastas} className="boton boton--secundario">
          <ArrowLeft aria-hidden="true" />
          Mis subastas
        </Link>
      </EstadoError>
    )
  }
  if (!subasta) {
    return (
      <div role="status" className="seccion">
        <span className="solo-lectores">Cargando…</span>
        <Esqueleto ancho="min(26rem, 80vw)" alto="2.6rem" />
        <Esqueleto alto="4rem" />
        <Esqueleto alto="18rem" />
      </div>
    )
  }

  const pasos = [
    { titulo: 'Datos básicos', hecho: true },
    { titulo: 'Ficha del lote', hecho: subasta.ficha !== null },
    { titulo: 'Reglas de puja', hecho: subasta.reglas !== null },
    { titulo: 'En vivo', hecho: subasta.estado !== 'PROGRAMADA' },
  ]
  const actual = pasos.findIndex((p) => !p.hecho)

  return (
    <>
      <div className="encabezado">
        <div className="encabezado__texto">
          <p className="sobretitulo">
            <EtiquetaEstado estado={subasta.estado} />
            <span>Preparación de la subasta</span>
          </p>
          <h1>{subasta.nombre}</h1>
          <p className="subtitulo">
            <CalendarClock aria-hidden="true" />
            Inicio programado: {formatFechaHora(subasta.fechaInicio)}
          </p>
          {subasta.descripcion && <p className="tarjeta__texto">{subasta.descripcion}</p>}
        </div>
        <Link to={rutas.misSubastas} className="boton boton--secundario">
          <ArrowLeft aria-hidden="true" />
          Mis subastas
        </Link>
      </div>

      <ol className="pasos" aria-label="Progreso de la preparación">
        {pasos.map((p, i) => (
          <li key={p.titulo} className={`paso${p.hecho ? ' paso--hecho' : ''}${i === actual ? ' paso--actual' : ''}`}>
            <span className="paso__marca" aria-hidden="true">
              {p.hecho ? <Check strokeWidth={3} /> : i + 1}
            </span>
            <span className="paso__texto">
              <span className="paso__titulo">{p.titulo}</span>
              <span className="paso__estado">{p.hecho ? 'Listo' : i === actual ? 'Siguiente' : 'Pendiente'}</span>
            </span>
          </li>
        ))}
      </ol>

      <FichaForm key={`ficha-${subasta.estado}`} subasta={subasta} alGuardar={setSubasta} />
      <ReglasForm key={`reglas-${subasta.estado}`} subasta={subasta} alGuardar={setSubasta} />

      <section className="tarjeta tarjeta--destacada">
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
            <Radio aria-hidden="true" />
            Ir a la sala
          </Link>
        </div>
      </section>
    </>
  )
}
