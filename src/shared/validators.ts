/** Validaciones de formularios, con los mismos mensajes que devuelve el backend. */

export const MSG_NOMBRE_OBLIGATORIO = 'El nombre es obligatorio'
export const MSG_FECHA_FUTURA = 'La fecha de inicio debe ser futura'
export const MSG_VALORES_POSITIVOS = 'Los valores deben ser mayores que cero'
export const MSG_ENTERO = 'Debe ser un número entero'

/** Límites de la ficha: los mismos de la base de datos y del backend (hallazgo 1). */
export const MAX_TEXTO_FICHA = 100
export const MAX_OBSERVACIONES = 1000

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
  else {
    const minutoActual = new Date(ahora)
    minutoActual.setSeconds(0, 0)
    if (new Date(datos.fechaInicio).getTime() < minutoActual.getTime()) errores.fechaInicio = MSG_FECHA_FUTURA
  }
  return errores
}

export function validarReglas(datos: {
  duracionMinutos: string
  precioBase: string
  incrementoMinimo: string
}): Errores<'duracionMinutos' | 'precioBase' | 'incrementoMinimo'> {
  const errores: Errores<'duracionMinutos' | 'precioBase' | 'incrementoMinimo'> = {}
  // Hallazgo 2: el backend espera enteros; un decimal como 1.5 ya no se trunca en silencio.
  const revisar = (texto: string) => {
    const n = numeroPositivo(texto)
    if (n === null) return MSG_VALORES_POSITIVOS
    return Number.isInteger(n) ? null : MSG_ENTERO
  }
  const duracion = revisar(datos.duracionMinutos)
  const precio = revisar(datos.precioBase)
  const incremento = revisar(datos.incrementoMinimo)
  if (duracion) errores.duracionMinutos = duracion
  if (precio) errores.precioBase = precio
  if (incremento) errores.incrementoMinimo = incremento
  return errores
}

export function validarFicha(datos: {
  identificacion: string
  tipoCafe: string
  pesoKg: string
  edadMeses: string
}): Errores<'identificacion' | 'tipoCafe' | 'pesoKg' | 'edadMeses'> {
  const errores: Errores<'identificacion' | 'tipoCafe' | 'pesoKg' | 'edadMeses'> = {}
  if (datos.identificacion.trim() === '') errores.identificacion = 'La identificación es obligatoria'
  if (datos.tipoCafe.trim() === '') errores.tipoCafe = 'El tipo de café es obligatorio'
  if (numeroPositivo(datos.pesoKg) === null) errores.pesoKg = 'El peso debe ser mayor que cero'
  const edad = datos.edadMeses.trim() === '' ? NaN : Number(datos.edadMeses)
  if (!Number.isInteger(edad) || edad < 0) errores.edadMeses = 'La edad debe ser un número de meses (0 o más)'
  return errores
}

export function hayErrores(errores: object): boolean {
  return Object.keys(errores).length > 0
}
