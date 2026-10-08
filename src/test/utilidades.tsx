import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Detalle, Resumen, Usuario } from '../shared/api/types'
import { ProveedorSesion } from '../shared/session'
import { ProveedorAvisos } from '../shared/ui/Avisos'

export const ANA: Usuario = { id: 'u-ana', nombre: 'Ana', rol: 'COMPRADOR' }
export const LUIS: Usuario = { id: 'u-luis', nombre: 'Luis', rol: 'SUBASTADOR' }

/** Deja una sesión guardada como la que escribe ProveedorSesion, o la borra. */
export function guardarSesion(usuario: Usuario | null) {
  if (usuario) sessionStorage.setItem('cafeorbe.sesion', JSON.stringify({ token: `token-${usuario.id}`, usuario }))
  else sessionStorage.removeItem('cafeorbe.sesion')
}

/** Muestra la ruta a la que se navegó cuando la pantalla en prueba redirige a otra. */
function Ubicacion() {
  const ubicacion = useLocation()
  return <p data-testid="ubicacion">{ubicacion.pathname}</p>
}

interface Opciones {
  usuario?: Usuario | null
  ruta?: string
  /** Patrón de la ruta de la pantalla en prueba; cualquier otra ruta muestra `Ubicacion`. */
  patron?: string
}

/** Renderiza una pantalla con el enrutador, los avisos y la sesión, como en la aplicación. */
export function renderEnApp(ui: ReactElement, { usuario = null, ruta = '/', patron = ruta }: Opciones = {}) {
  guardarSesion(usuario)
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAvisos>
        <ProveedorSesion>
          <Routes>
            <Route path={patron} element={ui} />
            <Route path="*" element={<Ubicacion />} />
          </Routes>
        </ProveedorSesion>
      </ProveedorAvisos>
    </MemoryRouter>,
  )
}

export function detalle(cambios: Partial<Detalle> = {}): Detalle {
  return {
    id: 's1',
    nombre: 'Geisha lavado',
    descripcion: null,
    estado: 'EN_CURSO',
    fechaInicio: '2026-10-05T15:00:00Z',
    subastadorId: LUIS.id,
    subastadorNombre: LUIS.nombre,
    ficha: null,
    reglas: { duracionMinutos: 10, precioBase: 100, incrementoMinimo: 10, version: 1 },
    horaInicio: '2026-10-05T15:00:00Z',
    horaFin: '2026-10-05T15:10:00Z',
    precioActual: 100,
    siguienteMinimo: 110,
    lider: null,
    cantidadPujas: 0,
    ultimasPujas: [],
    horaServidor: '2026-10-05T15:00:00Z',
    segundosRestantes: 600,
    extensiones: 0,
    maxExtensiones: 3,
    ...cambios,
  }
}

export function resumen(cambios: Partial<Resumen> = {}): Resumen {
  return {
    id: 's1',
    nombre: 'Geisha lavado',
    estado: 'PROGRAMADA',
    fechaInicio: '2026-10-05T15:00:00Z',
    subastadorNombre: LUIS.nombre,
    precioActual: 100,
    cantidadPujas: 0,
    ...cambios,
  }
}
