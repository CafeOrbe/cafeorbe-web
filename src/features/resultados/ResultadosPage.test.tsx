// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { api } from '../../shared/api/endpoints'
import type { Resultados, Usuario } from '../../shared/api/types'
import { ANA, LUIS, renderEnApp } from '../../test/utilidades'
import { ResultadosPage } from './ResultadosPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { resultados: vi.fn() } }))

function resultados(cambios: Partial<Resultados> = {}): Resultados {
  return {
    id: 's1',
    nombre: 'Geisha lavado',
    descripcion: null,
    estado: 'FINALIZADA',
    subastadorNombre: 'Luis',
    ficha: { identificacion: 'L-001', tipoCafe: 'Geisha', pesoKg: 70, edadMeses: 2, observaciones: null },
    ganador: { id: ANA.id, nombre: 'Ana' },
    montoFinal: 300,
    cantidadPujas: 2,
    ultimasPujas: [
      { id: 'p2', usuarioId: ANA.id, usuarioNombre: 'Ana', monto: 300, creadaEn: '2026-10-05T15:09:00Z' },
      { id: 'p1', usuarioId: 'u-bruno', usuarioNombre: 'Bruno', monto: 200, creadaEn: '2026-10-05T15:05:00Z' },
    ],
    cerradaEn: '2026-10-05T15:10:00Z',
    ...cambios,
  }
}

const abrir = (usuario: Usuario | null = ANA) =>
  renderEnApp(<ResultadosPage />, { usuario, ruta: '/subastas/s1/resultados', patron: '/subastas/:id/resultados' })

beforeEach(() => {
  vi.mocked(api.resultados).mockReset()
})

describe('ResultadosPage · HU-22', () => {
  it('Resumen de resultados: lote, ganador, monto final, cantidad de pujas e historial', async () => {
    vi.mocked(api.resultados).mockResolvedValue(resultados())
    abrir()

    expect(await screen.findByRole('heading', { name: 'Geisha lavado' })).toBeTruthy()
    expect(api.resultados).toHaveBeenCalledWith('s1')
    expect(screen.getByText('Finalizada')).toBeTruthy()
    expect(screen.getByText(/^Cerró el /)).toBeTruthy()
    expect(screen.getByText('Ana (tú)', { selector: '.ganador__nombre' })).toBeTruthy()
    expect(screen.getByText('Monto final').nextElementSibling?.textContent).toBe('300 Orbes')
    expect(screen.getByText('Pujas').nextElementSibling?.textContent).toBe('2')
    expect(screen.getByText('Lote').nextElementSibling?.textContent).toBe('Geisha · 70 kg')
    expect(screen.getByText('Identificación').nextElementSibling?.textContent).toBe('L-001')
    expect(screen.getByText('Subastado por Luis.')).toBeTruthy()

    const pujas = within(screen.getByRole('region', { name: 'Últimas pujas' })).getAllByRole('listitem')
    expect(pujas.map((p) => p.querySelector('.puja__nombre')?.textContent)).toEqual(['Ana (tú)', 'Bruno'])
    expect(pujas[0].className).toBe('puja puja--lider puja--mia')
    expect(pujas[1].textContent).toContain('200 Orbes')
  })

  it('Visible para todos los participantes: quien no ganó ve el mismo resumen', async () => {
    vi.mocked(api.resultados).mockResolvedValue(resultados())
    abrir({ id: 'u-bruno', nombre: 'Bruno', rol: 'COMPRADOR' })

    expect(await screen.findByText('Ana', { selector: '.ganador__nombre' })).toBeTruthy()
    expect(screen.getByText('Monto final').nextElementSibling?.textContent).toBe('300 Orbes')
    expect(screen.getByText('Bruno (tú)')).toBeTruthy()
  })

  it('una subasta desierta informa que no hubo ganador', async () => {
    vi.mocked(api.resultados).mockResolvedValue(
      resultados({ estado: 'DESIERTA', ganador: null, montoFinal: null, cantidadPujas: 0, ultimasPujas: [], ficha: null, cerradaEn: null }),
    )
    abrir()

    expect(await screen.findByText('Subasta desierta: no hubo ganador')).toBeTruthy()
    expect(screen.getByText('Monto final').nextElementSibling?.textContent).toBe('—')
    expect(screen.getByText('Lote').nextElementSibling?.textContent).toBe('Sin ficha registrada')
    expect(screen.queryByText('Identificación')).toBeNull()
    expect(screen.queryByText(/^Cerró el /)).toBeNull()
    expect(screen.getByText('Nadie pujó en esta subasta.')).toBeTruthy()
  })

  it('si la subasta aún no cierra ofrece volver a la sala', async () => {
    vi.mocked(api.resultados).mockRejectedValue(new ApiError(409, 'La subasta aún no ha finalizado'))
    abrir()

    expect(await screen.findByText('La subasta aún no ha finalizado')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a la sala' }).getAttribute('href')).toBe('/subastas/s1/sala')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si la consulta falla muestra el motivo', async () => {
    vi.mocked(api.resultados).mockRejectedValueOnce(new ApiError(404, 'La subasta no existe'))
    abrir()
    expect((await screen.findByRole('alert')).textContent).toContain('La subasta no existe')
  })

  it('un fallo sin detalle se explica con un mensaje genérico', async () => {
    vi.mocked(api.resultados).mockRejectedValueOnce('fallo')
    abrir()
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron cargar los resultados')
  })

  it('mientras carga anuncia la espera', () => {
    vi.mocked(api.resultados).mockReturnValue(new Promise(() => undefined))
    abrir()
    expect(screen.getByText('Cargando…')).toBeTruthy()
  })
})

describe('ResultadosPage · HU-23', () => {
  it('Retorno según el rol: el Comprador vuelve al home del Comprador', async () => {
    vi.mocked(api.resultados).mockResolvedValue(resultados())
    abrir(ANA)
    expect((await screen.findByRole('link', { name: 'Volver al home' })).getAttribute('href')).toBe('/comprador')
  })

  it('Retorno según el rol: el Subastador vuelve al home del Subastador', async () => {
    vi.mocked(api.resultados).mockResolvedValue(resultados())
    abrir(LUIS)
    expect((await screen.findByRole('link', { name: 'Volver al home' })).getAttribute('href')).toBe('/subastador')
  })

  it('sin sesión no ofrece volver al home', async () => {
    vi.mocked(api.resultados).mockResolvedValue(resultados())
    abrir(null)
    await screen.findByRole('heading', { name: 'Geisha lavado' })
    expect(screen.queryByRole('link', { name: 'Volver al home' })).toBeNull()
  })
})
