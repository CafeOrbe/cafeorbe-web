import { useId, useMemo } from 'react'
import { cordillera, GranoCafe, RamaCafe, Surcos } from './CafeDibujos'

/**
 * Portada ilustrada de un lote. Como los lotes no tienen foto, se dibuja un paisaje cafetero sereno y determinista:
 * laderas sembradas de cafetos, una rama con cerezas y algunos granos flotando. La semilla, normalmente el id de la
 * subasta, fija la paleta, el lado de la rama, los granos y el relieve: la misma subasta siempre tiene la misma portada.
 */
const PALETAS = [
  // Bosque
  { cielo: ['oklch(36% 0.08 155)', 'oklch(22% 0.05 158)'], montes: ['oklch(40% 0.09 150)', 'oklch(30% 0.07 153)', 'oklch(21% 0.05 156)'] },
  // Café tostado
  { cielo: ['oklch(38% 0.06 62)', 'oklch(21% 0.04 52)'], montes: ['oklch(36% 0.07 90)', 'oklch(28% 0.06 70)', 'oklch(19% 0.04 55)'] },
  // Selva de altura
  { cielo: ['oklch(40% 0.09 140)', 'oklch(24% 0.06 150)'], montes: ['oklch(35% 0.09 145)', 'oklch(27% 0.07 150)', 'oklch(19% 0.05 155)'] },
  // Amanecer espresso
  { cielo: ['oklch(32% 0.06 50)', 'oklch(17% 0.03 45)'], montes: ['oklch(30% 0.07 120)', 'oklch(23% 0.05 140)', 'oklch(16% 0.04 150)'] },
]

function semillaNumerica(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Generador pseudoaleatorio pequeño (mulberry32): mismo resultado para la misma semilla. */
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function PortadaLote({ semilla, className = '' }: { semilla: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  const dibujo = useMemo(() => {
    const r = aleatorio(semillaNumerica(semilla))
    const paleta = PALETAS[Math.floor(r() * PALETAS.length)]
    const rama = { derecha: r() < 0.5, y: 118 + r() * 24, giro: -8 + r() * 16 }
    const granos = Array.from({ length: 4 }, () => ({ x: 40 + r() * 320, y: 22 + r() * 70, escala: 0.7 + r() * 0.7, giro: r() * 180 }))
    const montes = [cordillera(r, 400, 250, 150, 55), cordillera(r, 400, 250, 190, 45), cordillera(r, 400, 250, 232, 35)]
    return { paleta, rama, granos, montes }
  }, [semilla])

  const { paleta, rama, granos, montes } = dibujo

  return (
    <svg className={`portada ${className}`} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: paleta.cielo[0] }} />
          <stop offset="1" style={{ stopColor: paleta.cielo[1] }} />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#f${id})`} />
      <g>
        {granos.map((g, i) => (
          <GranoCafe key={i} x={g.x} y={g.y} escala={g.escala} rotacion={g.giro} opacidad={0.4} />
        ))}
        <RamaCafe x={rama.derecha ? 412 : -12} y={rama.y} escala={0.95} rotacion={rama.giro} espejo={rama.derecha} />
      </g>
      {montes.map((m, i) => (
        <g key={i}>
          <path d={m.relleno} style={{ fill: paleta.montes[i] }} />
          {i < 2 && <Surcos cresta={m.cresta} filas={i === 0 ? 3 : 4} separacion={9} />}
        </g>
      ))}
    </svg>
  )
}
