import { describe, expect, it } from 'vitest'
import { estadoDelBoton, MSG_LIDER, MSG_SIN_SALDO, MSG_TIEMPO_AGOTADO, type DatosDelBoton } from './botonPuja'

const base: DatosDelBoton = {
  estado: 'EN_CURSO',
  soyLider: false,
  tiempoAgotado: false,
  saldo: 500,
  monto: 110,
  conectado: true,
  enviando: false,
}

describe('HU-13 · estadoDelBoton', () => {
  it('propone precio actual + incremento y queda habilitado', () => {
    expect(estadoDelBoton(base)).toEqual({ etiqueta: 'Pujar 110', deshabilitado: false, puedePujar: true })
  })

  it('siendo líder se deshabilita con Vas ganando', () => {
    expect(estadoDelBoton({ ...base, soyLider: true })).toEqual({ etiqueta: MSG_LIDER, deshabilitado: true, puedePujar: false })
  })

  it('sin Orbes se deshabilita con Orbes insuficientes', () => {
    expect(estadoDelBoton({ ...base, saldo: 0 })).toEqual({ etiqueta: MSG_SIN_SALDO, deshabilitado: true, puedePujar: false })
  })

  it('con saldo menor que el monto sigue activo: el rechazo lo da el servidor (escenario 3)', () => {
    expect(estadoDelBoton({ ...base, saldo: 50 })).toEqual({ etiqueta: 'Pujar 110', deshabilitado: false, puedePujar: true })
  })

  it('mientras no se conoce el saldo no se bloquea', () => {
    expect(estadoDelBoton({ ...base, saldo: null }).deshabilitado).toBe(false)
  })

  it('HU-12 · antes de iniciar la subasta no se puede pujar', () => {
    expect(estadoDelBoton({ ...base, estado: 'PROGRAMADA' })).toEqual({
      etiqueta: 'La subasta aún no inicia',
      deshabilitado: true,
      puedePujar: false,
    })
  })

  it('con el tiempo agotado se deshabilita (hallazgo 18)', () => {
    expect(estadoDelBoton({ ...base, tiempoAgotado: true }).etiqueta).toBe(MSG_TIEMPO_AGOTADO)
  })

  it('espera la conexión y la respuesta de la puja anterior', () => {
    expect(estadoDelBoton({ ...base, conectado: false }).deshabilitado).toBe(true)
    expect(estadoDelBoton({ ...base, enviando: true }).deshabilitado).toBe(true)
  })
})
