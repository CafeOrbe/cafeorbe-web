import { describe, expect, it } from 'vitest'
import { desfaseConElServidor, enAlerta, formatReloj, segundosRestantes } from './reloj'

const FIN = '2026-10-05T15:10:00Z'
const finMs = Date.parse(FIN)

describe('HU-17 · temporizador', () => {
  it('formatea en mm:ss', () => {
    expect(formatReloj(600)).toBe('10:00')
    expect(formatReloj(59)).toBe('00:59')
    expect(formatReloj(0)).toBe('00:00')
    expect(formatReloj(-5)).toBe('00:00')
    expect(formatReloj(3725)).toBe('1:02:05')
  })

  it('cuenta el tiempo restante hasta la hora de fin y nunca baja de cero', () => {
    expect(segundosRestantes(FIN, finMs - 600_000, 0)).toBe(600)
    expect(segundosRestantes(FIN, finMs - 500, 0)).toBe(1)
    expect(segundosRestantes(FIN, finMs + 5_000, 0)).toBe(0)
    expect(segundosRestantes(null, finMs, 0)).toBeNull()
  })

  it('dos navegadores con relojes distintos muestran el mismo tiempo al usar la hora del servidor', () => {
    const servidor = finMs - 120_000 // al servidor le faltan 2 minutos
    const relojAdelantado = servidor + 45_000
    const relojAtrasado = servidor - 30_000
    const desfaseA = desfaseConElServidor(new Date(servidor).toISOString(), relojAdelantado)
    const desfaseB = desfaseConElServidor(new Date(servidor).toISOString(), relojAtrasado)

    expect(segundosRestantes(FIN, relojAdelantado, desfaseA)).toBe(120)
    expect(segundosRestantes(FIN, relojAtrasado, desfaseB)).toBe(120)
    // Sin corregir, el navegador adelantado mostraría 45 s menos.
    expect(segundosRestantes(FIN, relojAdelantado, 0)).toBe(75)
  })

  it('alerta del último minuto: por debajo de 60 segundos', () => {
    expect(enAlerta(60)).toBe(false)
    expect(enAlerta(59)).toBe(true)
    expect(enAlerta(0)).toBe(true)
  })

  it('una hora de servidor ilegible no desajusta el reloj', () => {
    expect(desfaseConElServidor('no-es-fecha', 1000)).toBe(0)
  })
})
