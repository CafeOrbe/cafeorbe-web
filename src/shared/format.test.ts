import { describe, expect, it } from 'vitest'
import { aValorDatetimeLocal, etiquetaEstado, etiquetaRol, formatFechaHora, formatHora, formatOrbes, iniciales } from './format'
import { rutaInicio, rutas } from './routes'

describe('format', () => {
  it('HU-06 · muestra los Orbes sin separador de miles', () => {
    expect(formatOrbes(1000)).toBe('1000 Orbes')
    expect(formatOrbes(700)).toBe('700 Orbes')
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
