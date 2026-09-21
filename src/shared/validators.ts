/** Validaciones de formularios, con los mismos mensajes que devuelve el backend. */

export const MSG_NOMBRE_OBLIGATORIO = 'El nombre es obligatorio'
export const MSG_FECHA_FUTURA = 'La fecha de inicio debe ser futura'
export const MSG_VALORES_POSITIVOS = 'Los valores deben ser mayores que cero'

export type Errores<T extends string> = Partial<Record<T, string>>

export function validarNombre(nombre: string): string | null {
  return nombre.trim() === '' ? MSG_NOMBRE_OBLIGATORIO : null
}

/** Convierte un texto a número positivo; null si está vacío, no es número o no es mayor que cero. */
export function numeroPositivo(texto: string): number | null {
  if (texto.trim() === '') return null
  const n = Number(texto)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function validarCrearSubasta(
  datos: { nombre: string; fechaInicio: string },
  ahora: Date = new Date(),
): Errores<'nombre' | 'fechaInicio'> {
  const errores: Errores<'nombre' | 'fechaInicio'> = {}
  if (datos.nombre.trim() === '') errores.nombre = MSG_NOMBRE_OBLIGATORIO
  if (datos.fechaInicio === '') errores.fechaInicio = 'La fecha de inicio es obligatoria'
  else if (new Date(datos.fechaInicio).getTime() <= ahora.getTime()) errores.fechaInicio = MSG_FECHA_FUTURA
  return errores
}

export function validarReglas(datos: {
  duracionMinutos: string
  precioBase: string
  incrementoMinimo: string
}): Errores<'duracionMinutos' | 'precioBase' | 'incrementoMinimo'> {
  const errores: Errores<'duracionMinutos' | 'precioBase' | 'incrementoMinimo'> = {}
  if (numeroPositivo(datos.duracionMinutos) === null) errores.duracionMinutos = MSG_VALORES_POSITIVOS
  if (numeroPositivo(datos.precioBase) === null) errores.precioBase = MSG_VALORES_POSITIVOS
  if (numeroPositivo(datos.incrementoMinimo) === null) errores.incrementoMinimo = MSG_VALORES_POSITIVOS
  return errores
}

export function validarFicha(datos: {
  identificacion: string
  raza: string
  pesoKg: string
  edadMeses: string
}): Errores<'identificacion' | 'raza' | 'pesoKg' | 'edadMeses'> {
  const errores: Errores<'identificacion' | 'raza' | 'pesoKg' | 'edadMeses'> = {}
  if (datos.identificacion.trim() === '') errores.identificacion = 'La identificación es obligatoria'
  if (datos.raza.trim() === '') errores.raza = 'La raza es obligatoria'
  if (numeroPositivo(datos.pesoKg) === null) errores.pesoKg = 'El peso debe ser mayor que cero'
  const edad = datos.edadMeses.trim() === '' ? NaN : Number(datos.edadMeses)
  if (!Number.isInteger(edad) || edad < 0) errores.edadMeses = 'La edad debe ser un número de meses (0 o más)'
  return errores
}

export function hayErrores(errores: object): boolean {
  return Object.keys(errores).length > 0
}
