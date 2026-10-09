// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react'
import { Coffee } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resumen } from '../../test/utilidades'
import { api } from '../api/endpoints'
import { ProveedorAvisos, useAvisos } from './Avisos'
import { Campo } from './Campo'
import { Alerta, CargandoLotes, EstadoError, EstadoVacio } from './Estados'
import { EnVivo, EtiquetaEstado } from './EtiquetaEstado'
import { Marca } from './Marca'
import { Monto } from './Orbe'
import { PortadaLote } from './PortadaLote'
import { SaldoOrbes, refrescarSaldo, useSaldoConocido } from './SaldoOrbes'
import { TarjetaLote } from './TarjetaLote'

vi.mock('../api/endpoints', () => ({ api: { saldo: vi.fn() } }))

describe('Campo', () => {
  it('muestra la ayuda mientras no hay error', () => {
    render(
      <Campo etiqueta="Nombre" ayuda="Como te verán en la sala">
        <input />
      </Campo>,
    )
    // La etiqueta envuelve también la ayuda, así que su texto no es solo "Nombre".
    expect(screen.getByLabelText(/Nombre/)).toBeTruthy()
    expect(screen.getByText('Como te verán en la sala')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('HU-08 · el error se muestra junto al campo y reemplaza la ayuda', () => {
    render(
      <Campo etiqueta="Nombre" ayuda="Como te verán en la sala" error="El nombre es obligatorio">
        <input />
      </Campo>,
    )
    expect(screen.getByRole('alert').textContent).toBe('El nombre es obligatorio')
    expect(screen.queryByText('Como te verán en la sala')).toBeNull()
  })
})

describe('Estados', () => {
  it('CargandoLotes anuncia la carga y dibuja las tarjetas de espera', () => {
    const { container } = render(<CargandoLotes texto="Cargando subastas…" cantidad={2} />)
    expect(screen.getByRole('status').textContent).toContain('Cargando subastas…')
    expect(container.querySelectorAll('.esqueleto-lote')).toHaveLength(2)
  })

  it('EstadoVacio muestra título, texto y acciones', () => {
    const { container } = render(
      <EstadoVacio icono={Coffee} titulo="No hay subastas" texto="Vuelve pronto" compacto>
        <button>Crear</button>
      </EstadoVacio>,
    )
    expect(screen.getByText('No hay subastas')).toBeTruthy()
    expect(screen.getByText('Vuelve pronto')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeTruthy()
    expect(container.querySelector('.estado-vacio--compacto')).toBeTruthy()
  })

  it('EstadoVacio sin texto ni acciones solo muestra el título', () => {
    const { container } = render(<EstadoVacio icono={Coffee} titulo="Nadie pujó" />)
    expect(container.querySelector('.estado-vacio__texto')).toBeNull()
    expect(container.querySelector('.acciones')).toBeNull()
  })

  it('EstadoError usa un título por defecto y admite acciones', () => {
    render(
      <EstadoError mensaje="Error 500">
        <button>Reintentar</button>
      </EstadoError>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Algo salió mal')
    expect(screen.getByRole('alert').textContent).toContain('Error 500')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('Alerta anuncia el mensaje', () => {
    render(<Alerta>No se pudo guardar</Alerta>)
    expect(screen.getByRole('alert').textContent).toBe('No se pudo guardar')
  })
})

describe('etiquetas y marca', () => {
  it('EtiquetaEstado traduce el estado y le da su estilo', () => {
    const { container } = render(<EtiquetaEstado estado="DESIERTA" />)
    expect(screen.getByText('Desierta')).toBeTruthy()
    expect(container.querySelector('.etiqueta--estado-desierta')).toBeTruthy()
  })

  it('EnVivo, Monto y Marca muestran su texto', () => {
    const { container } = render(
      <>
        <EnVivo />
        <Monto cantidad={1500} grande />
        <Marca grande />
      </>,
    )
    expect(screen.getByText('EN VIVO')).toBeTruthy()
    expect(screen.getByText('1.500 Orbes')).toBeTruthy()
    expect(container.querySelector('.monto--grande')).toBeTruthy()
    expect(container.querySelector('.marca--grande')?.textContent).toBe('CaféOrbe')
  })

  it('PortadaLote dibuja siempre lo mismo para la misma subasta', () => {
    // Los ids de los degradados cambian en cada render (useId): se ignoran y se compara solo el dibujo.
    const dibujo = (semilla: string) =>
      render(<PortadaLote semilla={semilla} />)
        .container.querySelector('rect + g')
        ?.innerHTML.replace(/url\(#\w+\)/g, 'url(#)')
    expect(dibujo('s1')).toBe(dibujo('s1'))
    expect(dibujo('s1')).not.toBe(dibujo('s2'))
  })
})

describe('TarjetaLote', () => {
  const tarjeta = (cambios: Parameters<typeof resumen>[0], mostrarSubastador = true) =>
    render(
      <ul>
        <TarjetaLote subasta={resumen(cambios)} mostrarSubastador={mostrarSubastador}>
          <a href="/sala">Entrar</a>
        </TarjetaLote>
      </ul>,
    )

  it('HU-04 · una subasta programada muestra nombre, estado, subastador y acción', () => {
    tarjeta({ estado: 'PROGRAMADA', precioActual: 100 })
    expect(screen.getByRole('heading', { name: 'Geisha lavado' })).toBeTruthy()
    expect(screen.getByText('Programada')).toBeTruthy()
    expect(screen.getByText('por Luis')).toBeTruthy()
    expect(screen.getByText('Desde')).toBeTruthy()
    expect(screen.getByText('100 Orbes')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy()
  })

  it('una subasta en curso se marca EN VIVO con su precio actual y sus pujas', () => {
    const { container } = tarjeta({ estado: 'EN_CURSO', precioActual: 150, cantidadPujas: 5 })
    expect(screen.getByText('EN VIVO')).toBeTruthy()
    expect(screen.getByText('Precio actual')).toBeTruthy()
    expect(screen.getByText('5 pujas')).toBeTruthy()
    expect(container.querySelector('.lote--en-vivo')).toBeTruthy()
  })

  it('una subasta cerrada ya no parte "desde" un precio', () => {
    tarjeta({ estado: 'FINALIZADA', precioActual: 300 }, false)
    expect(screen.getByText('Monto final')).toBeTruthy()
    expect(screen.queryByText('por Luis')).toBeNull()
  })

  it('una subasta desierta muestra el precio base y sin reglas no hay precio', () => {
    tarjeta({ estado: 'DESIERTA', precioActual: 100 })
    expect(screen.getByText('Precio base')).toBeTruthy()

    tarjeta({ id: 's2', precioActual: null })
    expect(screen.getByText('Precio base: por definir')).toBeTruthy()
  })
})

describe('Avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra el aviso y lo retira a los 5 segundos', () => {
    const { result } = renderHook(() => useAvisos(), { wrapper: ProveedorAvisos })

    act(() => result.current.mostrar('Subasta creada', 'exito'))
    act(() => result.current.mostrar('Sin tipo'))
    expect(screen.getByRole('status').textContent).toBe('Subasta creadaSin tipo')
    expect(document.querySelector('.aviso--exito')).toBeTruthy()
    expect(document.querySelector('.aviso--info')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('useAvisos fuera del proveedor falla con un mensaje claro', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useAvisos())).toThrow('useAvisos debe usarse dentro de ProveedorAvisos')
    consola.mockRestore()
  })
})

describe('SaldoOrbes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(api.saldo).mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const esperarConsulta = () => act(() => vi.advanceTimersByTimeAsync(0))

  it('HU-06 · muestra el saldo del Comprador en cuanto lo conoce', async () => {
    vi.mocked(api.saldo).mockResolvedValue({ usuarioId: 'u-ana', saldo: 1000 })
    render(<SaldoOrbes />)
    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('— Orbes')

    await esperarConsulta()

    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('1.000 Orbes')
  })

  it('HU-06 · tras un cobro el saldo se actualiza y nunca es negativo', async () => {
    vi.mocked(api.saldo).mockResolvedValueOnce({ usuarioId: 'u-ana', saldo: 1000 })
    render(<SaldoOrbes />)
    await esperarConsulta()

    vi.mocked(api.saldo).mockResolvedValueOnce({ usuarioId: 'u-ana', saldo: 700 })
    act(() => refrescarSaldo())
    await esperarConsulta()
    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('700 Orbes')

    vi.mocked(api.saldo).mockResolvedValueOnce({ usuarioId: 'u-ana', saldo: -50 })
    act(() => refrescarSaldo())
    await esperarConsulta()
    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('0 Orbes')
  })

  it('vuelve a consultar cada 30 segundos y tolera un fallo de red', async () => {
    vi.mocked(api.saldo).mockResolvedValueOnce({ usuarioId: 'u-ana', saldo: 1000 })
    render(<SaldoOrbes />)
    await esperarConsulta()

    vi.mocked(api.saldo).mockRejectedValueOnce(new Error('sin red'))
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('1.000 Orbes')

    vi.mocked(api.saldo).mockResolvedValueOnce({ usuarioId: 'u-ana', saldo: 900 })
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.getByTitle('Tu saldo de Orbes').textContent).toContain('900 Orbes')
  })

  it('al cerrar sesión el saldo deja de ser válido para el siguiente usuario', async () => {
    vi.mocked(api.saldo).mockResolvedValue({ usuarioId: 'u-ana', saldo: 1000 })
    const saldo = renderHook(() => useSaldoConocido())
    const barra = render(<SaldoOrbes />)
    await esperarConsulta()
    expect(saldo.result.current).toBe(1000)

    barra.unmount()

    expect(saldo.result.current).toBeNull()
    expect(api.saldo).toHaveBeenCalledTimes(1)
  })
})
