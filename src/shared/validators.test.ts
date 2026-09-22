import { describe, expect, it } from 'vitest'
import {
  MSG_FECHA_FUTURA,
  MSG_NOMBRE_OBLIGATORIO,
  MSG_VALORES_POSITIVOS,
  numeroPositivo,
  validarCrearSubasta,
  validarFicha,
  validarNombre,
  validarReglas,
} from './validators'

describe('HU-01 · validarNombre', () => {
  it('rechaza el nombre vacío o de solo espacios con El nombre es obligatorio', () => {
    expect(validarNombre('')).toBe(MSG_NOMBRE_OBLIGATORIO)
    expect(validarNombre('   ')).toBe(MSG_NOMBRE_OBLIGATORIO)
  })

  it('acepta un nombre con contenido', () => {
    expect(validarNombre('Ana')).toBeNull()
  })
})

describe('HU-08 · validarCrearSubasta', () => {
  const ahora = new Date('2026-09-21T15:00:00')

  it('señala los campos faltantes', () => {
    expect(validarCrearSubasta({ nombre: '', fechaInicio: '' }, ahora)).toEqual({
      nombre: MSG_NOMBRE_OBLIGATORIO,
      fechaInicio: 'La fecha de inicio es obligatoria',
    })
  })

  it('rechaza una fecha de inicio en el pasado', () => {
    expect(validarCrearSubasta({ nombre: 'Lote', fechaInicio: '2026-09-20T10:00' }, ahora)).toEqual({
      fechaInicio: MSG_FECHA_FUTURA,
    })
  })

  it('acepta datos válidos', () => {
    expect(validarCrearSubasta({ nombre: 'Lote', fechaInicio: '2026-09-22T10:00' }, ahora)).toEqual({})
  })
})

describe('HU-10 · validarReglas', () => {
  it('rechaza cero, negativos, vacíos y texto', () => {
    const errores = validarReglas({ duracionMinutos: '0', precioBase: '-5', incrementoMinimo: 'abc' })
    expect(errores).toEqual({
      duracionMinutos: MSG_VALORES_POSITIVOS,
      precioBase: MSG_VALORES_POSITIVOS,
      incrementoMinimo: MSG_VALORES_POSITIVOS,
    })
    expect(validarReglas({ duracionMinutos: '', precioBase: '100', incrementoMinimo: '10' })).toEqual({
      duracionMinutos: MSG_VALORES_POSITIVOS,
    })
  })

  it('acepta duración 10, precio base 100 e incremento 10', () => {
    expect(validarReglas({ duracionMinutos: '10', precioBase: '100', incrementoMinimo: '10' })).toEqual({})
  })

  it('numeroPositivo solo devuelve números mayores que cero', () => {
    expect(numeroPositivo('10')).toBe(10)
    expect(numeroPositivo('0')).toBeNull()
    expect(numeroPositivo('')).toBeNull()
    expect(numeroPositivo('1e400')).toBeNull()
  })
})

describe('HU-09 · validarFicha', () => {
  it('exige identificación, tipo de café, peso mayor que cero y edad entera', () => {
    expect(validarFicha({ identificacion: '', tipoCafe: ' ', pesoKg: '0', edadMeses: '-1' })).toEqual({
      identificacion: 'La identificación es obligatoria',
      tipoCafe: 'El tipo de café es obligatorio',
      pesoKg: 'El peso debe ser mayor que cero',
      edadMeses: 'La edad debe ser un número de meses (0 o más)',
    })
  })

  it('acepta una ficha completa', () => {
    expect(validarFicha({ identificacion: 'L-001', tipoCafe: 'Arábica', pesoKg: '450.5', edadMeses: '36' })).toEqual({})
  })
})
