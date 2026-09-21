import { useEffect, useState } from 'react'
import type { Detalle } from '../../shared/api/types'
import { formatOrbes } from '../../shared/format'
import { refrescarSaldo } from '../../shared/ui/SaldoOrbes'

export const MSG_LIDER = 'Vas ganando'
export const MSG_SIN_PUJAS = 'Sin pujas'

interface Props {
  subasta: Detalle
  usuarioId: string
  conectado: boolean
  aviso: string | null
  onPujar: (monto: number) => boolean
  onLimpiarAviso: () => void
}

/** HU-13 y HU-16: precio actual, líder y botón de puja rápida (precio actual + incremento mínimo). */
export function PanelPuja({ subasta, usuarioId, conectado, aviso, onPujar, onLimpiarAviso }: Props) {
  const [enviando, setEnviando] = useState(false)
  const enCurso = subasta.estado === 'EN_CURSO'
  const soyLider = subasta.lider?.id === usuarioId
  const monto = subasta.siguienteMinimo

  // Un rechazo o una puja aceptada cambian la pantalla: se libera el botón.
  useEffect(() => {
    setEnviando(false)
  }, [aviso, subasta.cantidadPujas])

  // Seguridad: si la respuesta nunca llega, el botón no se queda bloqueado.
  useEffect(() => {
    if (!enviando) return
    const t = window.setTimeout(() => setEnviando(false), 4000)
    return () => window.clearTimeout(t)
  }, [enviando])

  function pujar() {
    if (monto === null) return
    onLimpiarAviso()
    setEnviando(true)
    if (!onPujar(monto)) setEnviando(false)
    refrescarSaldo()
  }

  let etiquetaBoton: string
  let deshabilitado = false
  if (!enCurso) {
    etiquetaBoton = subasta.estado === 'PROGRAMADA' ? 'La subasta aún no inicia' : 'Subasta cerrada'
    deshabilitado = true
  } else if (soyLider) {
    etiquetaBoton = MSG_LIDER
    deshabilitado = true
  } else {
    etiquetaBoton = `Pujar ${monto}`
    deshabilitado = !conectado || enviando || monto === null
  }

  return (
    <div className="tarjeta panel-puja">
      <p className="panel-puja__etiqueta">Precio actual</p>
      <p className="precio">{subasta.precioActual !== null ? formatOrbes(subasta.precioActual) : '—'}</p>

      <p className={`lider${soyLider ? ' lider--yo' : ''}`}>
        {subasta.lider ? (soyLider ? `Vas ganando, ${subasta.lider.nombre}` : `Lidera ${subasta.lider.nombre}`) : MSG_SIN_PUJAS}
      </p>

      <button type="button" className="boton boton--puja" disabled={deshabilitado} onClick={pujar}>
        {etiquetaBoton}
      </button>
      {!conectado && enCurso && <p className="campo__ayuda">Reconectando con la sala…</p>}
      {aviso && (
        <p className="campo__error" role="alert">
          {aviso}
        </p>
      )}
      {subasta.reglas && (
        <p className="campo__ayuda">
          Incremento mínimo: {formatOrbes(subasta.reglas.incrementoMinimo)} · Precio base: {formatOrbes(subasta.reglas.precioBase)}
        </p>
      )}
    </div>
  )
}
