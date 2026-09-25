import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import { aValorDatetimeLocal } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { useAvisos } from '../../shared/ui/Avisos'
import { Campo } from '../../shared/ui/Campo'
import { Alerta } from '../../shared/ui/Estados'
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
      <div className="encabezado">
        <div className="encabezado__texto">
          <p className="sobretitulo">Paso 1 de 4 · Datos básicos</p>
          <h1>Crear subasta</h1>
        </div>
      </div>

      <div className="dos-columnas">
        <form className="tarjeta formulario" onSubmit={guardar} noValidate>
          <Campo etiqueta="Nombre de la subasta" error={errores.nombre}>
            <input
              type="text"
              value={nombre}
              maxLength={120}
              placeholder="Ej.: Geisha lavado · Finca La Esperanza"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Descripción (opcional)">
            <textarea
              value={descripcion}
              maxLength={1000}
              rows={4}
              placeholder="Cuenta la historia del lote: la finca, la cosecha, lo que lo hace especial."
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Fecha y hora de inicio" error={errores.fechaInicio}>
            <input
              type="datetime-local"
              value={fechaInicio}
              min={aValorDatetimeLocal(new Date())}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Campo>

          {errorGeneral && <Alerta>{errorGeneral}</Alerta>}
          <div className="acciones">
            <button type="button" className="boton boton--secundario" onClick={() => navegar(-1)}>
              Cancelar
            </button>
            <button type="submit" className="boton boton--primario" disabled={enviando}>
              <Check aria-hidden="true" />
              {enviando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>

        <aside className="tarjeta tarjeta--destacada">
          <h2>Cómo sale tu lote al aire</h2>
          <ol className="lista-pasos">
            <li>
              <strong>Crea la subasta</strong>
              <span>Nombre, descripción y cuándo empieza.</span>
            </li>
            <li>
              <strong>Registra la ficha del lote</strong>
              <span>Identificación, tipo de café, peso y observaciones.</span>
            </li>
            <li>
              <strong>Define las reglas</strong>
              <span>Duración, precio base e incremento mínimo en Orbes.</span>
            </li>
            <li>
              <strong>Transmite e inicia</strong>
              <span>Enciende tu cámara y abre las pujas.</span>
            </li>
          </ol>
        </aside>
      </div>
    </>
  )
}
