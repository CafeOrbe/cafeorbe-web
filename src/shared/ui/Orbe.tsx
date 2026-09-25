import { formatOrbes } from '../format'

/** Moneda dorada de los Orbes. Decorativa: el texto al lado siempre dice "Orbes". */
export function IconoOrbe({ className = 'orbe' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" style={{ fill: 'var(--oro)' }} />
      <circle cx="12" cy="12" r="8.2" fill="none" style={{ stroke: 'var(--oro-borde)' }} strokeWidth="1.3" />
      <ellipse cx="12" cy="12" rx="3.4" ry="4.8" transform="rotate(28 12 12)" style={{ fill: 'var(--oro-borde)' }} />
      <path d="M10.6 8.6c1.9 1.2 1.4 2.9.6 3.7-.8.8-1 2 1 3.3" fill="none" style={{ stroke: 'var(--oro)' }} strokeWidth="0.9" />
    </svg>
  )
}

/** Monto en Orbes con la moneda y cifras tabulares. */
export function Monto({ cantidad, grande = false }: { cantidad: number; grande?: boolean }) {
  return (
    <span className={`monto${grande ? ' monto--grande' : ''}`}>
      <IconoOrbe />
      {formatOrbes(cantidad)}
    </span>
  )
}
