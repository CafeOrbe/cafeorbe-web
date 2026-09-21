import { useEffect, useState } from 'react'
import { api } from '../api/endpoints'
import { formatOrbes } from '../format'

const EVENTO = 'cafeorbe:saldo-cambio'

/** Pide al componente de saldo que vuelva a consultar (por ejemplo tras un cobro). */
export function refrescarSaldo() {
  window.dispatchEvent(new Event(EVENTO))
}

/** Saldo de Orbes del Comprador, visible en la barra superior del home y de la sala (HU-06). */
export function SaldoOrbes() {
  const [saldo, setSaldo] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    const consultar = () =>
      api
        .saldo()
        .then((r) => vivo && setSaldo(Math.max(0, r.saldo)))
        .catch(() => undefined)
    consultar()
    const intervalo = window.setInterval(consultar, 8000)
    window.addEventListener(EVENTO, consultar)
    return () => {
      vivo = false
      window.clearInterval(intervalo)
      window.removeEventListener(EVENTO, consultar)
    }
  }, [])

  return (
    <span className="saldo" aria-label="Saldo de Orbes" title="Tu saldo de Orbes">
      {saldo === null ? '— Orbes' : formatOrbes(saldo)}
    </span>
  )
}
