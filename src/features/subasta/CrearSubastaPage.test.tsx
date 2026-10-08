// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { api } from '../../shared/api/endpoints'
import { LUIS, detalle, renderEnApp } from '../../test/utilidades'
import { CrearSubastaPage } from './CrearSubastaPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { crearSubasta: vi.fn() } }))

const FECHA_FUTURA = '2099-01-01T10:00'

const abrir = () => renderEnApp(<CrearSubastaPage />, { usuario: LUIS, ruta: '/subastador/subastas/nueva' })
const campoNombre = () => screen.getByLabelText(/Nombre de la subasta/)
const campoFecha = () => screen.getByLabelText(/Fecha y hora de inicio/)
const guardar = () => userEvent.click(screen.getByRole('button', { name: /Guarda/ }))
const errores = () => screen.queryAllByRole('alert').map((e) => e.textContent)

beforeEach(() => {
  vi.mocked(api.crearSubasta).mockReset()
})

describe('CrearSubastaPage · HU-08', () => {
  it('Creación exitosa: guarda la subasta y pasa a prepararla', async () => {
    vi.mocked(api.crearSubasta).mockResolvedValue(detalle({ id: 's9', estado: 'PROGRAMADA' }))
    abrir()

    await userEvent.type(campoNombre(), '  Geisha lavado ')
    await userEvent.type(screen.getByLabelText(/Descripción/), ' Finca La Esperanza ')
    fireEvent.change(campoFecha(), { target: { value: FECHA_FUTURA } })
    await guardar()

    expect(api.crearSubasta).toHaveBeenCalledWith({
      nombre: 'Geisha lavado',
      descripcion: 'Finca La Esperanza',
      fechaInicio: new Date(FECHA_FUTURA).toISOString(),
    })
    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/subastador/subastas/s9')
    expect(screen.getByText('Subasta creada. Ahora registra la ficha del lote y las reglas de puja.')).toBeTruthy()
  })

  it('Campos obligatorios: señala los campos faltantes y no crea la subasta', async () => {
    abrir()

    await guardar()

    expect(errores()).toEqual(['El nombre es obligatorio', 'La fecha de inicio es obligatoria'])
    expect(api.crearSubasta).not.toHaveBeenCalled()
  })

  it('Fecha en el pasado: muestra "La fecha de inicio debe ser futura" y no crea la subasta', async () => {
    abrir()

    await userEvent.type(campoNombre(), 'Geisha lavado')
    fireEvent.change(campoFecha(), { target: { value: '2020-01-01T10:00' } })
    await guardar()

    expect(errores()).toEqual(['La fecha de inicio debe ser futura'])
    expect(api.crearSubasta).not.toHaveBeenCalled()
  })

  it('Hallazgo 3 · un error de campo que llega del servidor se muestra junto al campo', async () => {
    vi.mocked(api.crearSubasta).mockRejectedValue(new ApiError(400, 'Datos inválidos', { fechaInicio: 'La fecha de inicio debe ser futura' }))
    abrir()

    await userEvent.type(campoNombre(), 'Geisha lavado')
    fireEvent.change(campoFecha(), { target: { value: FECHA_FUTURA } })
    await guardar()

    expect(await screen.findByText('La fecha de inicio debe ser futura')).toBeTruthy()
    expect(campoFecha().closest('label')?.className).toBe('campo campo--error')
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('un error general del servidor se muestra bajo el formulario', async () => {
    vi.mocked(api.crearSubasta).mockRejectedValueOnce(new ApiError(500, 'Error 500')).mockRejectedValueOnce('fallo')
    abrir()

    await userEvent.type(campoNombre(), 'Geisha lavado')
    fireEvent.change(campoFecha(), { target: { value: FECHA_FUTURA } })
    await guardar()
    expect(await screen.findByText('Error 500')).toBeTruthy()

    await guardar()
    expect(await screen.findByText('No se pudo crear la subasta')).toBeTruthy()
  })

  it('Cancelar vuelve a la pantalla anterior sin guardar', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.crearSubasta).not.toHaveBeenCalled()
  })
})
