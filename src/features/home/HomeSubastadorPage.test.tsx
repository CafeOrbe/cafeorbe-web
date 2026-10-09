// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import type { Movimiento } from '../../shared/api/types'
import { LUIS, renderEnApp, resumen } from '../../test/utilidades'
import { HomeSubastadorPage } from './HomeSubastadorPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { ganancias: vi.fn(), misSubastas: vi.fn() } }))

const abrir = (usuario: typeof LUIS | null = LUIS) => renderEnApp(<HomeSubastadorPage />, { usuario, ruta: '/subastador' })
const ganancias = () => within(screen.getByRole('region', { name: 'Tus ganancias' }))

function venta(subastaId: string, monto: number): Movimiento {
  return { id: `m-${subastaId}`, tipo: 'ABONO_VENTA', monto, saldoResultante: monto, referencia: subastaId, fecha: '2026-10-08T02:06:29Z' }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.misSubastas).mockResolvedValue([])
})

describe('HomeSubastadorPage · HU-24', () => {
  it('muestra el total de Orbes ganados y cada venta con su lote y su monto', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 500, ventas: [venta('s2', 200), venta('s1', 300)] })
    vi.mocked(api.misSubastas).mockResolvedValue([
      resumen({ id: 's1', nombre: 'Geisha lavado', estado: 'FINALIZADA' }),
      resumen({ id: 's2', nombre: 'Bourbon rosado', estado: 'FINALIZADA' }),
    ])
    abrir()

    expect((await ganancias().findByText('Orbes ganados')).nextElementSibling?.textContent).toBe('500 Orbes')
    expect(ganancias().getByText('Lotes vendidos').nextElementSibling?.textContent).toBe('2')
    const ventas = ganancias().getAllByRole('listitem')
    expect(ventas.map((v) => v.querySelector('.puja__monto')?.textContent)).toEqual(['200 Orbes', '300 Orbes'])
    // Cada venta lleva a los resultados de su subasta.
    const enlace = await ganancias().findByRole('link', { name: 'Bourbon rosado' })
    expect(enlace.getAttribute('href')).toBe('/subastas/s2/resultados')
    expect(ganancias().getByRole('link', { name: 'Geisha lavado' })).toBeTruthy()
  })

  it('destaca la próxima subasta, o la que está en vivo, con su acción', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
    const manana = new Date(Date.now() + 26 * 3600_000).toISOString()
    vi.mocked(api.misSubastas).mockResolvedValue([
      resumen({ id: 's9', nombre: 'Lote lejano', estado: 'PROGRAMADA', fechaInicio: new Date(Date.now() + 96 * 3600_000).toISOString() }),
      resumen({ id: 's8', nombre: 'Lote de mañana', estado: 'PROGRAMADA', fechaInicio: manana }),
      resumen({ id: 's7', nombre: 'Lote vencido', estado: 'PROGRAMADA', fechaInicio: '2020-01-01T10:00:00Z' }),
    ])
    abrir()

    const bloque = within(await screen.findByRole('region', { name: 'Tu próxima subasta' }))
    expect(bloque.getByText('Lote de mañana')).toBeTruthy()
    expect(bloque.getByRole('link', { name: /Gestionar/ }).getAttribute('href')).toBe('/subastador/subastas/s8')
  })

  it('si hay una subasta en vivo la pone por delante de la próxima', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
    vi.mocked(api.misSubastas).mockResolvedValue([
      resumen({ id: 's8', nombre: 'Lote de mañana', estado: 'PROGRAMADA', fechaInicio: new Date(Date.now() + 26 * 3600_000).toISOString() }),
      resumen({ id: 's5', nombre: 'Lote en vivo', estado: 'EN_CURSO', cantidadPujas: 4 }),
    ])
    abrir()

    const bloque = within(await screen.findByRole('region', { name: /Estás subastando ahora/ }))
    expect(bloque.getByText('Lote en vivo')).toBeTruthy()
    expect(bloque.getByText('4 pujas hasta ahora')).toBeTruthy()
    expect(bloque.getByRole('link', { name: /Ir a la sala/ }).getAttribute('href')).toBe('/subastas/s5/sala')
  })

  it('sin subastas por empezar no muestra el bloque', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
    abrir()
    await ganancias().findByText('Aún no has vendido ningún lote.')
    expect(screen.queryByRole('region', { name: /próxima subasta|subastando ahora/i })).toBeNull()
  })

  it('sin ventas explica cuándo aparecerán los Orbes', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
    abrir()

    expect(await ganancias().findByText('Aún no has vendido ningún lote.')).toBeTruthy()
    expect(ganancias().getByText('Orbes ganados').nextElementSibling?.textContent).toBe('0 Orbes')
    expect(ganancias().queryByRole('list')).toBeNull()
  })

  it('mientras carga deja los totales en espera', () => {
    vi.mocked(api.ganancias).mockReturnValue(new Promise(() => undefined))
    abrir()

    expect(ganancias().getByText('Orbes ganados').nextElementSibling?.textContent).toBe('—')
    expect(ganancias().getByText('Lotes vendidos').nextElementSibling?.textContent).toBe('—')
  })

  it('si no llegan los nombres de las subastas las ventas se muestran igual', async () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 300, ventas: [venta('s1', 300)] })
    vi.mocked(api.misSubastas).mockRejectedValue(new Error('Error 500'))
    abrir()

    expect((await ganancias().findByRole('link', { name: 'Subasta vendida' })).getAttribute('href')).toBe('/subastas/s1/resultados')
  })

  it('si no se pueden consultar las ganancias el home sigue funcionando sin esa sección', async () => {
    vi.mocked(api.ganancias).mockRejectedValue(new Error('Error 500'))
    abrir()

    expect(await screen.findByRole('link', { name: /Crear subasta/ })).toBeTruthy()
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Tus ganancias' })).toBeNull())
  })

  it('sin sesión no muestra nada', () => {
    vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
    const { container } = abrir(null)
    expect(container.querySelector('.hero')).toBeNull()
  })
})
