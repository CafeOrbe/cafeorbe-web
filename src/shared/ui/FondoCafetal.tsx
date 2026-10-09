import { useMemo } from 'react'
import { cordillera, GranoCafe, RamaCafe, Surcos } from './CafeDibujos'

const MONTES = ['oklch(35% 0.09 152)', 'oklch(29% 0.075 153)', 'oklch(23% 0.06 154)']

// Granos de café sembrados con un generador fijo: siempre el mismo reparto, de lejos más tenues y chicos.
const GRANOS = (() => {
  let semilla = 11
  const r = () => {
    semilla = (semilla * 16807) % 2147483647
    return (semilla - 1) / 2147483646
  }
  return Array.from({ length: 220 }, () => {
    const x = 20 + r() * 1560
    const y = 20 + r() * 860
    // Detrás del bloque de texto (izquierda y centro) los granos casi desaparecen para no competir con él.
    const detrasDelTexto = x > 90 && x < 800 && y > 240 && y < 740
    const opacidad = (0.12 + r() * 0.2) * (detrasDelTexto ? 0.35 : 1)
    return { x, y, escala: 0.8 + r() * 1.9, giro: r() * 360 - 180, opacidad }
  })
})()

/**
 * Fondo de toda la pantalla de acceso: laderas de cafetal en terrazas, ramas con cerezas
 * y muchos granos de café flotando. Es transparente arriba para que se vea el degradado verde de la página; sin sol ni orbe.
 */
export function FondoCafetal({ className = 'acceso__fondo' }: { className?: string }) {
  const montes = useMemo(() => {
    // Generador fijo (no aleatorio) para que el fondo sea siempre el mismo.
    let s = 7
    const r = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
    return [cordillera(r, 1600, 900, 560, 100), cordillera(r, 1600, 900, 660, 90), cordillera(r, 1600, 900, 770, 80)]
  }, [])

  return (
    <svg className={className} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g>
        {GRANOS.map((g) => (
          <GranoCafe key={`${g.x}-${g.y}`} x={g.x} y={g.y} escala={g.escala} rotacion={g.giro} opacidad={g.opacidad} />
        ))}
      </g>
      <RamaCafe x={1640} y={190} escala={2.6} rotacion={10} espejo />
      <RamaCafe x={-30} y={340} escala={1.6} rotacion={-10} opacidad={0.9} />
      <RamaCafe x={760} y={-10} escala={1.5} rotacion={32} opacidad={0.85} />
      <RamaCafe x={1650} y={470} escala={1.7} rotacion={-8} espejo opacidad={0.9} />
      {montes.map((m, i) => (
        <g key={i}>
          <path d={m.relleno} style={{ fill: MONTES[i] }} />
          <Surcos cresta={m.cresta} filas={i === 2 ? 4 : 6} separacion={16} opacidad={0.4} />
        </g>
      ))}
    </svg>
  )
}
