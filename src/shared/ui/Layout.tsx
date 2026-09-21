import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { etiquetaRol } from '../format'
import { rutaInicio } from '../routes'
import { useSesion } from '../session'
import { SaldoOrbes } from './SaldoOrbes'

/** Barra superior (nombre, rol, saldo y Cerrar sesión, HU-02) y contenedor de las pantallas autenticadas. */
export function Layout({ children }: { children: ReactNode }) {
  const { usuario, cerrarSesion } = useSesion()
  if (!usuario) return null

  return (
    <div className="app">
      <header className="barra">
        <Link to={rutaInicio(usuario.rol)} className="barra__marca">
          ☕ CaféOrbe
        </Link>
        <div className="barra__usuario">
          {usuario.rol === 'COMPRADOR' && <SaldoOrbes />}
          <span className="barra__nombre">{usuario.nombre}</span>
          <span className={`etiqueta etiqueta--rol-${usuario.rol.toLowerCase()}`}>{etiquetaRol(usuario.rol)}</span>
          <button type="button" className="boton boton--secundario boton--chico" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="contenedor">{children}</main>
    </div>
  )
}
