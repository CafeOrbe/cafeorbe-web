// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import { ANA, LUIS, renderEnApp } from '../../test/utilidades'
import { reiniciarCargaGoogle } from './BotonGoogle'
import { LoginPage } from './LoginPage'

vi.mock('../../shared/api/endpoints', () => ({
  api: { iniciarSesionConGoogle: vi.fn(), cerrarSesion: vi.fn() },
}))

const abrir = (usuario = null as typeof ANA | null) => renderEnApp(<LoginPage />, { usuario, ruta: '/login' })

beforeEach(() => {
  vi.mocked(api.iniciarSesionConGoogle).mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete window.google
  reiniciarCargaGoogle()
})

describe('LoginPage · HU-01', () => {
  it('SEG-01 · no hay login propio: ni campo de nombre, ni contraseña, ni botón para entrar sin Google', () => {
    abrir()
    expect(screen.queryByLabelText(/Nombre/)).toBeNull()
    expect(document.querySelector('input[type="password"], input[type="text"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Entrar a la sala/ })).toBeNull()
    expect(screen.getByText('Selecciona un rol para continuar.')).toBeTruthy()
  })

  it('con una sesión activa el acceso redirige al home del rol', () => {
    abrir(LUIS)
    expect(screen.getByTestId('ubicacion').textContent).toBe('/subastador')
  })
})

/** Google Identity Services de mentira: guarda el callback para entregar el ID token cuando la prueba quiera. */
function googleFalso() {
  const estado: { callback?: (r: { credential?: string }) => void; clientId?: string } = {}
  window.google = {
    accounts: {
      id: {
        initialize: (o) => {
          estado.callback = o.callback
          estado.clientId = o.client_id
        },
        renderButton: (contenedor) => {
          contenedor.textContent = 'Continuar con Google'
        },
      },
    },
  }
  return estado
}

describe('LoginPage · SEG-01 acceso con Google', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente-web.apps.googleusercontent.com')
  })

  it('primero el rol y luego el botón de Google', async () => {
    googleFalso()
    abrir()
    expect(screen.queryByLabelText(/Nombre para la subasta/)).toBeNull()
    expect(screen.getByText('Selecciona un rol para continuar.')).toBeTruthy()
    expect(screen.queryByTestId('boton-google')).toBeNull()

    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    expect((await screen.findByTestId('boton-google')).textContent).toBe('Continuar con Google')
  })

  it('envía el ID token de Google con el rol elegido y lleva al home del rol', async () => {
    const google = googleFalso()
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: LUIS, nuevo: false })
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Subastador/ }))
    await screen.findByTestId('boton-google')

    expect(google.clientId).toBe('cliente-web.apps.googleusercontent.com')
    google.callback?.({ credential: 'id-token-de-google' })

    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/subastador')
    expect(api.iniciarSesionConGoogle).toHaveBeenCalledWith('id-token-de-google', 'SUBASTADOR')
  })

  it('Acceso como Comprador: lleva a su home', async () => {
    const google = googleFalso()
    vi.mocked(api.iniciarSesionConGoogle).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: false })
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await screen.findByTestId('boton-google')

    google.callback?.({ credential: 'id-token-de-google' })

    expect((await screen.findByTestId('ubicacion')).textContent).toBe('/comprador')
    expect(api.iniciarSesionConGoogle).toHaveBeenCalledWith('id-token-de-google', 'COMPRADOR')
  })

  it('un fallo sin detalle se explica con un mensaje genérico', async () => {
    const google = googleFalso()
    vi.mocked(api.iniciarSesionConGoogle).mockRejectedValueOnce('fallo')
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await screen.findByTestId('boton-google')

    google.callback?.({ credential: 'id-token-de-google' })

    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo iniciar sesión con Google')
  })

  it('si el servidor rechaza el token (401) muestra el motivo y deja reintentar', async () => {
    const google = googleFalso()
    vi.mocked(api.iniciarSesionConGoogle).mockRejectedValueOnce(new Error('Sesión requerida o expirada'))
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await screen.findByTestId('boton-google')

    google.callback?.({ credential: 'falso' })

    expect((await screen.findByRole('alert')).textContent).toBe('Sesión requerida o expirada')
    expect(await screen.findByTestId('boton-google')).toBeTruthy()
  })

  it('si Google no entrega credencial lo explica sin llamar al servidor', async () => {
    const google = googleFalso()
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await screen.findByTestId('boton-google')

    google.callback?.({})

    expect((await screen.findByRole('alert')).textContent).toBe('Google no entregó la credencial, intenta de nuevo')
    expect(api.iniciarSesionConGoogle).not.toHaveBeenCalled()
  })

  it('sin Client ID configurado lo dice en lugar de mostrar un botón roto', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    expect(screen.getByText('El acceso con Google no está configurado en este ambiente.')).toBeTruthy()
  })

  it('si la librería de Google no carga avisa del problema', async () => {
    abrir()
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    const script = document.head.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    expect(script).toBeTruthy()
    script?.onerror?.(new Event('error'))
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar el acceso con Google')
    script?.remove()
  })
})
