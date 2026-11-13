// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANA, LUIS, guardarSesion } from '../test/utilidades'
import { configurarCliente } from './api/client'
import { api } from './api/endpoints'
import { ProveedorSesion, tokenActual, useSesion } from './session'

vi.mock('./api/endpoints', () => ({ api: { iniciarSesionConGoogle: vi.fn(), cerrarSesion: vi.fn() } }))
vi.mock('./api/client', () => ({ configurarCliente: vi.fn() }))

const sesion = () => renderHook(() => useSesion(), { wrapper: ProveedorSesion })

beforeEach(() => {
  vi.mocked(api.iniciarSesionConGoogle).mockReset()
  vi.mocked(api.cerrarSesion).mockReset()
  vi.mocked(configurarCliente).mockReset()
})

describe('ProveedorSesion', () => {
  it('HU-01 · iniciar sesión con Google guarda el usuario y entrega el token al cliente HTTP', async () => {
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: false })
    const { result } = sesion()
    expect(result.current.usuario).toBeNull()

    await act(() => result.current.iniciarSesionConGoogle('id-token-Ana', 'COMPRADOR'))

    expect(api.iniciarSesionConGoogle).toHaveBeenCalledWith('id-token-Ana', 'COMPRADOR')
    expect(result.current.usuario).toEqual(ANA)
    expect(result.current.bienvenidaPendiente).toBe(false)
    expect(tokenActual()).toBe('abc')
    expect(vi.mocked(configurarCliente).mock.lastCall?.[0]).toBe('abc')
  })

  it('HU-07 · el primer ingreso de un Comprador deja pendiente el aviso de bienvenida', async () => {
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: true })
    const { result } = sesion()

    await act(() => result.current.iniciarSesionConGoogle('id-token-Ana', 'COMPRADOR'))
    expect(result.current.bienvenidaPendiente).toBe(true)

    act(() => result.current.bienvenidaMostrada())
    expect(result.current.bienvenidaPendiente).toBe(false)
  })

  it('HU-07 · un Subastador nuevo no recibe aviso de carga de Orbes', async () => {
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: LUIS, nuevo: true })
    const { result } = sesion()

    await act(() => result.current.iniciarSesionConGoogle('id-token-Luis', 'SUBASTADOR'))

    expect(result.current.bienvenidaPendiente).toBe(false)
  })

  it('recupera la sesión guardada al recargar la página', () => {
    guardarSesion(ANA)

    const { result } = sesion()

    expect(result.current.usuario).toEqual(ANA)
    expect(vi.mocked(configurarCliente).mock.lastCall?.[0]).toBe('token-u-ana')
  })

  it('una sesión guardada ilegible se trata como sin sesión', () => {
    sessionStorage.setItem('cafeorbe.sesion', '{no es json')

    const { result } = sesion()

    expect(result.current.usuario).toBeNull()
    expect(tokenActual()).toBeNull()
  })

  it('HU-02 · cerrar sesión borra los datos guardados y el token', () => {
    guardarSesion(ANA)
    const { result } = sesion()

    act(() => result.current.cerrarSesion())

    expect(result.current.usuario).toBeNull()
    expect(tokenActual()).toBeNull()
    expect(vi.mocked(configurarCliente).mock.lastCall?.[0]).toBeNull()
    // SEG-05: también se cierra en el servidor.
    expect(api.cerrarSesion).toHaveBeenCalledTimes(1)
  })

  it('cuando el servidor responde 401 la sesión se cierra sola, sin volver a llamar al servidor', () => {
    vi.mocked(api.cerrarSesion).mockClear()
    guardarSesion(ANA)
    const { result } = sesion()
    const alExpirar = vi.mocked(configurarCliente).mock.lastCall?.[1]

    act(() => alExpirar?.())

    expect(result.current.usuario).toBeNull()
    expect(api.cerrarSesion).not.toHaveBeenCalled()
  })

  it('SEG-01 · iniciar sesión con Google guarda la sesión que devuelve el servidor', async () => {
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'g-abc', usuario: ANA, nuevo: true })
    const { result } = sesion()

    await act(async () => {
      await result.current.iniciarSesionConGoogle('id-token', 'COMPRADOR')
    })

    expect(api.iniciarSesionConGoogle).toHaveBeenCalledWith('id-token', 'COMPRADOR')
    expect(result.current.usuario).toEqual(ANA)
    expect(result.current.bienvenidaPendiente).toBe(true)
    expect(tokenActual()).toBe('g-abc')
  })

  it('HU-02 · una página restaurada con Atrás vuelve al acceso si la sesión ya se cerró', () => {
    guardarSesion(ANA)
    const { result } = sesion()
    const restaurar = (persisted: boolean) => {
      const evento = new Event('pageshow')
      Object.defineProperty(evento, 'persisted', { value: persisted })
      act(() => {
        window.dispatchEvent(evento)
      })
    }

    // Con la sesión todavía guardada, o en una carga normal, no pasa nada.
    restaurar(true)
    sessionStorage.clear()
    restaurar(false)
    expect(result.current.usuario).toEqual(ANA)

    restaurar(true)
    expect(result.current.usuario).toBeNull()
  })

  it('sin almacenamiento disponible la sesión vive en memoria', async () => {
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: false })
    const escribir = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento lleno')
    })
    const { result } = sesion()

    await act(() => result.current.iniciarSesionConGoogle('id-token-Ana', 'COMPRADOR'))

    expect(result.current.usuario).toEqual(ANA)
    escribir.mockRestore()
  })
})

describe('useSesion', () => {
  it('fuera del proveedor falla con un mensaje claro', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useSesion())).toThrow('useSesion debe usarse dentro de ProveedorSesion')
    consola.mockRestore()
  })
})
