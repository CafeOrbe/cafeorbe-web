import { useEffect, useState } from 'react'
import type { Detalle } from '../../shared/api/types'
import { formatOrbes } from '../../shared/format'
import { IconoOrbe } from '../../shared/ui/Orbe'
import { refrescarSaldo, useSaldoConocido } from '../../shared/ui/SaldoOrbes'
import { CircleAlert, Clock, Crown, Gavel, Trophy, WifiOff } from 'lucide-react'
import { estadoDelBoton } from './botonPuja'

export const MSG_SIN_PUJAS = 'Sin pujas'

/**
 * true cuando ya pasó la hora de fin según el reloj del servidor. El cierre (HU-19) llega un instante después
 * como evento; mientras tanto el servidor ya rechaza las pujas tardías, y esto evita ofrecer el botón.
 */
function useTiempoAgotado(horaFin: string | null, desfaseMs: number): boolean {
  const fin = horaFin ? Date.parse(horaFin) - desfaseMs : NaN
  const [agotado, setAgotado] = useState(() => Number.isFinite(fin) && Date.now() >= fin)

  useEffect(() => {
    if (!Number.isFinite(fin)) {
      setAgotado(false)
      return
    }
    const restante = fin - Date.now()
    setAgotado(restante <= 0)
    if (restante <= 0) return
    // setTimeout admite como máximo ~24,8 días; una subasta dura minutos.
    const t = window.setTimeout(() => setAgotado(true), Math.min(restante, 2 ** 31 - 1))
    return () => window.clearTimeout(t)
  }, [fin])

  return agotado
}

interface Props {
  subasta: Detalle
  usuarioId: string
  conectado: boolean
  aviso: string | null
  /** Reloj del servidor menos reloj del navegador, en ms. */
  desfaseMs: number
  onPujar: (monto: number) => boolean
  onLimpiarAviso: () => void
}

/** HU-13 y HU-16: precio actual, líder y botón de puja rápida (precio actual + incremento mínimo). */
export function PanelPuja({ subasta, usuarioId, conectado, aviso, desfaseMs, onPujar, onLimpiarAviso }: Props) {
  const [enviando, setEnviando] = useState(false)
  const enCurso = subasta.estado === 'EN_CURSO'
  const soyLider = subasta.lider?.id === usuarioId
  const monto = subasta.siguienteMinimo
  const tiempoAgotado = useTiempoAgotado(subasta.horaFin, desfaseMs)
  const saldo = useSaldoConocido()

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

  const { etiqueta: etiquetaBoton, deshabilitado, puedePujar } = estadoDelBoton({
    estado: subasta.estado,
    soyLider,
    tiempoAgotado,
    saldo,
    monto,
    conectado,
    enviando,
  })

  return (
    <section className={`panel-puja${soyLider ? ' panel-puja--lider' : ''}`} aria-label="Panel de puja">
      <div className="panel-puja__cuerpo">
        <div className="panel-puja__precio" aria-live="polite">
          <p className="panel-puja__etiqueta">Precio actual</p>
          <p className="precio">
            {subasta.precioActual !== null ? (
              <>
                <IconoOrbe />
                <span className="precio__valor" key={subasta.precioActual}>
                  {subasta.precioActual}
                </span>
                <span className="solo-lectores"> Orbes</span>
              </>
            ) : (
              '—'
            )}
          </p>
          <p className={`lider${soyLider ? ' lider--yo' : ''}`}>
            {soyLider ? <Trophy aria-hidden="true" /> : subasta.lider && <Crown aria-hidden="true" />}
            {subasta.lider ? (soyLider ? `Vas ganando, ${subasta.lider.nombre}` : `Lidera ${subasta.lider.nombre}`) : MSG_SIN_PUJAS}
          </p>
        </div>

        <button
          type="button"
          className={`boton boton--puja${soyLider ? ' boton--lider' : ''}`}
          disabled={deshabilitado}
          onClick={pujar}
        >
          {soyLider ? <Trophy aria-hidden="true" /> : puedePujar ? <Gavel aria-hidden="true" /> : <Clock aria-hidden="true" />}
          {puedePujar ? (
            <span>
              Pujar <span className="boton__monto">{monto}</span>
            </span>
          ) : (
            etiquetaBoton
          )}
        </button>
      </div>

      {!conectado && enCurso && (
        <p className="panel-puja__nota" role="status">
          <WifiOff aria-hidden="true" />
          Reconectando con la sala…
        </p>
      )}
      {aviso && (
        <p className="panel-puja__error" role="alert">
          <CircleAlert aria-hidden="true" />
          {aviso}
        </p>
      )}
      {subasta.reglas && (
        <dl className="reglas">
          <div>
            <dt>Incremento mínimo</dt>
            <dd>{formatOrbes(subasta.reglas.incrementoMinimo)}</dd>
          </div>
          <div>
            <dt>Precio base</dt>
            <dd>{formatOrbes(subasta.reglas.precioBase)}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
