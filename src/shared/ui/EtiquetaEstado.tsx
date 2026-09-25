import type { EstadoSubasta } from '../api/types'
import { etiquetaEstado } from '../format'

export function EtiquetaEstado({ estado }: { estado: EstadoSubasta }) {
  return (
    <span className={`etiqueta etiqueta--estado-${estado.toLowerCase()}`}>
      <span className="etiqueta__punto" aria-hidden="true" />
      {etiquetaEstado(estado)}
    </span>
  )
}

/** Insignia roja con pulso para lo que se está transmitiendo o subastando ahora. */
export function EnVivo() {
  return (
    <span className="en-vivo">
      <span className="en-vivo__punto" aria-hidden="true" />
      EN VIVO
    </span>
  )
}
