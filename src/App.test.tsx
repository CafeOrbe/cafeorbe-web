// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { api } from './shared/api/endpoints'
import type { Usuario } from './shared/api/types'
import { ProveedorSesion } from './shared/session'
import { ProveedorAvisos } from './shared/ui/Avisos'
import { ANA, LUIS, guardarSesion, resumen } from './test/utilidades'

vi.mock('./shared/api/endpoints', () => ({
  api: {
    iniciarSesion: vi.fn(),
    saldo: vi.fn(),
    ganancias: vi.fn(),
    subastasDisponibles: vi.fn(),
    misSubastas: vi.fn(),
    resultados: vi.fn(),
  },
}))

function abrir(ruta: string, usuario: Usuario | null = null) {
  guardarSesion(usuario)
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAvisos>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </ProveedorAvisos>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.saldo).mockResolvedValue({ usuarioId: ANA.id, saldo: 1000 })
  vi.mocked(api.subastasDisponibles).mockResolvedValue([])
  vi.mocked(api.misSubastas).mockResolvedValue([])
  vi.mocked(api.ganancias).mockResolvedValue({ total: 0, ventas: [] })
})

describe('App', () => {
  it('sin sesión cualquier ruta lleva a la pantalla de acceso', () => {
    abrir('/comprador')
    expect(screen.getByRole('heading', { name: 'Entra a la subasta' })).toBeTruthy()
  })

  it('una ruta desconocida lleva al acceso o al home del rol', async () => {
    abrir('/no-existe').unmount()
    abrir('/no-existe', LUIS)
    expect(await screen.findByRole('link', { name: /Crear subasta/ })).toBeTruthy()
  })

  it('las pantallas de ambos roles piden sesión: sin ella vuelven al acceso', () => {
    vi.mocked(api.resultados).mockReturnValue(new Promise(() => undefined))

    abrir('/subastas/s1/resultados').unmount()
    expect(api.resultados).not.toHaveBeenCalled()

    abrir('/subastas/s1/resultados', ANA)
    expect(screen.getByRole('heading', { name: 'Resultados' })).toBeTruthy()
    expect(api.resultados).toHaveBeenCalledWith('s1')
  })

  it('HU-03 · el home del Subastador muestra su nombre, su rol y sus accesos', () => {
    abrir('/subastador', LUIS)

    expect(screen.getByText('Hola, Luis · Subastador')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Crear subasta/ }).getAttribute('href')).toBe('/subastador/subastas/nueva')
    expect(screen.getByRole('link', { name: /Mis subastas/ }).getAttribute('href')).toBe('/subastador/subastas')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
    // HU-24: el Subastador también ve su saldo, que crece con cada venta.
    expect(screen.getByTitle('Tu saldo de Orbes')).toBeTruthy()
  })

  it('HU-03 · un Comprador que abre el home del Subastador vuelve al suyo con "No autorizado"', async () => {
    abrir('/subastador', ANA)

    expect(await screen.findByText('No autorizado')).toBeTruthy()
    expect(screen.getByText('Hola, Ana')).toBeTruthy()
  })

  it('HU-06 · el Comprador ve su saldo en la barra superior', async () => {
    abrir('/comprador', ANA)
    await waitFor(() => expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('1.000 Orbes'))
  })

  it('HU-02 · cerrar sesión borra la sesión y vuelve al acceso', async () => {
    abrir('/subastador', LUIS)

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(screen.getByRole('heading', { name: 'Entra a la subasta' })).toBeTruthy()
    expect(sessionStorage.getItem('cafeorbe.sesion')).toBeNull()
  })

  it('HU-01 y HU-07 · el primer ingreso de un Comprador lo lleva a su home y le avisa de la carga de Orbes', async () => {
    vi.mocked(api.iniciarSesion).mockResolvedValue({ token: 'abc', usuario: ANA, nuevo: true })
    // La carga la hace wallet al recibir el evento: las primeras consultas todavía ven el saldo en 0.
    vi.mocked(api.saldo)
      .mockRejectedValueOnce(new Error('aún no hay cuenta'))
      .mockResolvedValueOnce({ usuarioId: ANA.id, saldo: 0 })
      .mockResolvedValue({ usuarioId: ANA.id, saldo: 1000 })
    vi.mocked(api.subastasDisponibles).mockResolvedValue([resumen({ estado: 'EN_CURSO' })])
    abrir('/login')

    await userEvent.type(screen.getByLabelText(/Nombre para la subasta/), 'Ana')
    await userEvent.click(screen.getByRole('radio', { name: /Comprador/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Entrar a la sala' }))

    expect(await screen.findByText('Hola, Ana')).toBeTruthy()
    expect(await screen.findByText('¡Bienvenido! Recibiste 1.000 Orbes para pujar.', undefined, { timeout: 4000 })).toBeTruthy()
  })
})
