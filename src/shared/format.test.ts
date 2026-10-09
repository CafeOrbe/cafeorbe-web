import { describe, expect, it } from 'vitest'
import { aValorDatetimeLocal, etiquetaEstado, etiquetaRol, formatFechaHora, formatHora, formatOrbes, iniciales, tiempoHasta } from './format'
import { rutaInicio, rutas } from './routes'

describe('format', () => {
  it('HU-06 · muestra los Orbes con separador de miles', () => {
    expect(formatOrbes(1000)).toBe('1.000 Orbes')
    expect(formatOrbes(700)).toBe('700 Orbes')
    expect(formatOrbes(99999870)).toBe('99.999.870 Orbes')
  })

  it('tiempoHasta resume cuánto falta y devuelve null si ya pasó', () => {
    const ahora = new Date('2026-10-09T12:00:00Z').getTime()
    const en = (min: number) => new Date(ahora + min * 60_000).toISOString()
    expect(tiempoHasta(en(0.2), ahora)).toBe('menos de 1 min')
    expect(tiempoHasta(en(12), ahora)).toBe('12 min')
    expect(tiempoHasta(en(120), ahora)).toBe('2 h')
    expect(tiempoHasta(en(135), ahora)).toBe('2 h 15 min')
    expect(tiempoHasta(en(24 * 60), ahora)).toBe('1 día')
    expect(tiempoHasta(en(3 * 24 * 60 + 30), ahora)).toBe('3 días')
    expect(tiempoHasta(en(-1), ahora)).toBeNull()
  })

  it('traduce roles y estados', () => {
    expect(etiquetaRol('SUBASTADOR')).toBe('Subastador')
    expect(etiquetaRol('COMPRADOR')).toBe('Comprador')
    expect(etiquetaEstado('EN_CURSO')).toBe('En curso')
    expect(etiquetaEstado('PROGRAMADA')).toBe('Programada')
    expect(etiquetaEstado('FINALIZADA')).toBe('Finalizada')
    expect(etiquetaEstado('DESIERTA')).toBe('Desierta')
  })

  it('formatea una fecha local para datetime-local', () => {
    expect(aValorDatetimeLocal(new Date(2026, 8, 5, 7, 3))).toBe('2026-09-05T07:03')
  })

  it('formatea fechas y horas para mostrarlas', () => {
    expect(formatFechaHora('2026-10-05T15:00:00Z')).toContain('2026')
    expect(formatHora('2026-10-05T15:01:05Z')).toMatch(/\d{1,2}:01:05/)
  })

  it('saca las iniciales del avatar', () => {
    expect(iniciales('Ana María')).toBe('AM')
    expect(iniciales('  ana  ')).toBe('AN')
    expect(iniciales('Juan David Valero')).toBe('JV')
    expect(iniciales('')).toBe('?')
  })
})

describe('rutas', () => {
  it('HU-23 · cada rol tiene su propio home', () => {
    expect(rutaInicio('SUBASTADOR')).toBe('/subastador')
    expect(rutaInicio('COMPRADOR')).toBe('/comprador')
  })

  it('arma las rutas de una subasta', () => {
    expect(rutas.gestionar('s1')).toBe('/subastador/subastas/s1')
    expect(rutas.sala('s1')).toBe('/subastas/s1/sala')
    expect(rutas.resultados('s1')).toBe('/subastas/s1/resultados')
  })
})
