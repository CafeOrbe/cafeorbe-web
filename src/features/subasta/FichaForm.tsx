import { useState, type FormEvent } from 'react'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import type { Detalle } from '../../shared/api/types'
import { useAvisos } from '../../shared/ui/Avisos'
import { Campo } from '../../shared/ui/Campo'
import { hayErrores, validarFicha, type Errores } from '../../shared/validators'

/** HU-09: ficha técnica del lote. Se puede editar solo mientras la subasta está Programada. */
export function FichaForm({ subasta, alGuardar }: { subasta: Detalle; alGuardar: (d: Detalle) => void }) {
  const { mostrar } = useAvisos()
  const f = subasta.ficha
  const [identificacion, setIdentificacion] = useState(f?.identificacion ?? '')
  const [tipoCafe, setTipoCafe] = useState(f?.tipoCafe ?? '')
  const [pesoKg, setPesoKg] = useState(f ? String(f.pesoKg) : '')
  const [edadMeses, setEdadMeses] = useState(f ? String(f.edadMeses) : '')
  const [observaciones, setObservaciones] = useState(f?.observaciones ?? '')
  const [errores, setErrores] = useState<Errores<'identificacion' | 'tipoCafe' | 'pesoKg' | 'edadMeses'>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const bloqueada = subasta.estado !== 'PROGRAMADA'

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setErrorGeneral(null)
    const encontrados = validarFicha({ identificacion, tipoCafe, pesoKg, edadMeses })
    setErrores(encontrados)
    if (hayErrores(encontrados)) return

    setEnviando(true)
    try {
      const actualizada = await api.guardarFicha(subasta.id, {
        identificacion: identificacion.trim(),
        tipoCafe: tipoCafe.trim(),
        pesoKg: Number(pesoKg),
        edadMeses: Number(edadMeses),
        observaciones: observaciones.trim(),
      })
      alGuardar(actualizada)
      mostrar('Ficha del lote guardada', 'exito')
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.campos).length > 0) setErrores(e.campos)
      else setErrorGeneral(e instanceof Error ? e.message : 'No se pudo guardar la ficha')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar} noValidate>
      <h2>Ficha técnica del lote</h2>
      {bloqueada && <p className="aviso-fijo">La ficha no se puede editar con la subasta iniciada</p>}
      <fieldset disabled={bloqueada || enviando} className="sin-borde">
        <div className="formulario__doble">
          <Campo etiqueta="Identificación" error={errores.identificacion}>
            <input type="text" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} />
          </Campo>
          <Campo etiqueta="Tipo de café" error={errores.tipoCafe}>
            <input type="text" value={tipoCafe} onChange={(e) => setTipoCafe(e.target.value)} />
          </Campo>
          <Campo etiqueta="Peso (kg)" error={errores.pesoKg}>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
          </Campo>
          <Campo etiqueta="Edad (meses)" error={errores.edadMeses}>
            <input type="number" inputMode="numeric" min="0" step="1" value={edadMeses} onChange={(e) => setEdadMeses(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Observaciones (opcional)">
          <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Campo>
        {errorGeneral && (
          <p className="campo__error" role="alert">
            {errorGeneral}
          </p>
        )}
        <div className="acciones">
          <button type="submit" className="boton boton--primario">
            {enviando ? 'Guardando…' : 'Guardar ficha'}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
