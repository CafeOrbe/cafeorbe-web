/** Bajo este tiempo el temporizador cambia de color como alerta (HU-17). */
export const SEGUNDOS_DE_ALERTA = 60

/**
 * Diferencia entre el reloj del servidor y el del navegador, en milisegundos. Se calcula con la hora que el
 * servidor entregó y el instante en que llegó su respuesta: así un reloj local desajustado no altera la cuenta.
 */
export function desfaseConElServidor(horaServidor: string, recibidoEnMs: number): number {
  const servidor = Date.parse(horaServidor)
  return Number.isFinite(servidor) ? servidor - recibidoEnMs : 0
}

/** Segundos que faltan para la hora de fin según el reloj del servidor; null si no hay hora de fin. */
export function segundosRestantes(horaFin: string | null, ahoraMs: number, desfaseMs: number): number | null {
  if (!horaFin) return null
  const fin = Date.parse(horaFin)
  if (!Number.isFinite(fin)) return null
  return Math.max(0, Math.ceil((fin - (ahoraMs + desfaseMs)) / 1000))
}

/** Formato mm:ss; con más de una hora, h:mm:ss. */
export function formatReloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const dos = (n: number) => String(n).padStart(2, '0')
  const horas = Math.floor(s / 3600)
  const minutos = Math.floor((s % 3600) / 60)
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(s % 60)}` : `${dos(minutos)}:${dos(s % 60)}`
}

export function enAlerta(segundos: number): boolean {
  return segundos < SEGUNDOS_DE_ALERTA
}
