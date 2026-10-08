import type { Detalle, EstadoSubasta, Puja } from '../../shared/api/types'
import type { EstadoConexion, MensajeSala } from '../../shared/ws/salaSocket'

/** Cierre de la subasta recibido en vivo: lo que anuncia la sala a todos los conectados (HU-21). */
export interface Cierre {
  estado: EstadoSubasta
  ganadorId: string | null
  ganadorNombre: string | null
  montoFinal: number | null
  cantidadPujas: number
}

/** Extensión de tiempo por una puja al final (HU-18). */
export interface Extension {
  segundos: number
  numero: number
  maximo: number
}

export interface SalaEstado {
  cargando: boolean
  errorDeCarga: string | null
  detalle: Detalle | null
  conectados: number
  transmitiendo: boolean
  /** Mensaje transitorio: motivo del rechazo de mi puja u otro error de la sala. */
  aviso: string | null
  conexion: EstadoConexion
  /** Reloj del servidor menos reloj del navegador, en ms: con él se calcula el temporizador (HU-17). */
  desfaseMs: number
  /** Aviso transitorio de "Tiempo extendido". */
  extension: Extension | null
  /** Presente solo si la subasta cerró mientras esta sala estaba abierta. */
  cierre: Cierre | null
  /** HU-24: Orbes que el Subastador acaba de recibir por esta subasta; null si no hubo abono. */
  abono: number | null
}

export const estadoInicial: SalaEstado = {
  cargando: true,
  errorDeCarga: null,
  detalle: null,
  conectados: 0,
  transmitiendo: false,
  aviso: null,
  conexion: 'conectando',
  desfaseMs: 0,
  extension: null,
  cierre: null,
  abono: null,
}

export type Accion =
  | { tipo: 'DETALLE'; detalle: Detalle; desfaseMs?: number }
  | { tipo: 'ERROR_DE_CARGA'; mensaje: string }
  | { tipo: 'CONEXION'; estado: EstadoConexion }
  | { tipo: 'TRANSMISION'; activa: boolean }
  | { tipo: 'MENSAJE'; mensaje: MensajeSala }
  | { tipo: 'LIMPIAR_AVISO' }
  | { tipo: 'LIMPIAR_EXTENSION' }

const MAX_PUJAS_VISIBLES = 10

/** Aplica los eventos de la sala al estado. Es pura para poder probarla sin navegador. */
export function salaReducer(estado: SalaEstado, accion: Accion): SalaEstado {
  switch (accion.tipo) {
    case 'DETALLE':
      return {
        ...estado,
        cargando: false,
        errorDeCarga: null,
        detalle: accion.detalle,
        desfaseMs: accion.desfaseMs ?? estado.desfaseMs,
      }
    case 'ERROR_DE_CARGA':
      return { ...estado, cargando: false, errorDeCarga: accion.mensaje }
    case 'CONEXION':
      return { ...estado, conexion: accion.estado }
    case 'TRANSMISION':
      return { ...estado, transmitiendo: accion.activa }
    case 'LIMPIAR_AVISO':
      return { ...estado, aviso: null }
    case 'LIMPIAR_EXTENSION':
      return { ...estado, extension: null }
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
      // Con varias instancias del realtime-gateway dos pujas seguidas pueden llegar en desorden. Cada puja
      // aceptada supera a la anterior, así que una de monto menor que el precio mostrado es más vieja: se
      // guarda en el historial, pero no puede devolver el precio ni el líder a un valor que ya no es cierto.
      const atrasada = estado.detalle.precioActual !== null && nueva.monto < estado.detalle.precioActual
      if (atrasada) {
        if (yaEstaba) return estado
        const ultimasPujas = [...estado.detalle.ultimasPujas, nueva].sort((a, b) => b.monto - a.monto).slice(0, MAX_PUJAS_VISIBLES)
        return { ...estado, detalle: { ...estado.detalle, ultimasPujas } }
      }
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

    // HU-18: el temporizador toma la nueva hora de fin y la sala muestra el aviso.
    case 'TIEMPO_EXTENDIDO': {
      if (!estado.detalle) return estado
      const numero = Number(d.extension)
      return {
        ...estado,
        extension: { segundos: Number(d.segundosExtendidos), numero, maximo: Number(d.maximoExtensiones) },
        detalle: { ...estado.detalle, horaFin: String(d.horaFin), extensiones: numero },
      }
    }

    // HU-19 y HU-21: la sala pasa al estado final sin recargar y guarda lo que hay que anunciar.
    case 'SUBASTA_CERRADA': {
      if (!estado.detalle) return estado
      const cierre: Cierre = {
        estado: d.estado === 'DESIERTA' ? 'DESIERTA' : 'FINALIZADA',
        ganadorId: d.ganadorId == null ? null : String(d.ganadorId),
        ganadorNombre: d.ganadorNombre == null ? null : String(d.ganadorNombre),
        montoFinal: d.montoFinal == null ? null : Number(d.montoFinal),
        cantidadPujas: Number(d.cantidadPujas),
      }
      return { ...estado, aviso: null, extension: null, cierre, detalle: { ...estado.detalle, estado: cierre.estado } }
    }

    // HU-24: solo llega al Subastador, cuando wallet ya le abonó lo cobrado al ganador.
    case 'ORBES_ABONADOS':
      return { ...estado, abono: Number(d.monto) }

    // Solo llega a quien pujó (PujaRechazada) o al que envió un mensaje inválido (ERROR).
    case 'PUJA_RECHAZADA':
    case 'ERROR':
      return { ...estado, aviso: String(d.mensaje) }

    default:
      return estado
  }
}
