import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Coins, Gavel, HandCoins, Radio, type LucideIcon } from 'lucide-react'
import type { Rol } from '../../shared/api/types'
import { rutaInicio } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { Alerta } from '../../shared/ui/Estados'
import { Lema, Marca } from '../../shared/ui/Marca'
import { FondoCafetal } from '../../shared/ui/FondoCafetal'
import { BotonGoogle } from './BotonGoogle'

const ROLES: { valor: Rol; titulo: string; descripcion: string; icono: LucideIcon }[] = [
  { valor: 'COMPRADOR', titulo: 'Comprador', descripcion: 'Participa en subastas y realiza tus pujas', icono: HandCoins },
  { valor: 'SUBASTADOR', titulo: 'Subastador', descripcion: 'Crea, transmite y administra tus subastas', icono: Radio },
]

/**
 * HU-01 y SEG-01: el único acceso es con una cuenta de Google (proveedor de identidad externo). No hay usuario y
 * contraseña propios ni acceso por nombre: la persona elige el rol y Google comprueba quién es.
 */
export function LoginPage() {
  const { usuario, iniciarSesionConGoogle } = useSesion()
  const navegar = useNavigate()
  const [rol, setRol] = useState<Rol | null>(null)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={rutaInicio(usuario.rol)} replace />

  async function entrarConGoogle(idToken: string): Promise<void> {
    if (!rol) return
    setErrorServidor(null)
    setEnviando(true)
    try {
      const u = await iniciarSesionConGoogle(idToken, rol)
      void navegar(rutaInicio(u.rol), { replace: true })
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Google')
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <FondoCafetal />
      <aside className="acceso__escena">
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
              <span className="acceso__rasgo-texto">
                <span>Orbes de bienvenida</span>
                <small>Recibe Orbes para realizar tus primeras pujas</small>
              </span>
            </li>
          </ul>
          <Lema className="lema acceso__lema-marca" />
        </div>
      </aside>

      <main className="acceso__panel">
        <div className="acceso__tarjeta">
          <div className="acceso__marca-movil">
            <Marca />
          </div>
          <div className="acceso__encabezado">
            <h1>Entra a la subasta</h1>
            <p className="acceso__lema">Participa en vivo y puja por cafés de origen</p>
          </div>

          <fieldset className="roles">
            <legend className="campo__etiqueta">¿Cómo quieres participar?</legend>
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

          {rol && (
            <div className="acceso__google-bloque">
              <p className="campo__etiqueta">Ingresa con tu cuenta de Google</p>
              {enviando ? (
                <p className="campo__ayuda">Entrando…</p>
              ) : (
                <BotonGoogle alObtenerCredencial={(t) => void entrarConGoogle(t)} alFallar={setErrorServidor} />
              )}
            </div>
          )}
          {!rol && <p className="campo__ayuda">Selecciona un rol para continuar.</p>}
          <p className="campo__ayuda">En la sala te verán con el nombre de tu cuenta de Google.</p>
        </div>
      </main>
    </div>
  )
}
