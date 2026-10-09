import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardList, Coins, Plus } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Ganancias, Resumen } from '../../shared/api/types'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'
import { EstadoVacio } from '../../shared/ui/Estados'
import { Monto } from '../../shared/ui/Orbe'
import { FondoHero } from '../../shared/ui/FondoHero'
import { etiquetaRol, formatFechaHora, tiempoHasta } from '../../shared/format'
import { EnVivo } from '../../shared/ui/EtiquetaEstado'

/** HU-03: home del Subastador con las acciones propias del rol. HU-24: lo que ha ganado con sus ventas. */
export function HomeSubastadorPage() {
  const { usuario } = useSesion()
  const [subastas, setSubastas] = useState<Resumen[]>([])
  useAvisoDeRuta()

  useEffect(() => {
    let vivo = true
    // Es un adorno útil: si no llega, la página funciona igual sin el bloque de la próxima subasta.
    api
      .misSubastas()
      .then((lista) => vivo && setSubastas(lista))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])

  if (!usuario) return null

  return (
    <>
      <section className="hero">
        <div className="hero__fondo" aria-hidden="true">
          <FondoHero />
        </div>
        <p className="sobretitulo">
          Hola, {usuario.nombre} · {etiquetaRol(usuario.rol)}
        </p>
        <h1 className="hero__titulo">
          Tu cosecha, <em>en vivo</em> ante los compradores
        </h1>
        <p className="subtitulo">¿Qué quieres hacer hoy?</p>
      </section>

      <ProximaSubasta subastas={subastas} />

      <div className="rejilla">
        <Link to={rutas.crearSubasta} className="tarjeta tarjeta--accion tarjeta--principal">
          <span className="tarjeta__icono">
            <Plus aria-hidden="true" />
          </span>
          <ArrowRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Crear subasta</span>
          <span className="tarjeta__texto">Define el lote, las reglas de puja y cuándo empieza.</span>
        </Link>
        <Link to={rutas.misSubastas} className="tarjeta tarjeta--accion">
          <span className="tarjeta__icono tarjeta__icono--hoja">
            <ClipboardList aria-hidden="true" />
          </span>
          <ArrowRight className="tarjeta__flecha" aria-hidden="true" />
          <span className="tarjeta__titulo">Mis subastas</span>
          <span className="tarjeta__texto">Configura, inicia y transmite las que ya creaste.</span>
        </Link>
      </div>

      <GananciasDelSubastador subastas={subastas} />
    </>
  )
}

/** Lo más urgente de un vistazo: la subasta que está en vivo o, si no hay, la próxima por empezar. */
function ProximaSubasta({ subastas }: { subastas: Resumen[] }) {
  const enVivo = subastas.find((s) => s.estado === 'EN_CURSO')
  const proxima = [...subastas]
    .filter((s) => s.estado === 'PROGRAMADA')
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .find((s) => tiempoHasta(s.fechaInicio) !== null)
  const subasta = enVivo ?? proxima
  if (!subasta) return null

  const faltan = enVivo ? null : tiempoHasta(subasta.fechaInicio)
  return (
    <section className={`proxima${enVivo ? ' proxima--en-vivo' : ''}`} aria-labelledby="titulo-proxima">
      <div className="proxima__texto">
        <h2 id="titulo-proxima" className="proxima__titulo">
          {enVivo ? <EnVivo /> : <CalendarClock aria-hidden="true" />}
          {enVivo ? 'Estás subastando ahora' : 'Tu próxima subasta'}
        </h2>
        <p className="proxima__nombre">{subasta.nombre}</p>
        <p className="proxima__meta">
          {enVivo ? `${subasta.cantidadPujas} pujas hasta ahora` : `${formatFechaHora(subasta.fechaInicio)}${faltan ? ` · empieza en ${faltan}` : ''}`}
        </p>
      </div>
      <Link to={enVivo ? rutas.sala(subasta.id) : rutas.gestionar(subasta.id)} className="boton boton--primario">
        {enVivo ? 'Ir a la sala' : 'Gestionar'}
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  )
}

/**
 * HU-24: Orbes que el Subastador recibió por sus subastas vendidas. Cada venta es el abono que wallet hace al
 * cobrarle al ganador; su referencia es el id de la subasta, y el nombre se toma de la lista de sus subastas.
 */
function GananciasDelSubastador({ subastas }: { subastas: Resumen[] }) {
  const [ganancias, setGanancias] = useState<Ganancias | null>(null)
  const [error, setError] = useState(false)
  // Los nombres son un adorno: si no llegan, cada venta se muestra igual, sin el nombre del lote.
  const nombres = Object.fromEntries(subastas.map((s) => [s.id, s.nombre]))

  useEffect(() => {
    let vivo = true
    api
      .ganancias()
      .then((g) => vivo && setGanancias(g))
      .catch(() => vivo && setError(true))
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
