/** Isotipo de CaféOrbe: un grano de café dentro de dos anillos dorados. */
export function Logo({ className = 'marca__logo' }: { className?: string }) {
  return <img className={className} src="/images/logo-orbe.png" alt="" aria-hidden="true" width="480" height="479" decoding="async" />
}

/** Logotipo completo: isotipo y nombre. El texto accesible se conserva aunque las imágenes no carguen. */
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`marca${grande ? ' marca--grande' : ''}`}>
      <Logo />
      <img className="marca__titulo" src="/images/titulo.png" alt="" aria-hidden="true" width="720" height="161" decoding="async" />
      <span className="solo-lectores">CaféOrbe</span>
    </span>
  )
}

/** Lema de la marca con su balanza dorada. */
export function Lema({ className = 'lema' }: { className?: string }) {
  return <img className={className} src="/images/lema.png" alt="Subastas que impulsan grandes cafés" width="800" height="137" decoding="async" />
}
