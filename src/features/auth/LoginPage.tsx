import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { Rol } from '../../shared/api/types'
import { rutaInicio } from '../../shared/routes'
import { useSesion } from '../../shared/session'
import { Campo } from '../../shared/ui/Campo'
import { validarNombre } from '../../shared/validators'

const ROLES: { valor: Rol; titulo: string; descripcion: string }[] = [
  { valor: 'COMPRADOR', titulo: 'Comprador', descripcion: 'Entra a las subastas y puja con tus Orbes.' },
  { valor: 'SUBASTADOR', titulo: 'Subastador', descripcion: 'Crea, transmite y dirige tus subastas.' },
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
      <form className="tarjeta acceso__tarjeta" onSubmit={enviar} noValidate>
        <h1 className="acceso__marca">☕ CaféOrbe</h1>
        <p className="acceso__lema">Subastas en vivo con Orbes</p>

        <Campo etiqueta="Tu nombre" error={errorNombre}>
          <input
            type="text"
            value={nombre}
            maxLength={50}
            autoComplete="nickname"
            autoFocus
            onChange={(e) => {
              setNombre(e.target.value)
              if (errorNombre) setErrorNombre(null)
            }}
          />
        </Campo>

        <fieldset className="roles">
          <legend className="campo__etiqueta">¿Con qué rol vas a participar?</legend>
          {ROLES.map((r) => (
            <label key={r.valor} className={`rol${rol === r.valor ? ' rol--activo' : ''}`}>
              <input type="radio" name="rol" value={r.valor} checked={rol === r.valor} onChange={() => setRol(r.valor)} />
              <span className="rol__titulo">{r.titulo}</span>
              <span className="rol__descripcion">{r.descripcion}</span>
            </label>
          ))}
        </fieldset>

        {errorServidor && (
          <p className="campo__error" role="alert">
            {errorServidor}
          </p>
        )}

        <button type="submit" className="boton boton--primario boton--ancho" disabled={!rol || enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        {!rol && <p className="campo__ayuda">Selecciona un rol para continuar.</p>}
      </form>
    </div>
  )
}
