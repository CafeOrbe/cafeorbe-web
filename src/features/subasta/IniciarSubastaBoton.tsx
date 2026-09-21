import { useState } from 'react'
import { api } from '../../shared/api/endpoints'
import type { Detalle } from '../../shared/api/types'
import { useAvisos } from '../../shared/ui/Avisos'

export const MSG_FALTA_CONFIGURACION = 'Configura primero el tiempo y las reglas de puja'

/** HU-12: inicia la subasta. Se deshabilita y explica el motivo si falta configuración. */
export function IniciarSubastaBoton({ subasta, alIniciar }: { subasta: Detalle; alIniciar: (d: Detalle) => void }) {
  const { mostrar } = useAvisos()
  const [enviando, setEnviando] = useState(false)
  const sinConfiguracion = subasta.reglas === null

  if (subasta.estado !== 'PROGRAMADA') return null

  async function iniciar() {
    setEnviando(true)
    try {
      alIniciar(await api.iniciarSubasta(subasta.id))
      mostrar('La subasta está en curso: ya se puede pujar', 'exito')
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo iniciar la subasta', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="iniciar">
      <button type="button" className="boton boton--primario boton--grande" disabled={sinConfiguracion || enviando} onClick={iniciar}>
        {enviando ? 'Iniciando…' : 'Iniciar subasta'}
      </button>
      {sinConfiguracion && <p className="campo__ayuda">{MSG_FALTA_CONFIGURACION}</p>}
    </div>
  )
}
