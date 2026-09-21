import type { EstadoSubasta } from '../api/types'
import { etiquetaEstado } from '../format'

export function EtiquetaEstado({ estado }: { estado: EstadoSubasta }) {
  return <span className={`etiqueta etiqueta--estado-${estado.toLowerCase()}`}>{etiquetaEstado(estado)}</span>
}
