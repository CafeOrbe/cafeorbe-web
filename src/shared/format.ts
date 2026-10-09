import type { EstadoSubasta, Rol } from './api/types'

/** Cantidad con separador de miles, como se lee en Colombia: "99.999.870 Orbes". */
export function formatOrbes(cantidad: number): string {
  return `${cantidad.toLocaleString('es-CO')} Orbes`
}

/**
 * Tiempo que falta para un instante, en palabras cortas: "3 días", "2 h 15 min", "12 min", "menos de 1 min".
 * Devuelve null si el instante ya pasó.
 */
export function tiempoHasta(iso: string, ahora: number = Date.now()): string | null {
  const minutos = Math.floor((new Date(iso).getTime() - ahora) / 60_000)
  if (Number.isNaN(minutos) || minutos < 0) return null
  if (minutos < 1) return 'menos de 1 min'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return minutos % 60 === 0 ? `${horas} h` : `${horas} h ${minutos % 60} min`
  const dias = Math.floor(horas / 24)
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
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

/** Hora corta de una puja o evento: "14:32:05". */
export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Iniciales para el avatar: "Ana María" → "AM". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? '?').slice(0, 2)
  return letras.toUpperCase()
}
