import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { etiquetaRol, iniciales } from '../format'
import { rutaInicio } from '../routes'
import { useSesion } from '../session'
import { Marca } from './Marca'
import { SaldoOrbes } from './SaldoOrbes'

/** Barra superior (nombre, rol, saldo y Cerrar sesión, HU-02) y contenedor de las pantallas autenticadas. */
export function Layout({ children }: { children: ReactNode }) {
  const { usuario, cerrarSesion } = useSesion()
  if (!usuario) return null

  return (
    <div className="app">
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <header className="barra">
        <div className="barra__interior">
          <Link to={rutaInicio(usuario.rol)} className="barra__marca" aria-label="CaféOrbe, ir al inicio">
            <Marca />
          </Link>
          <div className="barra__usuario">
            {usuario.rol === 'COMPRADOR' && <SaldoOrbes />}
            <span className="usuario">
              <span className="avatar" aria-hidden="true">
                {iniciales(usuario.nombre)}
              </span>
              <span className="usuario__texto">
                <span className="barra__nombre">{usuario.nombre}</span>
                <span className="usuario__rol">{etiquetaRol(usuario.rol)}</span>
              </span>
            </span>
            <button type="button" className="boton boton--fantasma boton--chico" onClick={cerrarSesion} aria-label="Cerrar sesión">
              <LogOut aria-hidden="true" />
              <span className="ocultar-movil">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>
      <main id="contenido" className="contenedor" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
