import { describe, expect, it } from 'vitest'
import type { Detalle } from '../../shared/api/types'
import { estadoInicial, salaReducer, type SalaEstado } from './salaReducer'

const detalleEnCurso: Detalle = {
  id: 's1',
  nombre: 'Lote 1',
  descripcion: null,
  estado: 'EN_CURSO',
  fechaInicio: '2026-09-21T15:00:00Z',
  subastadorId: 'u-luis',
  subastadorNombre: 'Luis',
  ficha: null,
  reglas: { duracionMinutos: 10, precioBase: 100, incrementoMinimo: 10, version: 1 },
  horaInicio: '2026-09-21T15:00:00Z',
  horaFin: '2026-09-21T15:10:00Z',
  precioActual: 100,
  siguienteMinimo: 110,
  lider: null,
  cantidadPujas: 0,
  ultimasPujas: [],
  horaServidor: '2026-09-21T15:00:00Z',
  segundosRestantes: 600,
  extensiones: 0,
  maxExtensiones: 3,
}

const conDetalle: SalaEstado = { ...estadoInicial, cargando: false, detalle: detalleEnCurso }

const pujaAceptada = (monto: number, usuario: string, id: string) => ({
  tipo: 'MENSAJE' as const,
  mensaje: {
    tipo: 'PUJA_ACEPTADA',
    subastaId: 's1',
    datos: {
      pujaId: id,
      usuarioId: `u-${usuario}`,
      usuarioNombre: usuario,
      monto,
      cantidadPujas: 1,
      siguienteMinimo: monto + 10,
      ocurridaEn: '2026-09-21T15:01:00Z',
    },
  },
})

