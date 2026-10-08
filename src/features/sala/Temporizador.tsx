import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { enAlerta, formatReloj, segundosRestantes } from './reloj'

/**
 * HU-17: cuenta regresiva de la subasta. Se calcula contra la hora de fin y el reloj del servidor, así dos
 * navegadores muestran lo mismo y recargar la página no la desfasa. Bajo 60 s cambia de color como alerta.
 */
export function Temporizador({ horaFin, desfaseMs }: { horaFin: string | null; desfaseMs: number }) {
  const [, setTic] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => setTic((n) => n + 1), 250)
    return () => window.clearInterval(t)
  }, [])

  const restantes = segundosRestantes(horaFin, Date.now(), desfaseMs)
  if (restantes === null) return null
  const alerta = enAlerta(restantes)

  return (
    <span className={`temporizador${alerta ? ' temporizador--alerta' : ''}`} role="timer" aria-label="Tiempo restante de la subasta">
      <Timer aria-hidden="true" />
      <span className="temporizador__valor tabular">{formatReloj(restantes)}</span>
      <span className="solo-lectores">{alerta ? ' último minuto' : ''}</span>
    </span>
  )
}
