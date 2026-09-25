import { Coffee, FileClock, Hourglass, Scale, Tag } from 'lucide-react'
import type { Detalle } from '../../shared/api/types'
import { EstadoVacio } from '../../shared/ui/Estados'
import { PortadaLote } from '../../shared/ui/PortadaLote'

/** Ficha técnica del lote en modo lectura (HU-09: visible en la sala). */
export function FichaLoteCard({ subasta }: { subasta: Detalle }) {
  const f = subasta.ficha
  return (
    <section className="tarjeta ficha-lote" aria-labelledby="titulo-lote">
      <div className="ficha-lote__portada">
        <PortadaLote semilla={subasta.id} />
        <div className="ficha-lote__rotulo">
          <span className="sobretitulo">Ficha del lote</span>
          <h2 id="titulo-lote">{f ? f.tipoCafe : 'Lote'}</h2>
        </div>
      </div>

      <div className="ficha-lote__cuerpo">
        {subasta.descripcion && <p className="ficha-lote__descripcion">{subasta.descripcion}</p>}
        {f ? (
          <>
            <dl className="ficha">
              <div className="ficha__dato">
                <dt>
                  <Tag aria-hidden="true" />
                  Identificación
                </dt>
                <dd>{f.identificacion}</dd>
              </div>
              <div className="ficha__dato">
                <dt>
                  <Coffee aria-hidden="true" />
                  Tipo de café
                </dt>
                <dd>{f.tipoCafe}</dd>
              </div>
              <div className="ficha__dato">
                <dt>
                  <Scale aria-hidden="true" />
                  Peso
                </dt>
                <dd>{f.pesoKg} kg</dd>
              </div>
              <div className="ficha__dato">
                <dt>
                  <Hourglass aria-hidden="true" />
                  Edad
                </dt>
                <dd>{f.edadMeses} meses</dd>
              </div>
            </dl>
            {f.observaciones && (
              <blockquote className="ficha__nota">
                <cite>Observaciones</cite>
                {f.observaciones}
              </blockquote>
            )}
          </>
        ) : (
          <EstadoVacio compacto icono={FileClock} titulo="El Subastador aún no registra la ficha del lote." />
        )}
      </div>
    </section>
  )
}
