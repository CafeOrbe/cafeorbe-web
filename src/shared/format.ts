import type { EstadoSubasta, Rol } from './api/types'

/** Sin separadores de miles: la pantalla muestra "1000 Orbes". */
export function formatOrbes(cantidad: number): string {
  return `${cantidad} Orbes`
}

export function etiquetaRol(rol: Rol): string {
  return rol === 'SUBASTADOR' ? 'Subastador' : 'Comprador'
}

export function etiquetaEstado(estado: EstadoSubasta): string {
  switch (estado) {
    case 'PROGRAMADA':
      return 'Programada'
    case 'EN_CURSO':
      return 'En curso'
    case 'FINALIZADA':
      return 'Finalizada'
    case 'DESIERTA':
      return 'Desierta'
  }
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Valor para un <input type="datetime-local"> (hora local, sin zona) a partir de un instante. */
export function aValorDatetimeLocal(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(fecha.getHours())}:${p(fecha.getMinutes())}`
}
