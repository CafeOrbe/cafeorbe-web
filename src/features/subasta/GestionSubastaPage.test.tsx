// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { LUIS, detalle, renderEnApp } from '../../test/utilidades'
import { GestionSubastaPage } from './GestionSubastaPage'

vi.mock('../../shared/api/endpoints', () => ({
  api: { detalle: vi.fn(), guardarFicha: vi.fn(), guardarReglas: vi.fn(), iniciarSubasta: vi.fn() },
}))

const FICHA = { identificacion: 'L-001', tipoCafe: 'Geisha', pesoKg: 70, edadMeses: 2, observaciones: 'Notas florales' }
const REGLAS = { duracionMinutos: 10, precioBase: 100, incrementoMinimo: 10, version: 1 }
const nueva = (cambios: Partial<Detalle> = {}) =>
  detalle({ estado: 'PROGRAMADA', ficha: null, reglas: null, precioActual: null, siguienteMinimo: null, horaInicio: null, horaFin: null, ...cambios })

async function abrir(subasta: Detalle) {
  vi.mocked(api.detalle).mockResolvedValue(subasta)
  renderEnApp(<GestionSubastaPage />, { usuario: LUIS, ruta: '/subastador/subastas/s1', patron: '/subastador/subastas/:id' })
  await screen.findByRole('heading', { name: subasta.nombre })
}

const formulario = (titulo: string) => within(screen.getByRole('heading', { name: titulo }).closest('form')!)
const ficha = () => formulario('Ficha técnica del lote')
const reglas = () => formulario('Tiempo y reglas de puja')
const errores = (dentro: ReturnType<typeof within>) => dentro.queryAllByRole('alert').map((e: HTMLElement) => e.textContent)
const pasos = () =>
  within(screen.getByRole('list', { name: 'Progreso de la preparación' }))
    .getAllByRole('listitem')
    .map((paso) => paso.querySelector('.paso__estado')?.textContent)

async function escribir(dentro: ReturnType<typeof within>, valores: Record<string, string>) {
  for (const [etiqueta, valor] of Object.entries(valores)) {
    const campo = dentro.getByLabelText(new RegExp(`^${etiqueta}`))
    await userEvent.clear(campo)
    if (valor) await userEvent.type(campo, valor)
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GestionSubastaPage', () => {
  it('muestra el progreso de la preparación de una subasta recién creada', async () => {
    await abrir(nueva({ descripcion: 'Finca La Esperanza' }))

    expect(api.detalle).toHaveBeenCalledWith('s1')
    expect(screen.getByText('Finca La Esperanza')).toBeTruthy()
    expect(pasos()).toEqual(['Listo', 'Siguiente', 'Pendiente', 'Pendiente'])
    expect(screen.getByRole('link', { name: 'Ir a la sala' }).getAttribute('href')).toBe('/subastas/s1/sala')
  })

  it('mientras carga anuncia la espera y si falla ofrece volver a Mis subastas', async () => {
    vi.mocked(api.detalle).mockRejectedValue(new Error('La subasta no existe'))
    renderEnApp(<GestionSubastaPage />, { usuario: LUIS, ruta: '/subastador/subastas/s1', patron: '/subastador/subastas/:id' })
    expect(screen.getByText('Cargando…')).toBeTruthy()

    expect((await screen.findByRole('alert')).textContent).toContain('La subasta no existe')
    expect(screen.getByRole('link', { name: 'Mis subastas' }).getAttribute('href')).toBe('/subastador/subastas')
  })
})

describe('FichaForm · HU-09', () => {
  it('Registro de la ficha: queda asociada a la subasta', async () => {
    vi.mocked(api.guardarFicha).mockResolvedValue(nueva({ ficha: FICHA }))
    await abrir(nueva())

    await escribir(ficha(), {
      Identificación: ' L-001 ',
      'Tipo de café': 'Geisha',
      Peso: '70',
      Edad: '2',
      Observaciones: 'Notas florales',
    })
    await userEvent.click(ficha().getByRole('button', { name: 'Guardar ficha' }))

    expect(api.guardarFicha).toHaveBeenCalledWith('s1', FICHA)
    expect(await screen.findByText('Ficha del lote guardada')).toBeTruthy()
    expect(pasos()).toEqual(['Listo', 'Listo', 'Siguiente', 'Pendiente'])
  })

  it('valida los campos antes de enviar', async () => {
    await abrir(nueva())

    await escribir(ficha(), { Peso: '0', Edad: '1.5' })
    await userEvent.click(ficha().getByRole('button', { name: 'Guardar ficha' }))

    expect(errores(ficha())).toEqual([
      'La identificación es obligatoria',
      'El tipo de café es obligatorio',
      'El peso debe ser mayor que cero',
      'La edad debe ser un número de meses (0 o más)',
    ])
    expect(api.guardarFicha).not.toHaveBeenCalled()
  })

  it('Edición bloqueada tras iniciar: la ficha no se puede editar', async () => {
    await abrir(detalle({ estado: 'EN_CURSO', ficha: FICHA }))

    expect(screen.getByText('La ficha no se puede editar con la subasta iniciada')).toBeTruthy()
    expect((ficha().getByLabelText(/^Identificación/) as HTMLInputElement).value).toBe('L-001')
    expect((ficha().getByRole('group') as HTMLFieldSetElement).disabled).toBe(true)
  })

  it('Hallazgo 3 · los errores del servidor se muestran junto al campo o bajo el formulario', async () => {
    vi.mocked(api.guardarFicha)
      .mockRejectedValueOnce(new ApiError(400, 'Datos inválidos', { identificacion: 'Máximo 100 caracteres' }))
      .mockRejectedValueOnce(new ApiError(409, 'La ficha no se puede editar con la subasta iniciada'))
      .mockRejectedValueOnce('fallo')
    await abrir(nueva({ ficha: FICHA }))
    const enviar = () => userEvent.click(ficha().getByRole('button', { name: 'Guardar ficha' }))

    await enviar()
    expect(await ficha().findByText('Máximo 100 caracteres')).toBeTruthy()

    await enviar()
    expect(await ficha().findByText('La ficha no se puede editar con la subasta iniciada')).toBeTruthy()

    await enviar()
    expect(await ficha().findByText('No se pudo guardar la ficha')).toBeTruthy()
  })
})

