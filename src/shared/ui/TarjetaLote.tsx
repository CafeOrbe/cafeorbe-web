import type { ReactNode } from 'react'
import { CalendarClock, Gavel, User } from 'lucide-react'
import type { Resumen } from '../api/types'
import { formatFechaHora } from '../format'
import { EnVivo, EtiquetaEstado } from './EtiquetaEstado'
import { Monto } from './Orbe'
import { PortadaLote } from './PortadaLote'

/** Tarjeta de una subasta en los listados: portada grande, estado, precio y acciones. */
export function TarjetaLote({ subasta, mostrarSubastador = true, children }: { subasta: Resumen; mostrarSubastador?: boolean; children: ReactNode }) {
  const enVivo = subasta.estado === 'EN_CURSO'
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
                <span className="lote__precio-etiqueta">{enVivo ? 'Precio actual' : 'Desde'}</span>
                <Monto cantidad={subasta.precioActual} grande />
              </>
            ) : (
              <span className="lote__precio-etiqueta">Sin precio aún</span>
            )}
          </div>
          <div className="lote__acciones">{children}</div>
        </div>
      </div>
    </li>
  )
}
