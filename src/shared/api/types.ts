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
