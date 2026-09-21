import type { Detalle } from '../../shared/api/types'

/** Ficha técnica del lote en modo lectura (HU-09: visible en la sala). */
export function FichaLoteCard({ subasta }: { subasta: Detalle }) {
  const f = subasta.ficha
  return (
    <div className="tarjeta">
      <h2>Lote</h2>
      {subasta.descripcion && <p>{subasta.descripcion}</p>}
      {f ? (
        <dl className="ficha">
          <dt>Identificación</dt>
          <dd>{f.identificacion}</dd>
          <dt>Raza</dt>
          <dd>{f.raza}</dd>
          <dt>Peso</dt>
          <dd>{f.pesoKg} kg</dd>
          <dt>Edad</dt>
          <dd>{f.edadMeses} meses</dd>
          {f.observaciones && (
            <>
              <dt>Observaciones</dt>
              <dd>{f.observaciones}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="vacio">El Subastador aún no registra la ficha del lote.</p>
      )}
    </div>
  )
}
