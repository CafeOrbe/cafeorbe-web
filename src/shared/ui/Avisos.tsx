import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type Tipo = 'info' | 'exito' | 'error'

interface Aviso {
  id: number
  texto: string
  tipo: Tipo
}

interface ContextoAvisos {
  mostrar: (texto: string, tipo?: Tipo) => void
}

const Contexto = createContext<ContextoAvisos | null>(null)

const ICONOS = { info: Info, exito: CircleCheck, error: CircleAlert }

/** Notificaciones temporales en la esquina de la pantalla. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const contador = useRef(0)

  const mostrar = useCallback((texto: string, tipo: Tipo = 'info') => {
    const id = ++contador.current
    setAvisos((actuales) => [...actuales, { id, texto, tipo }])
    window.setTimeout(() => setAvisos((actuales) => actuales.filter((a) => a.id !== id)), 5000)
  }, [])

  const valor = useMemo(() => ({ mostrar }), [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => {
          const Icono = ICONOS[a.tipo]
          return (
            <div key={a.id} className={`aviso aviso--${a.tipo}`}>
              <Icono aria-hidden="true" />
              <span>{a.texto}</span>
            </div>
          )
        })}
      </div>
    </Contexto.Provider>
  )
}

export function useAvisos(): ContextoAvisos {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAvisos debe usarse dentro de ProveedorAvisos')
  return contexto
}
