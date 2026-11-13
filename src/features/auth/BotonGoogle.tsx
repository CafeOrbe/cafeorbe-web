import { useEffect, useRef, useState } from 'react'

/** Lo mínimo que se usa de Google Identity Services (https://accounts.google.com/gsi/client). */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (opciones: { client_id: string; callback: (r: { credential?: string }) => void }) => void
      renderButton: (contenedor: HTMLElement, opciones: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

const SCRIPT_GIS = 'https://accounts.google.com/gsi/client'

let cargando: Promise<GoogleIdentity> | null = null

/** Carga la librería de Google una sola vez por página. */
export function cargarGoogle(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (cargando) return cargando
  cargando = new Promise<GoogleIdentity>((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = SCRIPT_GIS
    script.async = true
    script.defer = true
    script.onload = () => (window.google ? resolver(window.google) : rechazar(new Error('Google no respondió')))
    script.onerror = () => {
      cargando = null
      rechazar(new Error('No se pudo cargar el acceso con Google'))
    }
    document.head.appendChild(script)
  })
  return cargando
}

/** Solo para pruebas: olvida la carga anterior. */
export function reiniciarCargaGoogle() {
  cargando = null
}

interface Props {
  /** Recibe el ID token de Google; quien lo use debe enviarlo a identity para que lo verifique (SEG-01). */
  alObtenerCredencial: (idToken: string) => void
  alFallar: (mensaje: string) => void
}

/**
 * SEG-01: botón oficial "Continuar con Google". El navegador nunca decide quién es la persona: solo obtiene el
 * ID token firmado por Google y lo entrega al servidor, que valida firma, vencimiento, emisor y audiencia.
 */
export function BotonGoogle({ alObtenerCredencial, alFallar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const oyentes = useRef({ alObtenerCredencial, alFallar })
  oyentes.current = { alObtenerCredencial, alFallar }
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let vigente = true
    cargarGoogle()
      .then((google) => {
        if (!vigente || !contenedor.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (respuesta) => {
            if (respuesta.credential) oyentes.current.alObtenerCredencial(respuesta.credential)
            else oyentes.current.alFallar('Google no entregó la credencial, intenta de nuevo')
          },
        })
        google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          locale: 'es',
          width: 320,
        })
        setListo(true)
      })
      .catch((e: unknown) => {
        if (vigente) oyentes.current.alFallar(e instanceof Error ? e.message : 'No se pudo cargar el acceso con Google')
      })
    return () => {
      vigente = false
    }
  }, [clientId])

  if (!clientId) {
    return <p className="campo__ayuda">El acceso con Google no está configurado en este ambiente.</p>
  }
  return (
    <div className="acceso__google">
      <div ref={contenedor} data-testid="boton-google" />
      {!listo && <p className="campo__ayuda">Cargando el acceso con Google…</p>}
    </div>
  )
}
