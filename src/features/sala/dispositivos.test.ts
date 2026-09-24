import { describe, expect, it, vi } from 'vitest'
import { verificarDispositivos, type PedirMedios } from './dispositivos'

/** getUserMedia falso: concede o niega cámara y micrófono por separado y cuenta las pistas detenidas. */
function navegador({ camara, microfono }: { camara: boolean; microfono: boolean }) {
  const detenidas: string[] = []
  const pedidos: MediaStreamConstraints[] = []
  const pedir: PedirMedios = async (restricciones) => {
    pedidos.push(restricciones)
    const tipo = restricciones.video ? 'video' : 'audio'
    const permitido = tipo === 'video' ? camara : microfono
    if (!permitido) throw new DOMException('Permiso denegado', 'NotAllowedError')
    return { getTracks: () => [{ stop: () => detenidas.push(tipo) }] } as unknown as MediaStream
  }
  return { pedir: vi.fn(pedir), detenidas, pedidos }
}

describe('verificarDispositivos (hallazgo 15)', () => {
  it('cámara y micrófono disponibles: transmite con audio y detiene las pistas de prueba', async () => {
    const n = navegador({ camara: true, microfono: true })
    expect(await verificarDispositivos(n.pedir)).toEqual({ camara: true, microfono: true })
    expect(n.detenidas).toEqual(['video', 'audio'])
  })

  it('micrófono negado o ausente: la cámara sigue disponible y se transmite sin audio', async () => {
    const n = navegador({ camara: true, microfono: false })
    expect(await verificarDispositivos(n.pedir)).toEqual({ camara: true, microfono: false })
  })

  it('cámara negada: no se puede transmitir y ni siquiera se pide el micrófono', async () => {
    const n = navegador({ camara: false, microfono: true })
    expect(await verificarDispositivos(n.pedir)).toEqual({ camara: false, microfono: false })
    expect(n.pedidos).toEqual([{ video: true }])
  })

  it('la cámara se pide sola, sin exigir audio', async () => {
    const n = navegador({ camara: true, microfono: true })
    await verificarDispositivos(n.pedir)
    expect(n.pedidos[0]).toEqual({ video: true })
    expect(n.pedidos[1]).toEqual({ audio: true })
  })
})