describe('ReglasForm · HU-10', () => {
  it('Configuración válida: las reglas quedan asociadas a la subasta', async () => {
    vi.mocked(api.guardarReglas).mockResolvedValue(nueva({ ficha: FICHA, reglas: REGLAS }))
    await abrir(nueva({ ficha: FICHA }))

    await escribir(reglas(), { Duración: '10', 'Precio base': '100', 'Incremento mínimo': '10' })
    await userEvent.click(reglas().getByRole('button', { name: 'Guardar reglas' }))

    expect(api.guardarReglas).toHaveBeenCalledWith('s1', { duracionMinutos: 10, precioBase: 100, incrementoMinimo: 10 })
    expect(await screen.findByText('Reglas de puja guardadas')).toBeTruthy()
    expect(pasos()).toEqual(['Listo', 'Listo', 'Listo', 'Siguiente'])
  })

  it('Valores inválidos: muestra "Los valores deben ser mayores que cero" y no guarda', async () => {
    await abrir(nueva())

    await escribir(reglas(), { Duración: '1.5', 'Precio base': '0', 'Incremento mínimo': '' })
    await userEvent.click(reglas().getByRole('button', { name: 'Guardar reglas' }))

    expect(errores(reglas())).toEqual([
      'Debe ser un número entero',
      'Los valores deben ser mayores que cero',
      'Los valores deben ser mayores que cero',
    ])
    expect(api.guardarReglas).not.toHaveBeenCalled()
  })

  it('con la subasta iniciada las reglas quedan bloqueadas', async () => {
    await abrir(detalle({ estado: 'EN_CURSO' }))

    expect(screen.getByText('Las reglas no se pueden cambiar con la subasta iniciada')).toBeTruthy()
    expect((reglas().getByLabelText(/^Precio base/) as HTMLInputElement).value).toBe('100')
    expect((reglas().getByRole('group') as HTMLFieldSetElement).disabled).toBe(true)
  })

  it('los errores del servidor se muestran junto al campo o bajo el formulario', async () => {
    vi.mocked(api.guardarReglas)
      .mockRejectedValueOnce(new ApiError(400, 'Datos inválidos', { precioBase: 'Debe ser un número entero' }))
      .mockRejectedValueOnce(new ApiError(500, 'Error 500'))
      .mockRejectedValueOnce('fallo')
    await abrir(nueva({ reglas: REGLAS }))
    const enviar = () => userEvent.click(reglas().getByRole('button', { name: 'Guardar reglas' }))

    await enviar()
    expect(await reglas().findByText('Debe ser un número entero')).toBeTruthy()

    await enviar()
    expect(await reglas().findByText('Error 500')).toBeTruthy()

    await enviar()
    expect(await reglas().findByText('No se pudieron guardar las reglas')).toBeTruthy()
  })
})

describe('IniciarSubastaBoton · HU-12', () => {
  const boton = () => screen.getByRole('button', { name: /Inicia/ }) as HTMLButtonElement

  it('Inicio de la subasta: pasa a En curso y lleva a la sala', async () => {
    vi.mocked(api.iniciarSubasta).mockResolvedValue(detalle({ estado: 'EN_CURSO' }))
    await abrir(nueva({ ficha: FICHA, reglas: REGLAS }))

    await userEvent.click(boton())

    expect(api.iniciarSubasta).toHaveBeenCalledWith('s1')
    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/subastas/s1/sala')
    expect(screen.getByText('La subasta está en curso: ya se puede pujar')).toBeTruthy()
  })

  it('Inicio sin configuración: el botón se deshabilita y explica el motivo', async () => {
    await abrir(nueva())

    expect(boton().disabled).toBe(true)
    expect(screen.getByText('Configura primero el tiempo y las reglas de puja')).toBeTruthy()
  })

  it('si el servidor rechaza el inicio muestra el motivo y deja reintentar', async () => {
    vi.mocked(api.iniciarSubasta).mockRejectedValueOnce(new ApiError(409, 'La subasta ya fue iniciada')).mockRejectedValueOnce('fallo')
    await abrir(nueva({ reglas: REGLAS }))

    await userEvent.click(boton())
    expect(await screen.findByText('La subasta ya fue iniciada')).toBeTruthy()
    expect(boton().disabled).toBe(false)

    await userEvent.click(boton())
    expect(await screen.findByText('No se pudo iniciar la subasta')).toBeTruthy()
  })

  it('una subasta que ya inició no ofrece iniciarla de nuevo', async () => {
    await abrir(detalle({ estado: 'EN_CURSO' }))
    expect(screen.queryByRole('button', { name: /Inicia/ })).toBeNull()
    expect(pasos()).toEqual(['Listo', 'Siguiente', 'Listo', 'Listo'])
  })
})
