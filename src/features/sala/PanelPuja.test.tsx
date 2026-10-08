// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { SaldoOrbes } from '../../shared/ui/SaldoOrbes'
import { ANA, detalle } from '../../test/utilidades'
import { FichaLoteCard } from './FichaLoteCard'
import { PanelPuja } from './PanelPuja'
import { Temporizador } from './Temporizador'

vi.mock('../../shared/api/endpoints', () => ({ api: { saldo: vi.fn() } }))

const AHORA = Date.parse('2026-10-05T15:00:00Z')
const BRUNO = { id: 'u-bruno', nombre: 'Bruno' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
  vi.mocked(api.saldo).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PanelPuja', () => {
  const onPujar = vi.fn<(monto: number) => boolean>()
  const onLimpiarAviso = vi.fn()

  function panel(subasta: Detalle, props: Partial<Parameters<typeof PanelPuja>[0]> = {}) {
    const elemento = (s: Detalle, extra = props) => (
      <PanelPuja subasta={s} usuarioId={ANA.id} conectado aviso={null} desfaseMs={0} onPujar={onPujar} onLimpiarAviso={onLimpiarAviso} {...extra} />
    )
    const vista = render(elemento(subasta))
    return { ...vista, actualizar: (s: Detalle, extra = props) => vista.rerender(elemento(s, extra)) }
  }
  const boton = () => screen.getByRole('button') as HTMLButtonElement

  beforeEach(() => {
    onPujar.mockReset().mockReturnValue(true)
    onLimpiarAviso.mockReset()
  })

  it('HU-16 · Subasta sin pujas: muestra el precio base y la leyenda "Sin pujas"', () => {
    panel(detalle())

    expect(screen.getByText('Precio actual').nextElementSibling?.textContent).toBe('100 Orbes')
    expect(screen.getByText('Sin pujas')).toBeTruthy()
    expect(screen.getByText('Incremento mínimo').nextElementSibling?.textContent).toBe('10 Orbes')
    expect(screen.getByText('Precio base').nextElementSibling?.textContent).toBe('100 Orbes')
  })

  it('HU-16 · Actualización tras una puja: precio y nuevo líder sin recargar', () => {
    const { actualizar } = panel(detalle())

    actualizar(detalle({ precioActual: 120, siguienteMinimo: 130, lider: BRUNO, cantidadPujas: 1 }))

    expect(screen.getByText('Precio actual').nextElementSibling?.textContent).toBe('120 Orbes')
    expect(screen.getByText('Lidera Bruno')).toBeTruthy()
    expect(boton().textContent).toBe('Pujar 130')
  })

  it('HU-13 · Puja rápida exitosa: el botón envía el precio actual más el incremento', () => {
    panel(detalle())
    expect(boton().textContent).toBe('Pujar 110')

    fireEvent.click(boton())

    expect(onPujar).toHaveBeenCalledWith(110)
    expect(onLimpiarAviso).toHaveBeenCalled()
    // Mientras llega la respuesta no se puede pujar dos veces.
    expect(boton().disabled).toBe(true)
  })

  it('HU-13 · Botón bloqueado siendo líder: deshabilitado con "Vas ganando"', () => {
    const { container } = panel(detalle({ precioActual: 110, siguienteMinimo: 120, lider: { id: ANA.id, nombre: 'Ana' } }))

    expect(boton().disabled).toBe(true)
    expect(boton().textContent).toBe('Vas ganando')
    expect(screen.getByText('Vas ganando, Ana')).toBeTruthy()
    expect(container.querySelector('.panel-puja--lider')).toBeTruthy()
  })

  it('HU-13 · Saldo insuficiente: el rechazo del servidor se muestra y libera el botón', () => {
    const { actualizar } = panel(detalle())
    fireEvent.click(boton())

    actualizar(detalle(), { aviso: 'Orbes insuficientes' })

    expect(screen.getByRole('alert').textContent).toBe('Orbes insuficientes')
    expect(boton().disabled).toBe(false)
  })

  it('HU-13 · sin Orbes el botón se deshabilita con "Orbes insuficientes"', async () => {
    vi.mocked(api.saldo).mockResolvedValue({ usuarioId: ANA.id, saldo: 0 })
    render(<SaldoOrbes />)
    await act(() => vi.advanceTimersByTimeAsync(0))

    panel(detalle())

    expect(boton().disabled).toBe(true)
    expect(boton().textContent).toBe('Orbes insuficientes')
  })

  it('si la puja no se pudo enviar el botón no se queda bloqueado', () => {
    onPujar.mockReturnValue(false)
    panel(detalle())

    fireEvent.click(boton())

    expect(boton().disabled).toBe(false)
  })

  it('si la respuesta nunca llega el botón se libera a los 4 segundos', () => {
    panel(detalle())
    fireEvent.click(boton())
    expect(boton().disabled).toBe(true)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(boton().disabled).toBe(false)
  })

  it('sin conexión avisa que está reconectando y no deja pujar', () => {
    panel(detalle(), { conectado: false })

    expect(screen.getByRole('status').textContent).toBe('Reconectando con la sala…')
    expect(boton().disabled).toBe(true)
  })

  it('Hallazgo 18 · al pasar la hora de fin el botón dice "Tiempo agotado"', () => {
    panel(detalle({ horaFin: '2026-10-05T15:00:30Z' }))
    expect(boton().textContent).toBe('Pujar 110')

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(boton().textContent).toBe('Tiempo agotado')
    expect(boton().disabled).toBe(true)
  })

  it('HU-18 · si el tiempo se extiende el botón vuelve a ofrecer la puja', () => {
    const { actualizar } = panel(detalle({ horaFin: '2026-10-05T14:59:00Z' }))
    expect(boton().textContent).toBe('Tiempo agotado')

    actualizar(detalle({ horaFin: '2026-10-05T15:00:30Z' }))

    expect(boton().textContent).toBe('Pujar 110')
  })

  it('el tiempo se mide con el reloj del servidor, no con el del navegador', () => {
    // El navegador va un minuto atrasado: para el servidor la subasta ya terminó.
    panel(detalle({ horaFin: '2026-10-05T15:00:30Z' }), { desfaseMs: 60_000 })
    expect(boton().textContent).toBe('Tiempo agotado')
  })

  it('HU-19 · con la subasta cerrada o sin iniciar no se puede pujar', () => {
    const { actualizar } = panel(detalle({ estado: 'FINALIZADA' }))
    expect(boton().textContent).toBe('Subasta cerrada')
    expect(boton().disabled).toBe(true)

    actualizar(detalle({ estado: 'PROGRAMADA', reglas: null, precioActual: null, siguienteMinimo: null, horaFin: null }))
    expect(boton().textContent).toBe('La subasta aún no inicia')
    expect(screen.getByText('Precio actual').nextElementSibling?.textContent).toBe('—')
    expect(screen.queryByText('Incremento mínimo')).toBeNull()
  })

  it('sin monto propuesto el botón queda deshabilitado', () => {
    panel(detalle({ siguienteMinimo: null }))

    fireEvent.click(boton())

    expect(boton().disabled).toBe(true)
    expect(onPujar).not.toHaveBeenCalled()
  })
})

