import { peticion, peticionAlSalir } from './client'
import type {
  Credenciales,
  Detalle,
  EstadoSubasta,
  EstadoTransmision,
  FichaFormulario,
  ReglasFormulario,
  Resumen,
  Rol,
  SesionRespuesta,
} from './types'

export const api = {
  // Acceso (HU-01)
  iniciarSesion: (nombre: string, rol: Rol) => peticion<SesionRespuesta>('POST', '/api/sesion', { nombre, rol }),

  // Orbes (HU-06)
  saldo: () => peticion<{ usuarioId: string; saldo: number }>('GET', '/api/orbes/saldo'),

  // Subastas (HU-03, HU-04, HU-08 a HU-10, HU-12)
  misSubastas: () => peticion<Resumen[]>('GET', '/api/subastas/mias'),
  subastasDisponibles: (estados: EstadoSubasta[]) =>
    peticion<Resumen[]>('GET', `/api/subastas?estado=${estados.map((e) => e.toLowerCase()).join(',')}`),
  detalle: (id: string) => peticion<Detalle>('GET', `/api/subastas/${id}`),
  crearSubasta: (datos: { nombre: string; descripcion: string; fechaInicio: string }) =>
    peticion<Detalle>('POST', '/api/subastas', datos),
  guardarFicha: (id: string, ficha: FichaFormulario) => peticion<Detalle>('PUT', `/api/subastas/${id}/ficha`, ficha),
  guardarReglas: (id: string, reglas: ReglasFormulario) =>
    peticion<Detalle>('PUT', `/api/subastas/${id}/reglas`, reglas),
  iniciarSubasta: (id: string) => peticion<Detalle>('POST', `/api/subastas/${id}/iniciar`),

  // Transmisión (HU-11)
  iniciarTransmision: (id: string) => peticion<Credenciales>('POST', `/api/streaming/subastas/${id}/iniciar`),
  detenerTransmision: (id: string) => peticion<EstadoTransmision>('POST', `/api/streaming/subastas/${id}/detener`),
  /** Hallazgo 12: aviso de "detener" que se envía aunque la pestaña se esté cerrando. */
  detenerTransmisionAlSalir: (id: string) => peticionAlSalir('POST', `/api/streaming/subastas/${id}/detener`),
  estadoTransmision: (id: string) => peticion<EstadoTransmision>('GET', `/api/streaming/subastas/${id}/estado`),
  credencialesTransmision: (id: string) =>
    peticion<Credenciales>('GET', `/api/streaming/subastas/${id}/credenciales`),
}
