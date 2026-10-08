import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ClipboardList, Coins, Plus } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Ganancias } from '../../shared/api/types'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'
import { EstadoVacio } from '../../shared/ui/Estados'
import { Monto } from '../../shared/ui/Orbe'
import { PortadaLote } from '../../shared/ui/PortadaLote'
import { etiquetaRol, formatFechaHora } from '../../shared/format'

/** HU-03: home del Subastador con las acciones propias del rol. HU-24: lo que ha ganado con sus ventas. */
export function HomeSubastadorPage() {
  const { usuario } = useSesion()
  useAvisoDeRuta()
  if (!usuario) return null

  return (
    <>
      <section className="hero">
        <div className="hero__fondo" aria-hidden="true">
          <PortadaLote semilla={`hero-${usuario.id}`} />
        </div>
        <p className="sobretitulo">
          Hola, {usuario.nombre} · {etiquetaRol(usuario.rol)}
        </p>
        <h1 className="hero__titulo">
          Tu cosecha, <em>en vivo</em> ante los compradores
        </h1>
        <p className="subtitulo">¿Qué quieres hacer hoy?</p>
      </section>

      <div className="rejilla">
        <Link to={rutas.crearSubasta} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono">
            <Plus aria-hidden="true" />
          </span>
          <ArrowUpRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Crear subasta</span>
          <span className="tarjeta__texto">Define el lote, las reglas de puja y cuándo empieza.</span>
        </Link>
        <Link to={rutas.misSubastas} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono tarjeta__icono--hoja">
            <ClipboardList aria-hidden="true" />
          </span>
          <ArrowUpRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Mis subastas</span>
          <span className="tarjeta__texto">Configura, inicia y transmite las que ya creaste.</span>
        </Link>
      </div>

      <GananciasDelSubastador />
    </>
  )
}

/**
 * HU-24: Orbes que el Subastador recibió por sus subastas vendidas. Cada venta es el abono que wallet hace al
 * cobrarle al ganador; su referencia es el id de la subasta, y el nombre se toma de la lista de sus subastas.
 */
function GananciasDelSubastador() {
  const [ganancias, setGanancias] = useState<Ganancias | null>(null)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    api
      .ganancias()
      .then((g) => vivo && setGanancias(g))
      .catch(() => vivo && setError(true))
    // Los nombres son un adorno: si no llegan, cada venta se muestra igual, sin el nombre del lote.
    api
      .misSubastas()
      .then((lista) => vivo && setNombres(Object.fromEntries(lista.map((s) => [s.id, s.nombre]))))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])

  if (error) return null

  return (
    <section className="seccion" aria-labelledby="titulo-ganancias">
      <h2 id="titulo-ganancias" className="seccion__titulo">
        <Coins aria-hidden="true" />
        Tus ganancias
      </h2>
      <div className="tarjeta">
        <dl className="cifras">
          <div>
            <dt>Orbes ganados</dt>
            <dd className="monto">{ganancias ? <Monto cantidad={ganancias.total} grande /> : '—'}</dd>
          </div>
          <div>
            <dt>Lotes vendidos</dt>
            <dd>{ganancias ? ganancias.ventas.length : '—'}</dd>
          </div>
        </dl>
        {ganancias?.ventas.length === 0 && (
          <EstadoVacio
            compacto
            icono={Coins}
            titulo="Aún no has vendido ningún lote."
            texto="Cuando una de tus subastas cierre con ganador, sus Orbes aparecerán aquí."
          />
        )}
        {ganancias && ganancias.ventas.length > 0 && (
          <ol className="pujas">
            {ganancias.ventas.map((venta) => (
              <li key={venta.id} className="puja">
                <span className="puja__quien">
                  <Link to={rutas.resultados(venta.referencia)} className="puja__nombre">
                    {nombres[venta.referencia] ?? 'Subasta vendida'}
                  </Link>
                  <time className="puja__hora" dateTime={venta.fecha}>
                    {formatFechaHora(venta.fecha)}
                  </time>
                </span>
                <span className="puja__monto">
                  <Monto cantidad={venta.monto} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