describe('salaReducer', () => {
  it('HU-13 y HU-16 · una puja aceptada actualiza precio, líder, próximo mínimo e historial', () => {
    const despues = salaReducer(conDetalle, pujaAceptada(110, 'Ana', 'p1'))

    expect(despues.detalle?.precioActual).toBe(110)
    expect(despues.detalle?.siguienteMinimo).toBe(120)
    expect(despues.detalle?.lider).toEqual({ id: 'u-Ana', nombre: 'Ana' })
    expect(despues.detalle?.ultimasPujas.map((p) => p.monto)).toEqual([110])
  })

  it('las pujas nuevas van primero y el historial no crece más de 10', () => {
    let estado = conDetalle
    for (let i = 1; i <= 12; i++) estado = salaReducer(estado, pujaAceptada(100 + i * 10, 'Ana', `p${i}`))
    expect(estado.detalle?.ultimasPujas).toHaveLength(10)
    expect(estado.detalle?.ultimasPujas[0].monto).toBe(220)
  })

  it('una puja que llega tarde no devuelve el precio ni el líder a un valor viejo', () => {
    const alDia = salaReducer(conDetalle, pujaAceptada(130, 'Bruno', 'p2'))

    // La puja de 120 ocurrió antes que la de 130, pero su aviso llegó después.
    const despues = salaReducer(alDia, pujaAceptada(120, 'Ana', 'p1'))

    expect(despues.detalle?.precioActual).toBe(130)
    expect(despues.detalle?.siguienteMinimo).toBe(140)
    expect(despues.detalle?.lider).toEqual({ id: 'u-Bruno', nombre: 'Bruno' })
    // Se conserva en el historial, en su lugar.
    expect(despues.detalle?.ultimasPujas.map((p) => p.monto)).toEqual([130, 120])
    // Repetida, además de atrasada, no cambia nada.
    expect(salaReducer(despues, pujaAceptada(120, 'Ana', 'p1'))).toBe(despues)
  })

  it('HU-24 · ORBES_ABONADOS guarda lo que recibió el Subastador para anunciarlo', () => {
    expect(conDetalle.abono).toBeNull()

    const despues = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: { tipo: 'ORBES_ABONADOS', subastaId: 's1', datos: { subastaId: 's1', usuarioId: 'u-luis', monto: 300, saldo: 300 } },
    })

    expect(despues.abono).toBe(300)
  })

  it('una puja repetida (mismo id) no se duplica en el historial', () => {
    const una = salaReducer(conDetalle, pujaAceptada(110, 'Ana', 'p1'))
    const repetida = salaReducer(una, pujaAceptada(110, 'Ana', 'p1'))
    expect(repetida.detalle?.ultimasPujas).toHaveLength(1)
  })

  it('HU-14 · PUJA_RECHAZADA muestra el motivo y la siguiente puja aceptada lo limpia', () => {
    const rechazada = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: { tipo: 'PUJA_RECHAZADA', subastaId: 's1', datos: { mensaje: 'Orbes insuficientes' } },
    })
    expect(rechazada.aviso).toBe('Orbes insuficientes')
    expect(salaReducer(rechazada, pujaAceptada(110, 'Ana', 'p1')).aviso).toBeNull()
  })

  it('HU-05 y HU-15 · CONECTADOS actualiza el conteo', () => {
    const despues = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: { tipo: 'CONECTADOS', subastaId: 's1', datos: { conectados: 4 } },
    })
    expect(despues.conectados).toBe(4)
  })

  it('HU-12 · SUBASTA_INICIADA pasa a En curso con el precio base y el primer mínimo', () => {
    const programada: SalaEstado = { ...conDetalle, detalle: { ...detalleEnCurso, estado: 'PROGRAMADA', precioActual: null, siguienteMinimo: null } }
    const despues = salaReducer(programada, {
      tipo: 'MENSAJE',
      mensaje: {
        tipo: 'SUBASTA_INICIADA',
        subastaId: 's1',
        datos: { precioBase: 100, incrementoMinimo: 10, horaInicio: '2026-09-21T15:00:00Z', horaFin: '2026-09-21T15:10:00Z' },
      },
    })
    expect(despues.detalle?.estado).toBe('EN_CURSO')
    expect(despues.detalle?.precioActual).toBe(100)
    expect(despues.detalle?.siguienteMinimo).toBe(110)
  })

  it('HU-11 · los eventos de transmisión prenden y apagan el indicador EN VIVO', () => {
    const viva = salaReducer(conDetalle, { tipo: 'MENSAJE', mensaje: { tipo: 'TRANSMISION_INICIADA', subastaId: 's1', datos: {} } })
    expect(viva.transmitiendo).toBe(true)
    const cortada = salaReducer(viva, { tipo: 'MENSAJE', mensaje: { tipo: 'TRANSMISION_DETENIDA', subastaId: 's1', datos: {} } })
    expect(cortada.transmitiendo).toBe(false)
  })

  it('un evento de puja antes de cargar el detalle se ignora sin romper', () => {
    expect(salaReducer(estadoInicial, pujaAceptada(110, 'Ana', 'p1'))).toBe(estadoInicial)
  })

  it('un mensaje desconocido no cambia el estado', () => {
    expect(salaReducer(conDetalle, { tipo: 'MENSAJE', mensaje: { tipo: 'PONG', subastaId: 's1', datos: {} } })).toBe(conDetalle)
  })

  it('HU-17 · el detalle trae el desfase con el reloj del servidor y se conserva si no llega uno nuevo', () => {
    const conDesfase = salaReducer(estadoInicial, { tipo: 'DETALLE', detalle: detalleEnCurso, desfaseMs: 4200 })
    expect(conDesfase.desfaseMs).toBe(4200)
    expect(salaReducer(conDesfase, { tipo: 'DETALLE', detalle: detalleEnCurso }).desfaseMs).toBe(4200)
  })

  it('HU-18 · TIEMPO_EXTENDIDO actualiza la hora de fin, muestra el aviso y se puede retirar', () => {
    const extendida = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: {
        tipo: 'TIEMPO_EXTENDIDO',
        subastaId: 's1',
        datos: { segundosExtendidos: 30, horaFin: '2026-09-21T15:10:30Z', extension: 1, maximoExtensiones: 3 },
      },
    })
    expect(extendida.detalle?.horaFin).toBe('2026-09-21T15:10:30Z')
    expect(extendida.detalle?.extensiones).toBe(1)
    expect(extendida.extension).toEqual({ segundos: 30, numero: 1, maximo: 3 })
    expect(salaReducer(extendida, { tipo: 'LIMPIAR_EXTENSION' }).extension).toBeNull()
  })

  it('HU-19 y HU-21 · SUBASTA_CERRADA con ganador: la sala pasa a Finalizada y guarda el anuncio', () => {
    const cerrada = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: {
        tipo: 'SUBASTA_CERRADA',
        subastaId: 's1',
        datos: { estado: 'FINALIZADA', ganadorId: 'u-Ana', ganadorNombre: 'Ana', montoFinal: 300, cantidadPujas: 5 },
      },
    })
    expect(cerrada.detalle?.estado).toBe('FINALIZADA')
    expect(cerrada.cierre).toEqual({ estado: 'FINALIZADA', ganadorId: 'u-Ana', ganadorNombre: 'Ana', montoFinal: 300, cantidadPujas: 5 })
  })

  it('HU-21 · SUBASTA_CERRADA sin pujas: Desierta y sin ganador', () => {
    const cerrada = salaReducer(conDetalle, {
      tipo: 'MENSAJE',
      mensaje: {
        tipo: 'SUBASTA_CERRADA',
        subastaId: 's1',
        datos: { estado: 'DESIERTA', ganadorId: null, ganadorNombre: null, montoFinal: null, cantidadPujas: 0 },
      },
    })
    expect(cerrada.detalle?.estado).toBe('DESIERTA')
    expect(cerrada.cierre?.ganadorNombre).toBeNull()
    expect(cerrada.cierre?.montoFinal).toBeNull()
  })

  it('una subasta que ya estaba cerrada al entrar no tiene anuncio en vivo', () => {
    const yaCerrada = salaReducer(estadoInicial, { tipo: 'DETALLE', detalle: { ...detalleEnCurso, estado: 'FINALIZADA' } })
    expect(yaCerrada.cierre).toBeNull()
  })
})
