import type { ReactNode } from 'react'
import { CalendarClock, Gavel, User } from 'lucide-react'
import type { EstadoSubasta, Resumen } from '../api/types'
import { formatFechaHora, tiempoHasta } from '../format'
import { EnVivo, EtiquetaEstado } from './EtiquetaEstado'
import { Monto } from './Orbe'
import { PortadaLote } from './PortadaLote'

/** Qué significa el precio de la tarjeta según el estado: una subasta cerrada ya no parte "desde" un precio. */
const ETIQUETA_DEL_PRECIO: Record<EstadoSubasta, string> = {
  PROGRAMADA: 'Desde',
  EN_CURSO: 'Precio actual',
  FINALIZADA: 'Monto final',
  DESIERTA: 'Precio base',
}

/** Tarjeta de una subasta en los listados: portada grande, estado, precio y acciones. */
export function TarjetaLote({ subasta, mostrarSubastador = true, children }: { subasta: Resumen; mostrarSubastador?: boolean; children: ReactNode }) {
  const enVivo = subasta.estado === 'EN_CURSO'
  const programada = subasta.estado === 'PROGRAMADA'
  const faltan = programada ? tiempoHasta(subasta.fechaInicio) : null
  // Sigue "Programada" porque el Subastador aún no la inicia, aunque su fecha ya pasó.
  const pendiente = programada && faltan === null
  return (
    <li className={`lote${enVivo ? ' lote--en-vivo' : ''}`}>
      <div className="lote__portada">
        <PortadaLote semilla={subasta.id} />
        <div className="lote__insignias">
          {enVivo ? <EnVivo /> : <EtiquetaEstado estado={subasta.estado} />}
          {subasta.cantidadPujas > 0 && (
            <span className="etiqueta etiqueta--solida tabular">
              <Gavel size={13} aria-hidden="true" />
              {subasta.cantidadPujas} pujas
            </span>
          )}
        </div>
      </div>
      <div className="lote__cuerpo">
        <h3 className="tarjeta__titulo">{subasta.nombre}</h3>
        <p className="lote__meta">
          <span>
            <CalendarClock aria-hidden="true" />
            {formatFechaHora(subasta.fechaInicio)}
          </span>
          {faltan && <span className="lote__cuenta">Empieza en {faltan}</span>}
          {pendiente && <span className="lote__alerta">Pendiente de iniciar</span>}
          {mostrarSubastador && (
            <span>
              <User aria-hidden="true" />
              por {subasta.subastadorNombre}
            </span>
          )}
        </p>
        <div className="lote__pie">
          <div className="lote__precio">
            {subasta.precioActual !== null ? (
              <>
                <span className="lote__precio-etiqueta">{ETIQUETA_DEL_PRECIO[subasta.estado]}</span>
                <Monto cantidad={subasta.precioActual} grande />
              </>
            ) : (
              <span className="lote__precio-etiqueta">Precio base: por definir</span>
            )}
          </div>
          <div className="lote__acciones">{children}</div>
        </div>
      </div>
    </li>
  )
}
