import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Coffee } from 'lucide-react'
import { api } from '../../shared/api/endpoints'
import type { Resumen } from '../../shared/api/types'
import { formatOrbes } from '../../shared/format'
import { rutas } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { useAvisos } from '../../shared/ui/Avisos'
import { EnVivo } from '../../shared/ui/EtiquetaEstado'
import { CargandoLotes, EstadoError, EstadoVacio } from '../../shared/ui/Estados'
import { PortadaLote } from '../../shared/ui/PortadaLote'
import { TarjetaLote } from '../../shared/ui/TarjetaLote'
import { useAvisoDeRuta } from '../../shared/ui/useAvisoDeRuta'

/** HU-04: subastas disponibles. HU-07: aviso de la carga automática de Orbes en el primer ingreso. */
export function HomeCompradorPage() {
  const { usuario, bienvenidaPendiente, bienvenidaMostrada } = useSesion()
  const { mostrar } = useAvisos()
  const [subastas, setSubastas] = useState<Resumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useAvisoDeRuta()

  useEffect(() => {
    let vivo = true
    api
      .subastasDisponibles(['PROGRAMADA', 'EN_CURSO'])
      .then((lista) => vivo && setSubastas(lista))
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [])

  // La carga la hace wallet al recibir el evento, así que el saldo puede tardar un instante en aparecer.
  useEffect(() => {
    if (!bienvenidaPendiente) return
    let vivo = true
    ;(async () => {
      for (let intento = 0; intento < 8 && vivo; intento++) {
        const { saldo } = await api.saldo().catch(() => ({ saldo: 0 }))
        if (saldo > 0) {
          if (vivo) {
            mostrar(`¡Bienvenido! Recibiste ${formatOrbes(saldo)} para pujar.`, 'exito')
            bienvenidaMostrada()
          }
          return
        }
        await new Promise((r) => setTimeout(r, 750))
      }
    })()
    return () => {
      vivo = false
    }
  }, [bienvenidaPendiente, bienvenidaMostrada, mostrar])

  if (!usuario) return null

  const enVivo = subastas?.filter((s) => s.estado === 'EN_CURSO') ?? []
  const proximas = subastas?.filter((s) => s.estado !== 'EN_CURSO') ?? []

  return (
    <>
      <section className="hero">
        <div className="hero__fondo" aria-hidden="true">
          <PortadaLote semilla={`hero-${usuario.id}`} />
        </div>
        <p className="sobretitulo">Hola, {usuario.nombre}</p>
        <h1 className="hero__titulo">
          Café de origen, <em>puja en vivo</em>
        </h1>
        <p className="subtitulo">Estas son las subastas disponibles.</p>
      </section>

      {error && <EstadoError titulo="No pudimos cargar las subastas" mensaje={error} />}
      {!error && subastas === null && <CargandoLotes texto="Cargando subastas…" />}
      {subastas?.length === 0 && (
        <EstadoVacio
          icono={Coffee}
          titulo="No hay subastas disponibles por ahora"
          texto="Los caficultores programan nuevos lotes con frecuencia. Vuelve pronto para no perderte la próxima."
        />
      )}

      {enVivo.length > 0 && (
        <section className="seccion" aria-labelledby="titulo-en-vivo">
          <h2 id="titulo-en-vivo" className="seccion__titulo">
            <EnVivo />
            Subastando ahora
            <span className="seccion__cuenta">{enVivo.length}</span>
          </h2>
          <ul className="rejilla-lotes">
            {enVivo.map((s) => (
              <TarjetaLote key={s.id} subasta={s}>
                <Link to={rutas.sala(s.id)} className="boton boton--primario">
                  Entrar
                  <ArrowRight aria-hidden="true" />
                </Link>
              </TarjetaLote>
            ))}
          </ul>
        </section>
      )}

      {proximas.length > 0 && (
        <section className="seccion" aria-labelledby="titulo-proximas">
          <h2 id="titulo-proximas" className="seccion__titulo">
            <CalendarClock aria-hidden="true" />
            Próximas subastas
            <span className="seccion__cuenta">{proximas.length}</span>
          </h2>
          <ul className="rejilla-lotes">
            {proximas.map((s) => (
              <TarjetaLote key={s.id} subasta={s}>
                <Link to={rutas.sala(s.id)} className="boton boton--secundario">
                  Entrar
                  <ArrowRight aria-hidden="true" />
                </Link>
              </TarjetaLote>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
