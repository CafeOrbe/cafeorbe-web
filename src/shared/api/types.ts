export type Rol = 'SUBASTADOR' | 'COMPRADOR'
export type EstadoSubasta = 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'DESIERTA'

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
}

export interface SesionRespuesta {
  token: string
  usuario: Usuario
  nuevo: boolean
}

export interface Resumen {
  id: string
  nombre: string
  estado: EstadoSubasta
  fechaInicio: string
  subastadorNombre: string
  precioActual: number | null
  cantidadPujas: number
}

export interface Ficha {
  identificacion: string
  tipoCafe: string
  pesoKg: number
  edadMeses: number
  observaciones: string | null
}

export interface Reglas {
  duracionMinutos: number
  precioBase: number
  incrementoMinimo: number
  version: number
}

export interface Lider {
  id: string
  nombre: string
}

export interface Puja {
  id: string
  usuarioId: string
  usuarioNombre: string
  monto: number
  creadaEn: string
}

export interface Detalle {
  id: string
  nombre: string
  descripcion: string | null
  estado: EstadoSubasta
  fechaInicio: string
  subastadorId: string
  subastadorNombre: string
  ficha: Ficha | null
  reglas: Reglas | null
  horaInicio: string | null
  horaFin: string | null
  precioActual: number | null
  siguienteMinimo: number | null
  lider: Lider | null
  cantidadPujas: number
  ultimasPujas: Puja[]
  /** Hora del servidor al responder: el temporizador se mide contra ella, no contra el reloj del navegador (HU-17). */
  horaServidor: string
  /** Tiempo que queda según el servidor; null si la subasta no está en curso. */
  segundosRestantes: number | null
  extensiones: number
  maxExtensiones: number
}

/** HU-22: resumen de una subasta cerrada. Sin ganador ni monto final si quedó desierta. */
export interface Resultados {
  id: string
  nombre: string
  descripcion: string | null
  estado: EstadoSubasta
  subastadorNombre: string
  ficha: Ficha | null
  ganador: Lider | null
  montoFinal: number | null
  cantidadPujas: number
  ultimasPujas: Puja[]
  cerradaEn: string | null
}

/** Movimiento de Orbes de una cuenta. En un abono por venta, `referencia` es el id de la subasta. */
export interface Movimiento {
  id: string
  tipo: string
  monto: number
  saldoResultante: number
  referencia: string
  fecha: string
}

/** HU-24: lo que el Subastador ha ganado con sus subastas vendidas. */
export interface Ganancias {
  total: number
  ventas: Movimiento[]
}

export interface Credenciales {
  url: string
  token: string
  sala: string
}

export interface EstadoTransmision {
  transmitiendo: boolean
  sala: string
}

export interface FichaFormulario {
  identificacion: string
  tipoCafe: string
  pesoKg: number
  edadMeses: number
  observaciones: string
}

export interface ReglasFormulario {
  duracionMinutos: number
  precioBase: number
  incrementoMinimo: number
}
