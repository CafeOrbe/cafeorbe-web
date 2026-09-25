import { useState, type FormEvent } from 'react'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import type { Detalle } from '../../shared/api/types'
import { useAvisos } from '../../shared/ui/Avisos'
import { Campo } from '../../shared/ui/Campo'
import { Alerta } from '../../shared/ui/Estados'
import { Check, Timer, Lock } from 'lucide-react'
import { hayErrores, validarReglas, type Errores } from '../../shared/validators'

/** HU-10: duración, precio base e incremento mínimo. Solo valores numéricos positivos. */
export function ReglasForm({ subasta, alGuardar }: { subasta: Detalle; alGuardar: (d: Detalle) => void }) {
  const { mostrar } = useAvisos()
  const r = subasta.reglas
  const [duracion, setDuracion] = useState(r ? String(r.duracionMinutos) : '')
  const [precioBase, setPrecioBase] = useState(r ? String(r.precioBase) : '')
  const [incremento, setIncremento] = useState(r ? String(r.incrementoMinimo) : '')
  const [errores, setErrores] = useState<Errores<'duracionMinutos' | 'precioBase' | 'incrementoMinimo'>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const bloqueada = subasta.estado !== 'PROGRAMADA'

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setErrorGeneral(null)
    const encontrados = validarReglas({ duracionMinutos: duracion, precioBase, incrementoMinimo: incremento })
    setErrores(encontrados)
    if (hayErrores(encontrados)) return

    setEnviando(true)
    try {
      const actualizada = await api.guardarReglas(subasta.id, {
        duracionMinutos: Number(duracion),
        precioBase: Number(precioBase),
        incrementoMinimo: Number(incremento),
      })
      alGuardar(actualizada)
      mostrar('Reglas de puja guardadas', 'exito')
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.campos).length > 0) setErrores(e.campos)
      else setErrorGeneral(e instanceof Error ? e.message : 'No se pudieron guardar las reglas')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar} noValidate>
      <div className="formulario__cabecera">
        <span className="tarjeta__icono" aria-hidden="true">
          <Timer />
        </span>
        <div>
          <h2>Tiempo y reglas de puja</h2>
          <p>Cuánto dura la subasta, desde cuánto arranca y cuánto sube cada puja, en Orbes.</p>
        </div>
      </div>
      {bloqueada && <p className="aviso-fijo"><Lock aria-hidden="true" />Las reglas no se pueden cambiar con la subasta iniciada</p>}
      <fieldset disabled={bloqueada || enviando} className="sin-borde">
        <div className="formulario__triple">
          <Campo etiqueta="Duración (minutos)" error={errores.duracionMinutos}>
            <input type="number" inputMode="numeric" min="1" step="1" value={duracion} onChange={(e) => setDuracion(e.target.value)} />
          </Campo>
          <Campo etiqueta="Precio base (Orbes)" error={errores.precioBase}>
            <input type="number" inputMode="numeric" min="1" step="1" value={precioBase} onChange={(e) => setPrecioBase(e.target.value)} />
          </Campo>
          <Campo etiqueta="Incremento mínimo (Orbes)" error={errores.incrementoMinimo}>
            <input type="number" inputMode="numeric" min="1" step="1" value={incremento} onChange={(e) => setIncremento(e.target.value)} />
          </Campo>
        </div>
        {errorGeneral && <Alerta>{errorGeneral}</Alerta>}
        <div className="acciones">
          <button type="submit" className="boton boton--primario">
            <Check aria-hidden="true" />
            {enviando ? 'Guardando…' : 'Guardar reglas'}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
