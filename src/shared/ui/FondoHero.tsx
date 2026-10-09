import { useMemo } from 'react'
import { cordillera, GranoCafe, RamaCafe, Surcos } from './CafeDibujos'

const MONTES = ['oklch(33% 0.085 152)', 'oklch(26% 0.07 153)']

// Granos de café muy tenues, con un generador fijo: siempre el mismo reparto.
const GRANOS = (() => {
  let semilla = 23
  const r = () => {
    semilla = (semilla * 16807) % 2147483647
    return (semilla - 1) / 2147483646
  }
  return Array.from({ length: 70 }, () => ({
    x: 15 + r() * 1170,
    y: 15 + r() * 270,
    escala: 0.7 + r() * 1.3,
    giro: r() * 360 - 180,
    opacidad: 0.12 + r() * 0.2,
  }))
})()

/** Fondo del héroe de las páginas de inicio: el mismo cafetal del acceso, en una franja ancha y baja. */
export function FondoHero() {
  const montes = useMemo(() => {
    let s = 5
    const r = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
    return [cordillera(r, 1200, 300, 235, 55), cordillera(r, 1200, 300, 275, 40)]
  }, [])

  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {GRANOS.map((g) => (
        <GranoCafe key={`${g.x}-${g.y}`} x={g.x} y={g.y} escala={g.escala} rotacion={g.giro} opacidad={g.opacidad} />
      ))}
      <RamaCafe x={1215} y={70} escala={1.5} rotacion={14} espejo />
      {montes.map((m, i) => (
        <g key={i}>
          <path d={m.relleno} style={{ fill: MONTES[i] }} />
          <Surcos cresta={m.cresta} filas={i === 0 ? 3 : 2} separacion={11} opacidad={0.4} />
        </g>
      ))}
    </svg>
  )
}
