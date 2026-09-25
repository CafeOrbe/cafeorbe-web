import type { ReactNode } from 'react'
import { CircleAlert, type LucideIcon } from 'lucide-react'

/** Bloque gris animado que ocupa el lugar del contenido mientras carga. */
export function Esqueleto({ ancho = '100%', alto = '1rem', className = '' }: { ancho?: string; alto?: string; className?: string }) {
  return <span className={`esqueleto ${className}`} style={{ width: ancho, height: alto }} aria-hidden="true" />
}

/** Tarjeta de lote en carga, con la misma forma que la real. */
export function EsqueletoLote() {
  return (
    <li className="esqueleto-lote" aria-hidden="true">
      <Esqueleto className="esqueleto-lote__portada" alto="auto" />
      <div className="esqueleto-lote__cuerpo">
        <Esqueleto ancho="70%" alto="1.4rem" />
        <Esqueleto ancho="45%" alto="0.9rem" />
        <Esqueleto ancho="100%" alto="2.6rem" />
      </div>
    </li>
  )
}

/** Varias tarjetas de lote en carga, con un texto para lectores de pantalla. */
export function CargandoLotes({ texto, cantidad = 3 }: { texto: string; cantidad?: number }) {
  return (
    <div role="status">
      <span className="solo-lectores">{texto}</span>
      <ul className="rejilla-lotes">
        {Array.from({ length: cantidad }, (_, i) => (
          <EsqueletoLote key={i} />
        ))}
      </ul>
    </div>
  )
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
  compacto = false,
  children,
}: {
  icono: LucideIcon
  titulo: string
  texto?: string
  compacto?: boolean
  children?: ReactNode
}) {
  return (
    <div className={`estado-vacio${compacto ? ' estado-vacio--compacto' : ''}`}>
      <span className="estado-vacio__icono">
        <Icono aria-hidden="true" />
      </span>
      <p className="estado-vacio__titulo">{titulo}</p>
      {texto && <p className="estado-vacio__texto">{texto}</p>}
      {children && <div className="acciones">{children}</div>}
    </div>
  )
}

export function EstadoError({ mensaje, titulo = 'Algo salió mal', children }: { mensaje: string; titulo?: string; children?: ReactNode }) {
  return (
    <div className="estado-error" role="alert">
      <span className="estado-error__icono">
        <CircleAlert aria-hidden="true" />
      </span>
      <p className="estado-error__titulo">{titulo}</p>
      <p className="estado-error__mensaje">{mensaje}</p>
      {children && <div className="acciones">{children}</div>}
    </div>
  )
}

/** Mensaje de error de un formulario o acción, con ícono. */
export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p className="alerta" role="alert">
      <CircleAlert aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
