// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import { LUIS, renderEnApp, resumen } from '../../test/utilidades'
import { MisSubastasPage } from './MisSubastasPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { misSubastas: vi.fn() } }))

const abrir = () => renderEnApp(<MisSubastasPage />, { usuario: LUIS, ruta: '/subastador/subastas' })

/** Enlaces (texto y destino) de la tarjeta de una subasta. */
function acciones(nombre: string) {
  const tarjeta = screen.getByRole('heading', { name: nombre }).closest('li')!
  return within(tarjeta)
    .getAllByRole('link')
    .map((enlace) => [enlace.textContent, enlace.getAttribute('href')])
}

beforeEach(() => {
  vi.mocked(api.misSubastas).mockReset()
})

describe('MisSubastasPage · HU-03', () => {
  it('lista las subastas del Subastador con la acción que corresponde a cada estado', async () => {
    vi.mocked(api.misSubastas).mockResolvedValue([
      resumen({ id: 's1', nombre: 'Programada', estado: 'PROGRAMADA' }),
      resumen({ id: 's2', nombre: 'En curso', estado: 'EN_CURSO' }),
      resumen({ id: 's3', nombre: 'Finalizada', estado: 'FINALIZADA', precioActual: 300 }),
      resumen({ id: 's4', nombre: 'Desierta', estado: 'DESIERTA' }),
    ])
    abrir()

    await screen.findByRole('heading', { name: 'Programada' })
    expect(acciones('Programada')).toEqual([
      ['Configurar', '/subastador/subastas/s1'],
      ['Ir a la sala', '/subastas/s1/sala'],
    ])
    expect(acciones('En curso')).toEqual([['Ir a la sala', '/subastas/s2/sala']])
    // Una subasta cerrada ya no tiene sala: lleva a los resultados.
    expect(acciones('Finalizada')).toEqual([['Ver resultados', '/subastas/s3/resultados']])
    expect(acciones('Desierta')).toEqual([['Ver resultados', '/subastas/s4/resultados']])
    expect(screen.getByText('Monto final')).toBeTruthy()
  })

  it('sin subastas invita a crear la primera', async () => {
    vi.mocked(api.misSubastas).mockResolvedValue([])
    abrir()

    expect(await screen.findByText('Aún no has creado ninguna subasta.')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Crear subasta' }).map((e) => e.getAttribute('href'))).toEqual([
      '/subastador/subastas/nueva',
      '/subastador/subastas/nueva',
    ])
  })

  it('mientras carga anuncia la espera', () => {
    vi.mocked(api.misSubastas).mockReturnValue(new Promise(() => undefined))
    abrir()
    expect(screen.getByText('Cargando…')).toBeTruthy()
  })

  it('si el listado falla muestra el motivo', async () => {
    vi.mocked(api.misSubastas).mockRejectedValue(new Error('Error 500'))
    abrir()
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar tus subastas')
  })
})
