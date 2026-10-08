import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../api/endpoints'
import { formatOrbes } from '../format'
import { IconoOrbe } from './Orbe'

const EVENTO = 'cafeorbe:saldo-cambio'
/**
 * Consulta de respaldo. El saldo solo cambia con un cobro o un abono, y ambos llegan como evento a la sala
 * (refrescarSaldo): consultar cada pocos segundos por cada persona conectada cargaba al servidor sin necesidad.
 */
const CONSULTAR_CADA_MS = 30_000

/** Pide al componente de saldo que vuelva a consultar (por ejemplo tras un cobro). */
export function refrescarSaldo() {
  window.dispatchEvent(new Event(EVENTO))
}

// Último saldo consultado, compartido con las pantallas que lo necesitan (el botón de puja, HU-13).
let saldoConocido: number | null = null
const suscriptores = new Set<() => void>()

function publicarSaldo(saldo: number | null) {
  saldoConocido = saldo
  suscriptores.forEach((avisar) => avisar())
}

function suscribir(avisar: () => void) {
  suscriptores.add(avisar)
  return () => {
    suscriptores.delete(avisar)
  }
}

/** Saldo que muestra la barra superior; null mientras no se conoce. */
export function useSaldoConocido(): number | null {
  return useSyncExternalStore(suscribir, () => saldoConocido)
}

/** Saldo de Orbes del usuario, visible en la barra superior del home y de la sala (HU-06, HU-24). */
export function SaldoOrbes() {
  const saldo = useSaldoConocido()

  useEffect(() => {
    let vivo = true
    const consultar = () =>
      api
        .saldo()
        .then((r) => vivo && publicarSaldo(Math.max(0, r.saldo)))
        .catch(() => undefined)
    consultar()
    const intervalo = window.setInterval(consultar, CONSULTAR_CADA_MS)
    window.addEventListener(EVENTO, consultar)
    return () => {
      vivo = false
      window.clearInterval(intervalo)
      window.removeEventListener(EVENTO, consultar)
      // Al cerrar sesión el saldo deja de ser válido: el siguiente usuario no debe ver el del anterior.
      publicarSaldo(null)
    }
  }, [])

  return (
    <span className="saldo" title="Tu saldo de Orbes">
      <IconoOrbe />
      <span className="solo-lectores">Saldo: </span>
      {saldo === null ? '— Orbes' : formatOrbes(saldo)}
    </span>
  )
}
