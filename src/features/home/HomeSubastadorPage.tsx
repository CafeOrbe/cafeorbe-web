import { Link } from 'react-router-dom'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'
import { etiquetaRol } from '../../shared/format'

/** HU-03: home del Subastador con las acciones propias del rol. */
export function HomeSubastadorPage() {
  const { usuario } = useSesion()
  useAvisoDeRuta()
  if (!usuario) return null

  return (
    <>
      <h1>
        Hola, {usuario.nombre} <span className="etiqueta etiqueta--rol-subastador">{etiquetaRol(usuario.rol)}</span>
      </h1>
      <p className="subtitulo">¿Qué quieres hacer hoy?</p>

      <div className="rejilla">
        <Link to={rutas.crearSubasta} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono">➕</span>
          <span className="tarjeta__titulo">Crear subasta</span>
          <span className="tarjeta__texto">Define el lote, las reglas de puja y cuándo empieza.</span>
        </Link>
        <Link to={rutas.misSubastas} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono">📋</span>
          <span className="tarjeta__titulo">Mis subastas</span>
          <span className="tarjeta__texto">Configura, inicia y transmite las que ya creaste.</span>
        </Link>
      </div>
    </>
  )
}
