/** Isotipo de CaféOrbe: un grano de café dentro de un orbe. */
export function Logo({ className = 'marca__logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" style={{ fill: 'var(--cereza)' }} />
      <circle cx="20" cy="20" r="15.5" fill="none" style={{ stroke: 'var(--oro)' }} strokeWidth="1.2" opacity="0.7" />
      <ellipse cx="20" cy="20" rx="7.6" ry="10.6" transform="rotate(28 20 20)" style={{ fill: 'var(--sobre-cereza)' }} />
      <path
        d="M16.2 12.6c4.4 2.6 3.2 6.6 1.4 8.4-1.8 1.8-2.4 4.6 2.2 7.6"
        fill="none"
        style={{ stroke: 'var(--cereza)' }}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`marca${grande ? ' marca--grande' : ''}`}>
      <Logo />
      <span>
        Café<span className="marca__acento">Orbe</span>
      </span>
    </span>
  )
}
