import type { EstadoSubasta } from '../../shared/api/types'

export const MSG_LIDER = 'Vas ganando'
export const MSG_TIEMPO_AGOTADO = 'Tiempo agotado'
export const MSG_SIN_SALDO = 'Orbes insuficientes'

export interface DatosDelBoton {
  estado: EstadoSubasta
  soyLider: boolean
  tiempoAgotado: boolean
  /** Saldo del comprador; null mientras no se conoce. */
  saldo: number | null
  /** Monto que propone el botón: precio actual + incremento mínimo. */
  monto: number | null
  conectado: boolean
  enviando: boolean
}

export interface EstadoDelBoton {
  etiqueta: string
  deshabilitado: boolean
  /** true cuando el botón ofrece pujar (aunque esté esperando la conexión o una respuesta). */
  puedePujar: boolean
}

/**
 * HU-13: estado del botón de puja rápida. Es pura para poder probarla sin navegador.
 * Se deshabilita si el comprador es líder o no tiene Orbes. Con saldo menor que el monto el botón sigue
 * activo: el servidor rechaza la puja y la sala muestra "Orbes insuficientes" (escenario 3).
 */
export function estadoDelBoton(d: DatosDelBoton): EstadoDelBoton {
  if (d.estado !== 'EN_CURSO') {
    const etiqueta = d.estado === 'PROGRAMADA' ? 'La subasta aún no inicia' : 'Subasta cerrada'
    return { etiqueta, deshabilitado: true, puedePujar: false }
  }
  if (d.soyLider) return { etiqueta: MSG_LIDER, deshabilitado: true, puedePujar: false }
  if (d.tiempoAgotado) return { etiqueta: MSG_TIEMPO_AGOTADO, deshabilitado: true, puedePujar: false }
  if (d.saldo !== null && d.saldo <= 0) return { etiqueta: MSG_SIN_SALDO, deshabilitado: true, puedePujar: false }
  return {
    etiqueta: `Pujar ${d.monto}`,
    deshabilitado: !d.conectado || d.enviando || d.monto === null,
    puedePujar: true,
  }
}
