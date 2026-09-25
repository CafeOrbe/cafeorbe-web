import { useId, useMemo } from 'react'

/**
 * Portada ilustrada de un lote. Como los lotes no tienen foto, se dibuja una composición determinista
 * (curvas de nivel de montaña, cerezas y hojas de cafeto) a partir de una semilla, normalmente el id de la subasta:
 * la misma subasta siempre tiene la misma portada.
 */
const PALETAS = [
  { fondo: ['oklch(26% 0.05 35)', 'oklch(40% 0.12 28)'], hoja: 'oklch(52% 0.11 150)', cereza: 'oklch(56% 0.2 25)' },
  { fondo: ['oklch(24% 0.04 150)', 'oklch(38% 0.08 145)'], hoja: 'oklch(62% 0.12 145)', cereza: 'oklch(58% 0.2 25)' },
  { fondo: ['oklch(30% 0.06 55)', 'oklch(48% 0.1 65)'], hoja: 'oklch(50% 0.1 150)', cereza: 'oklch(52% 0.19 22)' },
  { fondo: ['oklch(22% 0.05 15)', 'oklch(36% 0.12 18)'], hoja: 'oklch(55% 0.1 140)', cereza: 'oklch(64% 0.17 35)' },
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
    const centro = { x: 80 + r() * 240, y: 60 + r() * 130 }
    const curvas = Array.from({ length: 9 }, (_, i) => ({
      rx: 40 + i * 34 + r() * 10,
      ry: 22 + i * 20 + r() * 8,
      giro: -20 + r() * 40,
    }))
    const racimo = { x: 250 + r() * 110, y: 120 + r() * 90 }
    const cerezas = Array.from({ length: 5 + Math.floor(r() * 3) }, () => ({
      x: racimo.x + (r() - 0.5) * 70,
      y: racimo.y + (r() - 0.5) * 46,
      radio: 11 + r() * 8,
    }))
    const hojas = Array.from({ length: 3 }, (_, i) => ({
      x: racimo.x - 30 + r() * 40,
      y: racimo.y - 20 + r() * 30,
      giro: -160 + i * 60 + r() * 30,
      escala: 0.8 + r() * 0.5,
    }))
    return { paleta, centro, curvas, cerezas, hojas }
  }, [semilla])

  const { paleta, centro, curvas, cerezas, hojas } = dibujo

  return (
    <svg className={`portada ${className}`} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: paleta.fondo[0] }} />
          <stop offset="1" style={{ stopColor: paleta.fondo[1] }} />
        </linearGradient>
        <radialGradient id={`c${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="white" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#f${id})`} />
      <g fill="none" stroke="white" strokeOpacity="0.13" strokeWidth="1.2">
        {curvas.map((c, i) => (
          <ellipse key={i} cx={centro.x} cy={centro.y} rx={c.rx} ry={c.ry} transform={`rotate(${c.giro} ${centro.x} ${centro.y})`} />
        ))}
      </g>
      {hojas.map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${h.giro}) scale(${h.escala})`}>
          <path d="M0 0C28-26 84-26 118 0 84 26 28 26 0 0Z" style={{ fill: paleta.hoja }} opacity="0.92" />
          <path d="M4 0H112" stroke="black" strokeOpacity="0.2" strokeWidth="1.5" />
        </g>
      ))}
      {cerezas.map((c, i) => (
        <g key={i}>
          <circle cx={c.x + 2} cy={c.y + 3} r={c.radio} fill="black" opacity="0.2" />
          <circle cx={c.x} cy={c.y} r={c.radio} style={{ fill: paleta.cereza }} />
          <circle cx={c.x} cy={c.y} r={c.radio} fill={`url(#c${id})`} />
          <circle cx={c.x + c.radio * 0.45} cy={c.y + c.radio * 0.4} r={c.radio * 0.12} fill="black" opacity="0.25" />
        </g>
      ))}
    </svg>
  )
}
