// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import { ANA, renderEnApp, resumen } from '../../test/utilidades'
import { HomeCompradorPage } from './HomeCompradorPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { subastasDisponibles: vi.fn(), saldo: vi.fn() } }))

const abrir = (usuario: typeof ANA | null = ANA) => renderEnApp(<HomeCompradorPage />, { usuario, ruta: '/comprador' })

beforeEach(() => {
  vi.resetAllMocks()
})

describe('HomeCompradorPage · HU-04', () => {
  it('Listado de subastas disponibles: nombre, estado y botón Entrar', async () => {
    vi.mocked(api.subastasDisponibles).mockResolvedValue([
      resumen({ id: 's1', nombre: 'Geisha lavado', estado: 'EN_CURSO' }),
      resumen({ id: 's2', nombre: 'Bourbon rosado', estado: 'PROGRAMADA' }),
    ])
    abrir()

    const enVivo = within(await screen.findByRole('region', { name: /Subastando ahora/ }))
    expect(enVivo.getByRole('heading', { name: 'Geisha lavado' })).toBeTruthy()
    expect(enVivo.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/subastas/s1/sala')

    const proximas = within(screen.getByRole('region', { name: /Próximas subastas/ }))
    expect(proximas.getByRole('heading', { name: 'Bourbon rosado' })).toBeTruthy()
    expect(proximas.getByText('Programada')).toBeTruthy()
    expect(proximas.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/subastas/s2/sala')

    expect(api.subastasDisponibles).toHaveBeenCalledWith(['PROGRAMADA', 'EN_CURSO'])
    expect(screen.getByText('Hola, Ana')).toBeTruthy()
  })

  it('Sin subastas disponibles: muestra el mensaje', async () => {
    vi.mocked(api.subastasDisponibles).mockResolvedValue([])
    abrir()

    expect(await screen.findByText('No hay subastas disponibles por ahora')).toBeTruthy()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('mientras carga anuncia la espera', () => {
    vi.mocked(api.subastasDisponibles).mockReturnValue(new Promise(() => undefined))
    abrir()
    expect(screen.getByText('Cargando subastas…')).toBeTruthy()
  })

  it('si el listado falla muestra el motivo', async () => {
    vi.mocked(api.subastasDisponibles).mockRejectedValue(new Error('Error 500'))
    abrir()

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar las subastas')
    expect(screen.getByRole('alert').textContent).toContain('Error 500')
  })

  it('sin sesión no muestra nada', () => {
    vi.mocked(api.subastasDisponibles).mockResolvedValue([])
    const { container } = abrir(null)
    expect(container.querySelector('.hero')).toBeNull()
  })
})
