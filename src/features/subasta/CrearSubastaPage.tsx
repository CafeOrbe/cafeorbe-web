import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import { aValorDatetimeLocal } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { useAvisos } from '../../shared/ui/Avisos'
import { Campo } from '../../shared/ui/Campo'
import { hayErrores, validarCrearSubasta, type Errores } from '../../shared/validators'

/** HU-08: crear una subasta con sus datos básicos. Queda Programada. */
export function CrearSubastaPage() {
  const navegar = useNavigate()
  const { mostrar } = useAvisos()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [errores, setErrores] = useState<Errores<'nombre' | 'fechaInicio'>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setErrorGeneral(null)
    const encontrados = validarCrearSubasta({ nombre, fechaInicio })
    setErrores(encontrados)
    if (hayErrores(encontrados)) return

    setEnviando(true)
    try {
      const creada = await api.crearSubasta({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        fechaInicio: new Date(fechaInicio).toISOString(),
      })
      mostrar('Subasta creada. Ahora registra la ficha del lote y las reglas de puja.', 'exito')
      navegar(rutas.gestionar(creada.id), { replace: true })
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.campos).length > 0) setErrores(e.campos)
      else setErrorGeneral(e instanceof Error ? e.message : 'No se pudo crear la subasta')
      setEnviando(false)
    }
  }

  return (
    <>
      <h1>Crear subasta</h1>
      <form className="tarjeta formulario" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre de la subasta" error={errores.nombre}>
          <input type="text" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Descripción (opcional)">
          <textarea value={descripcion} maxLength={1000} rows={3} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha y hora de inicio" error={errores.fechaInicio}>
          <input
            type="datetime-local"
            value={fechaInicio}
            min={aValorDatetimeLocal(new Date())}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </Campo>

        {errorGeneral && (
          <p className="campo__error" role="alert">
            {errorGeneral}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--secundario" onClick={() => navegar(-1)}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </>
  )
}
