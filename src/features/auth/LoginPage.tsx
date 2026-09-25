import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Coins, Gavel, HandCoins, Radio, type LucideIcon } from 'lucide-react'
import type { Rol } from '../../shared/api/types'
import { rutaInicio } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { Campo } from '../../shared/ui/Campo'
import { Alerta } from '../../shared/ui/Estados'
import { Marca } from '../../shared/ui/Marca'
import { PortadaLote } from '../../shared/ui/PortadaLote'
import { validarNombre } from '../../shared/validators'

const ROLES: { valor: Rol; titulo: string; descripcion: string; icono: LucideIcon }[] = [
  { valor: 'COMPRADOR', titulo: 'Comprador', descripcion: 'Entra a las subastas y puja con tus Orbes.', icono: HandCoins },
  { valor: 'SUBASTADOR', titulo: 'Subastador', descripcion: 'Crea, transmite y dirige tus subastas.', icono: Radio },
]

/** HU-01: acceso con nombre y rol. */
export function LoginPage() {
  const { usuario, iniciarSesion } = useSesion()
  const navegar = useNavigate()
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol | null>(null)
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={rutaInicio(usuario.rol)} replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const error = validarNombre(nombre)
    setErrorNombre(error)
    setErrorServidor(null)
    if (error || !rol) return

    setEnviando(true)
    try {
      const u = await iniciarSesion(nombre.trim(), rol)
      navegar(rutaInicio(u.rol), { replace: true })
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <aside className="acceso__escena">
        <PortadaLote semilla="cafeorbe-acceso" />
        <Marca grande />
        <div>
          <p className="acceso__titular">
            Café de origen, <em>puja en vivo.</em>
          </p>
          <p className="acceso__bajada">
            Lotes del Eje Cafetero subastados en directo: mira la transmisión, sigue cada puja y gana con tus Orbes.
          </p>
          <ul className="acceso__rasgos">
            <li>
              <Radio aria-hidden="true" />
              Transmisión en vivo
            </li>
            <li>
              <Gavel aria-hidden="true" />
              Puja abierta
            </li>
            <li>
              <Coins aria-hidden="true" />
              Orbes de bienvenida
            </li>
          </ul>
        </div>
      </aside>

      <main className="acceso__panel">
        <form className="acceso__tarjeta" onSubmit={enviar} noValidate>
          <div className="acceso__marca-movil">
            <Marca />
          </div>
          <div className="acceso__encabezado">
            <h1>Entra a la subasta</h1>
            <p className="acceso__lema">Subastas en vivo con Orbes</p>
          </div>

          <Campo etiqueta="Tu nombre" error={errorNombre}>
            <input
              type="text"
              value={nombre}
              maxLength={50}
              autoComplete="nickname"
              placeholder="¿Cómo te verán en la sala?"
              autoFocus
              onChange={(e) => {
                setNombre(e.target.value)
                if (errorNombre) setErrorNombre(null)
              }}
            />
          </Campo>

          <fieldset className="roles">
            <legend className="campo__etiqueta">¿Con qué rol vas a participar?</legend>
            {ROLES.map((r) => {
              const Icono = r.icono
              return (
                <label key={r.valor} className={`rol${rol === r.valor ? ' rol--activo' : ''}`}>
                  <input type="radio" name="rol" value={r.valor} checked={rol === r.valor} onChange={() => setRol(r.valor)} />
                  <span className="rol__icono" aria-hidden="true">
                    <Icono />
                  </span>
                  <span className="rol__textos">
                    <span className="rol__titulo">{r.titulo}</span>
                    <span className="rol__descripcion">{r.descripcion}</span>
                  </span>
                  <span className="rol__check" aria-hidden="true">
                    <Check strokeWidth={3} />
                  </span>
                </label>
              )
            })}
          </fieldset>

          {errorServidor && <Alerta>{errorServidor}</Alerta>}

          <button type="submit" className="boton boton--primario boton--grande boton--ancho" disabled={!rol || enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
            {!enviando && <ArrowRight aria-hidden="true" />}
          </button>
          {!rol && <p className="campo__ayuda">Selecciona un rol para continuar.</p>}
        </form>
      </main>
    </div>
  )
}
