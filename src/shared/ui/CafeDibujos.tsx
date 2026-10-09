/** Piezas ilustradas con temática de café, compartidas por las portadas y el fondo del acceso. */

const HOJA_CLARA = 'oklch(50% 0.12 150)'
const HOJA_OSCURA = 'oklch(38% 0.09 153)'
const NERVIO = 'oklch(72% 0.1 145)'
const TALLO = 'oklch(33% 0.06 70)'
const CEREZA = 'oklch(50% 0.2 25)'
const CEREZA_BRILLO = 'oklch(72% 0.16 30)'
const GRANO = 'oklch(46% 0.09 55)'
const GRANO_SURCO = 'oklch(24% 0.05 48)'

type Punto = { x: number; y: number }

/** Cordillera suave: curva por puntos de altura aleatoria. `relleno` se cierra por abajo; `cresta(dy)` es el trazo abierto. */
export function cordillera(r: () => number, ancho: number, alto: number, base: number, relieve: number) {
  const paso = ancho / 6
  const puntos: Punto[] = Array.from({ length: 7 }, (_, i) => ({ x: i * paso, y: base - r() * relieve }))
  const tramos = (dy: number) => {
    let d = ''
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1]
      const b = puntos[i]
      d += `Q${(a.x + paso / 2).toFixed(1)} ${(Math.min(a.y, b.y) - relieve * 0.18 + dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y + dy).toFixed(1)}`
    }
    return d
  }
  return {
    relleno: `M0 ${alto}L0 ${puntos[0].y.toFixed(1)}${tramos(0)}L${ancho} ${alto}Z`,
    /** Hilera de cafetos que sigue el relieve, `dy` unidades por debajo de la cresta. */
    cresta: (dy: number) => `M0 ${(puntos[0].y + dy).toFixed(1)}${tramos(dy)}`,
  }
}

/** Surcos de cafetal: hileras paralelas a la cresta. Dan la sensación de ladera sembrada. */
export function Surcos({ cresta, filas, separacion = 11, opacidad = 0.25 }: { cresta: (dy: number) => string; filas: number; separacion?: number; opacidad?: number }) {
  return (
    <g fill="none" stroke="oklch(62% 0.11 145)" strokeWidth="1.1" strokeLinecap="round" strokeOpacity={opacidad} strokeDasharray="1 5">
      {Array.from({ length: filas }, (_, i) => (
        <path key={i} d={cresta((i + 1) * separacion)} />
      ))}
    </g>
  )
}

function hoja(largo: number): string {
  return `M0 0C${largo * 0.22} ${-largo * 0.34} ${largo * 0.72} ${-largo * 0.32} ${largo} 0C${largo * 0.72} ${largo * 0.32} ${largo * 0.22} ${largo * 0.34} 0 0Z`
}

function sobreTallo(t: number): { x: number; y: number; angulo: number } {
  // Curva cuadrática del tallo: (0,0) → (140,-42) con control en (70,14).
  const u = 1 - t
  const x = 2 * u * t * 70 + t * t * 140
  const y = 2 * u * t * 14 + t * t * -42
  const dx = 2 * u * 70 + 2 * t * 70
  const dy = 2 * u * 14 + 2 * t * -56
  return { x, y, angulo: (Math.atan2(dy, dx) * 180) / Math.PI }
}

const PASOS_HOJA = [0.12, 0.28, 0.44, 0.6, 0.76, 0.94]
const PASOS_CEREZA = [0.22, 0.5, 0.78]

/** Rama de cafeto con hojas lanceoladas y cerezas rojas. Nace en (x, y) y se extiende hacia la derecha (o la izquierda con `espejo`). */
export function RamaCafe({ x = 0, y = 0, escala = 1, rotacion = 0, espejo = false, opacidad = 1 }: { x?: number; y?: number; escala?: number; rotacion?: number; espejo?: boolean; opacidad?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotacion}) scale(${espejo ? -escala : escala} ${escala})`} opacity={opacidad}>
      <path d="M0 0Q70 14 140 -42" fill="none" stroke={TALLO} strokeWidth="3.2" strokeLinecap="round" />
      {PASOS_HOJA.map((t, i) => {
        const p = sobreTallo(t)
        const largo = 32 - i * 3
        const lado = i % 2 === 0 ? -1 : 1
        return (
          <g key={t} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(p.angulo + lado * 52).toFixed(1)})`}>
            <path d={hoja(largo)} fill={i % 2 === 0 ? HOJA_CLARA : HOJA_OSCURA} />
            <path d={`M0 0L${largo * 0.9} 0`} stroke={NERVIO} strokeWidth="0.9" strokeOpacity="0.7" strokeLinecap="round" />
          </g>
        )
      })}
      {PASOS_CEREZA.map((t) => {
        const p = sobreTallo(t)
        return (
          <g key={t} transform={`translate(${p.x.toFixed(1)} ${(p.y + 3).toFixed(1)})`}>
            <path d="M0 -3L0 5" stroke={TALLO} strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="0" cy="9" r="4.6" fill={CEREZA} />
            <circle cx="6" cy="6" r="4.1" fill={CEREZA} />
            <circle cx="-5" cy="7" r="3.8" fill={CEREZA} />
            <circle cx="-1.3" cy="7.4" r="1.2" fill={CEREZA_BRILLO} opacity="0.85" />
            <circle cx="5" cy="4.6" r="1.1" fill={CEREZA_BRILLO} opacity="0.85" />
          </g>
        )
      })}
    </g>
  )
}

/** Grano de café tostado con su surco central. */
export function GranoCafe({ x, y, escala = 1, rotacion = 0, opacidad = 1 }: { x: number; y: number; escala?: number; rotacion?: number; opacidad?: number }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotacion.toFixed(0)}) scale(${escala.toFixed(2)})`} opacity={opacidad}>
      <ellipse rx="7" ry="10" fill={GRANO} />
      <path d="M-0.5 -9.4C5.2 -4 -5.2 3 0.5 9.4" fill="none" stroke={GRANO_SURCO} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  )
}
