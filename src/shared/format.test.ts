import { describe, expect, it } from 'vitest'
import { aValorDatetimeLocal, etiquetaEstado, etiquetaRol, formatOrbes } from './format'

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
  })

  it('formatea una fecha local para datetime-local', () => {
    expect(aValorDatetimeLocal(new Date(2026, 8, 5, 7, 3))).toBe('2026-09-05T07:03')
  })
})
