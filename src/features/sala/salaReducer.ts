import type { Detalle, Puja } from '../../shared/api/types'
import type { EstadoConexion, MensajeSala } from '../../shared/ws/salaSocket'

export interface SalaEstado {
  cargando: boolean
  errorDeCarga: string | null
  detalle: Detalle | null
  conectados: number
  transmitiendo: boolean
  /** Mensaje transitorio: motivo del rechazo de mi puja u otro error de la sala. */
  aviso: string | null
  conexion: EstadoConexion
}

export const estadoInicial: SalaEstado = {
  cargando: true,
  errorDeCarga: null,
  detalle: null,
  conectados: 0,
  transmitiendo: false,
  aviso: null,
  conexion: 'conectando',
}

export type Accion =
  | { tipo: 'DETALLE'; detalle: Detalle }
  | { tipo: 'ERROR_DE_CARGA'; mensaje: string }
  | { tipo: 'CONEXION'; estado: EstadoConexion }
  | { tipo: 'TRANSMISION'; activa: boolean }
  | { tipo: 'MENSAJE'; mensaje: MensajeSala }
  | { tipo: 'LIMPIAR_AVISO' }

const MAX_PUJAS_VISIBLES = 10

/** Aplica los eventos de la sala al estado. Es pura para poder probarla sin navegador. */
export function salaReducer(estado: SalaEstado, accion: Accion): SalaEstado {
  switch (accion.tipo) {
    case 'DETALLE':
      return { ...estado, cargando: false, errorDeCarga: null, detalle: accion.detalle }
    case 'ERROR_DE_CARGA':
      return { ...estado, cargando: false, errorDeCarga: accion.mensaje }
    case 'CONEXION':
      return { ...estado, conexion: accion.estado }
    case 'TRANSMISION':
      return { ...estado, transmitiendo: accion.activa }
    case 'LIMPIAR_AVISO':
      return { ...estado, aviso: null }
    case 'MENSAJE':
      return aplicarMensaje(estado, accion.mensaje)
  }
}

function aplicarMensaje(estado: SalaEstado, mensaje: MensajeSala): SalaEstado {
  const d = mensaje.datos
  switch (mensaje.tipo) {
    case 'CONECTADOS':
      return { ...estado, conectados: Number(d.conectados) }

    case 'TRANSMISION_INICIADA':
      return { ...estado, transmitiendo: true }
    case 'TRANSMISION_DETENIDA':
      return { ...estado, transmitiendo: false }

    case 'SUBASTA_INICIADA': {
      if (!estado.detalle) return estado
      const precioBase = Number(d.precioBase)
      return {
        ...estado,
        detalle: {
          ...estado.detalle,
          estado: 'EN_CURSO',
          horaInicio: String(d.horaInicio),
          horaFin: String(d.horaFin),
          precioActual: precioBase,
          siguienteMinimo: precioBase + Number(d.incrementoMinimo),
        },
      }
    }

    case 'PUJA_ACEPTADA': {
      if (!estado.detalle) return estado
      const nueva: Puja = {
        id: String(d.pujaId),
        usuarioId: String(d.usuarioId),
        usuarioNombre: String(d.usuarioNombre),
        monto: Number(d.monto),
        creadaEn: String(d.ocurridaEn),
      }
      const yaEstaba = estado.detalle.ultimasPujas.some((p) => p.id === nueva.id)
      return {
        ...estado,
        aviso: null,
        detalle: {
          ...estado.detalle,
          precioActual: nueva.monto,
          siguienteMinimo: Number(d.siguienteMinimo),
          lider: { id: nueva.usuarioId, nombre: nueva.usuarioNombre },
          cantidadPujas: Number(d.cantidadPujas),
          ultimasPujas: yaEstaba
            ? estado.detalle.ultimasPujas
            : [nueva, ...estado.detalle.ultimasPujas].slice(0, MAX_PUJAS_VISIBLES),
        },
      }
    }

    // Solo llega a quien pujó (PujaRechazada) o al que envió un mensaje inválido (ERROR).
    case 'PUJA_RECHAZADA':
    case 'ERROR':
      return { ...estado, aviso: String(d.mensaje) }

    default:
      return estado
  }
}
