// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import { ANA, LUIS, renderEnApp } from '../../test/utilidades'
import { LoginPage } from './LoginPage'

vi.mock('../../shared/api/endpoints', () => ({ api: { iniciarSesion: vi.fn() } }))

const abrir = (usuario = null as typeof ANA | null) => renderEnApp(<LoginPage />, { usuario, ruta: '/login' })
const ingresar = () => userEvent.click(screen.getByRole('button', { name: /Entrar a la sala|Entrando/ }))

beforeEach(() => {
  vi.mocked(api.iniciarSesion).mockReset()
})

describe('LoginPage · HU-01', () => {
  it('sin rol seleccionado no se puede ingresar', () => {
    abrir()
    expect((screen.getByRole('button', { name: 'Entrar a la sala' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Selecciona un rol para continuar.')).toBeTruthy()
  })

  it('con rol pero sin nombre el botón sigue deshabilitado y pide el nombre', async () => {
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    expect((screen.getByRole('button', { name: 'Entrar a la sala' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Escribe tu nombre para continuar.')).toBeTruthy()
  })

  it('Acceso exitoso como Comprador: crea la sesión y lleva a su home', async () => {
    vi.mocked(api.iniciarSesion).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: false })
    abrir()

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), '  Ana ')
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await ingresar()

    expect(api.iniciarSesion).toHaveBeenCalledWith('Ana', 'COMPRADOR')
    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/comprador')
  })

  it('Acceso exitoso como Subastador: lleva al home del Subastador', async () => {
    vi.mocked(api.iniciarSesion).mockResolvedValue({ token: 'abc', usuario: LUIS, nuevo: false })
    abrir()

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), 'Luis')
    await userEvent.click(screen.getByRole('radio', { name: /Subastador/ }))
    await ingresar()

    expect(api.iniciarSesion).toHaveBeenCalledWith('Luis', 'SUBASTADOR')
    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/subastador')
  })

  it('Nombre vacío: muestra "El nombre es obligatorio" y no crea la sesión', async () => {
    abrir()

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), '   ')
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await ingresar()

    expect(screen.getByRole('alert').textContent).toBe('El nombre es obligatorio')
    expect(api.iniciarSesion).not.toHaveBeenCalled()

    // Al corregir el nombre el error desaparece.
    await userEvent.type(screen.getByRole('textbox'), 'Ana')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si el servidor falla muestra el motivo y deja reintentar', async () => {
    vi.mocked(api.iniciarSesion).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor.'))
    abrir()

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), 'Ana')
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await ingresar()

    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo conectar con el servidor.')
    expect((screen.getByRole('button', { name: 'Entrar a la sala' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('un fallo sin detalle se explica con un mensaje genérico', async () => {
    vi.mocked(api.iniciarSesion).mockRejectedValueOnce('fallo')
    abrir()

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), 'Ana')
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await ingresar()

    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo iniciar sesión')
  })

  it('con una sesión activa el acceso redirige al home del rol', () => {
    abrir(LUIS)
    expect(screen.getByTestId('ubicacion').textContent).toBe('/subastador')
  })
})
