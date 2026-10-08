import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, configurarCliente, peticion, peticionAlSalir } from './client'

const fetchFalso = vi.fn()

function respuesta(status: number, cuerpo: string | null = null) {
  return new Response(cuerpo, { status })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchFalso)
  configurarCliente(null, null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchFalso.mockReset()
})

describe('peticion', () => {
  it('sin cuerpo ni sesión no envía cabeceras y devuelve el JSON', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, '{"saldo":700}'))

    await expect(peticion('GET', '/api/orbes/saldo')).resolves.toEqual({ saldo: 700 })

    expect(fetchFalso).toHaveBeenCalledWith('http://localhost:8080/api/orbes/saldo', {
      method: 'GET',
      headers: {},
      body: undefined,
    })
  })

  it('con cuerpo y sesión envía el JSON y el token', async () => {
    configurarCliente('abc', null)
    fetchFalso.mockResolvedValue(respuesta(200, '{}'))

    await peticion('POST', '/api/subastas', { nombre: 'Lote' })

    expect(fetchFalso).toHaveBeenCalledWith('http://localhost:8080/api/subastas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc' },
      body: '{"nombre":"Lote"}',
    })
  })

  it('una respuesta sin cuerpo devuelve null', async () => {
    fetchFalso.mockResolvedValue(respuesta(204))
    await expect(peticion('POST', '/api/x')).resolves.toBeNull()
  })

  it('un error del servidor conserva el estado, el mensaje y los campos', async () => {
    fetchFalso.mockResolvedValue(respuesta(400, '{"mensaje":"Datos inválidos","campos":{"nombre":"El nombre es obligatorio"}}'))

    const error = await peticion('POST', '/api/subastas', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Datos inválidos', campos: { nombre: 'El nombre es obligatorio' } })
  })

  it('un error que no trae JSON se describe con el código HTTP', async () => {
    fetchFalso.mockResolvedValue(respuesta(500, '<html>Bad Gateway</html>'))

    const error = await peticion('GET', '/api/x').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 500, message: 'Error 500', campos: {} })
  })

  it('si no hay red explica que no se pudo conectar', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await peticion('GET', '/api/x').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 0 })
    expect((error as ApiError).message).toContain('No se pudo conectar con el servidor')
  })

  it('un 401 con sesión avisa que la sesión expiró', async () => {
    const alExpirar = vi.fn()
    configurarCliente('vencido', alExpirar)
    fetchFalso.mockResolvedValue(respuesta(401, '{"mensaje":"Token inválido"}'))

    await expect(peticion('GET', '/api/x')).rejects.toMatchObject({ status: 401 })

    expect(alExpirar).toHaveBeenCalledTimes(1)
  })

  it('un 401 sin sesión no dispara el aviso de expiración', async () => {
    const alExpirar = vi.fn()
    configurarCliente(null, alExpirar)
    fetchFalso.mockResolvedValue(respuesta(401))

    await expect(peticion('GET', '/api/x')).rejects.toMatchObject({ status: 401 })

    expect(alExpirar).not.toHaveBeenCalled()
  })
})

describe('peticionAlSalir', () => {
  it('Hallazgo 12 · envía la petición con keepalive y el token', () => {
    configurarCliente('abc', null)
    fetchFalso.mockResolvedValue(respuesta(200))

    peticionAlSalir('POST', '/api/streaming/subastas/s1/detener')

    expect(fetchFalso).toHaveBeenCalledWith('http://localhost:8080/api/streaming/subastas/s1/detener', {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
      keepalive: true,
    })
  })

  it('no lanza aunque el navegador rechace la petición', () => {
    fetchFalso.mockRejectedValue(new Error('cancelada'))
    expect(() => peticionAlSalir('POST', '/api/x')).not.toThrow()

    fetchFalso.mockImplementation(() => {
      throw new Error('página descargada')
    })
    expect(() => peticionAlSalir('POST', '/api/x')).not.toThrow()
  })
})