describe('Temporizador · HU-17', () => {
  const reloj = () => screen.getByRole('timer')

  it('Cuenta regresiva sincronizada: muestra mm:ss y avanza con el tiempo', () => {
    render(<Temporizador horaFin="2026-10-05T15:10:00Z" desfaseMs={0} />)
    expect(reloj().textContent).toBe('10:00')

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(reloj().textContent).toBe('09:45')
    expect(reloj().className).toBe('temporizador')
  })

  it('dos navegadores con relojes distintos muestran el mismo tiempo', () => {
    // Este navegador va 90 s adelantado respecto al servidor: el desfase lo corrige.
    vi.setSystemTime(AHORA + 90_000)
    render(<Temporizador horaFin="2026-10-05T15:10:00Z" desfaseMs={-90_000} />)
    expect(reloj().textContent).toBe('10:00')
  })

  it('Alerta del último minuto: cambia de color bajo 60 segundos', () => {
    render(<Temporizador horaFin="2026-10-05T15:01:01Z" desfaseMs={0} />)
    expect(reloj().className).toBe('temporizador')

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(reloj().textContent).toBe('00:59 último minuto')
    expect(reloj().className).toBe('temporizador temporizador--alerta')
  })

  it('al llegar a cero se queda en 00:00 y sin hora de fin no se muestra', () => {
    const { rerender } = render(<Temporizador horaFin="2026-10-05T14:59:00Z" desfaseMs={0} />)
    expect(reloj().textContent).toBe('00:00 último minuto')

    rerender(<Temporizador horaFin={null} desfaseMs={0} />)
    expect(screen.queryByRole('timer')).toBeNull()
  })
})

describe('FichaLoteCard · HU-09', () => {
  it('la ficha registrada es visible en la sala', () => {
    render(
      <FichaLoteCard
        subasta={detalle({
          descripcion: 'Finca La Esperanza',
          ficha: { identificacion: 'L-001', tipoCafe: 'Geisha', pesoKg: 70, edadMeses: 2, observaciones: 'Notas florales' },
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Geisha' })).toBeTruthy()
    expect(screen.getByText('Finca La Esperanza')).toBeTruthy()
    expect(screen.getByText('Identificación').nextElementSibling?.textContent).toBe('L-001')
    expect(screen.getByText('Peso').nextElementSibling?.textContent).toBe('70 kg')
    expect(screen.getByText('Edad').nextElementSibling?.textContent).toBe('2 meses')
    expect(screen.getByText('Notas florales', { exact: false })).toBeTruthy()
  })

  it('sin ficha avisa que el Subastador aún no la registra', () => {
    render(<FichaLoteCard subasta={detalle({ ficha: null })} />)

    expect(screen.getByRole('heading', { name: 'Lote' })).toBeTruthy()
    expect(screen.getByText('El Subastador aún no registra la ficha del lote.')).toBeTruthy()
  })
})
