import type { ReactNode } from 'react'

/** Campo de formulario con etiqueta y el error visible junto al campo. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
}: {
  etiqueta: string
  error?: string | null
  ayuda?: string
  children: ReactNode
}) {
  return (
    <label className={`campo${error ? ' campo--error' : ''}`}>
      <span className="campo__etiqueta">{etiqueta}</span>
      {children}
      {ayuda && !error && <span className="campo__ayuda">{ayuda}</span>}
      {error && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
