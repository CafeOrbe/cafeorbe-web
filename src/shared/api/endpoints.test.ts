import { beforeEach, describe, expect, it, vi } from 'vitest'
import { peticion, peticionAlSalir } from './client'
import { api } from './endpoints'

vi.mock('./client', () => ({ peticion: vi.fn(), peticionAlSalir: vi.fn() }))

beforeEach(() => {
  vi.mocked(peticion).mockReset()
  vi.mocked(peticionAlSalir).mockReset()
})

describe('api', () => {
  it('cada operación llama a la ruta y el método que expone el api-gateway', () => {
    const ficha = { identificacion: 'L-1', tipoCafe: 'Geisha', pesoKg: 70, edadMeses: 2, observaciones: '' }
    const reglas = { duracionMinutos: 10, precioBase: 100, incrementoMinimo: 10 }
    const subasta = { nombre: 'Lote', descripcion: '', fechaInicio: '2026-10-05T15:00:00.000Z' }

    api.iniciarSesion('Ana', 'COMPRADOR')
    api.saldo()
    api.misSubastas()
    api.subastasDisponibles(['PROGRAMADA', 'EN_CURSO'])
    api.detalle('s1')
    api.crearSubasta(subasta)
    api.guardarFicha('s1', ficha)
    api.guardarReglas('s1', reglas)
    api.iniciarSubasta('s1')
    api.resultados('s1')
    api.iniciarTransmision('s1')
    api.detenerTransmision('s1')
    api.estadoTransmision('s1')
    api.credencialesTransmision('s1')

    expect(vi.mocked(peticion).mock.calls).toEqual([
      ['POST', '/api/sesion', { nombre: 'Ana', rol: 'COMPRADOR' }],
      ['GET', '/api/orbes/saldo'],
      ['GET', '/api/subastas/mias'],
      ['GET', '/api/subastas?estado=programada,en_curso'],
      ['GET', '/api/subastas/s1'],
      ['POST', '/api/subastas', subasta],
      ['PUT', '/api/subastas/s1/ficha', ficha],
      ['PUT', '/api/subastas/s1/reglas', reglas],
      ['POST', '/api/subastas/s1/iniciar'],
      ['GET', '/api/subastas/s1/resultados'],
      ['POST', '/api/streaming/subastas/s1/iniciar'],
      ['POST', '/api/streaming/subastas/s1/detener'],
      ['GET', '/api/streaming/subastas/s1/estado'],
      ['GET', '/api/streaming/subastas/s1/credenciales'],
    ])
  })

  it('Hallazgo 12 · el aviso de detener al salir no espera respuesta', () => {
    api.detenerTransmisionAlSalir('s1')
    expect(peticionAlSalir).toHaveBeenCalledWith('POST', '/api/streaming/subastas/s1/detener')
  })
})
