import { Link } from 'react-router-dom'
import { ArrowUpRight, ClipboardList, Plus } from 'lucide-react'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'
import { PortadaLote } from '../../shared/ui/PortadaLote'
import { etiquetaRol } from '../../shared/format'

/** HU-03: home del Subastador con las acciones propias del rol. */
export function HomeSubastadorPage() {
  const { usuario } = useSesion()
  useAvisoDeRuta()
  if (!usuario) return null

  return (
    <>
      <section className="hero">
        <div className="hero__fondo" aria-hidden="true">
          <PortadaLote semilla={`hero-${usuario.id}`} />
        </div>
        <p className="sobretitulo">
          Hola, {usuario.nombre} · {etiquetaRol(usuario.rol)}
        </p>
        <h1 className="hero__titulo">
          Tu cosecha, <em>en vivo</em> ante los compradores
        </h1>
        <p className="subtitulo">¿Qué quieres hacer hoy?</p>
      </section>

      <div className="rejilla">
        <Link to={rutas.crearSubasta} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono">
            <Plus aria-hidden="true" />
          </span>
          <ArrowUpRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Crear subasta</span>
          <span className="tarjeta__texto">Define el lote, las reglas de puja y cuándo empieza.</span>
        </Link>
        <Link to={rutas.misSubastas} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono tarjeta__icono--hoja">
            <ClipboardList aria-hidden="true" />
          </span>
          <ArrowUpRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Mis subastas</span>
          <span className="tarjeta__texto">Configura, inicia y transmite las que ya creaste.</span>
        </Link>
      </div>
    </>
  )
}
