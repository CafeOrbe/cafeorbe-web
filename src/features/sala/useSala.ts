import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import { refrescarSaldo } from '../../shared/ui/SaldoOrbes'
import { SalaSocket } from '../../shared/ws/salaSocket'
import { desfaseConElServidor } from './reloj'
import { estadoInicial, salaReducer } from './salaReducer'

/**
 * Estado en vivo de una sala. Carga el detalle por REST al entrar y abre el WebSocket; cada vez que este se
 * conecta (o se reconecta) vuelve a pedir el detalle: así no se pierde ninguna puja ocurrida mientras la
 * conexión estaba caída.
 */
export function useSala(subastaId: string, token: string) {
  const [estado, dispatch] = useReducer(salaReducer, estadoInicial)
  const socket = useRef<SalaSocket | null>(null)

  const recargar = useCallback(async () => {
    try {
      const enviadoEn = Date.now()
      let recibidoEn = enviadoEn
      const [detalle, transmision] = await Promise.all([
        api.detalle(subastaId).then((d) => {
          recibidoEn = Date.now()
          return d
        }),
        api.estadoTransmision(subastaId).catch(() => ({ transmitiendo: false, sala: '' })),
      ])
      // HU-17: la hora del servidor corresponde, más o menos, a la mitad del viaje de la petición.
      const desfaseMs = desfaseConElServidor(detalle.horaServidor, (enviadoEn + recibidoEn) / 2)
      dispatch({ tipo: 'DETALLE', detalle, desfaseMs })
      dispatch({ tipo: 'TRANSMISION', activa: transmision.transmitiendo })
    } catch (e) {
      // La subasta no existe: el realtime-gateway rechaza la conexión, no tiene sentido seguir reintentando.
      if (e instanceof ApiError && e.status === 404) socket.current?.cerrar()
      dispatch({ tipo: 'ERROR_DE_CARGA', mensaje: e instanceof Error ? e.message : 'No se pudo cargar la sala' })
    }
  }, [subastaId])

  useEffect(() => {
    // HU-05: la sala no espera al WebSocket para mostrar el lote. Si el realtime-gateway no responde o rechaza
    // la conexión, se ve el lote (o el error) en lugar de quedarse cargando.
    void recargar()
    const s = new SalaSocket(subastaId, token, {
      mensaje: (mensaje) => {
        dispatch({ tipo: 'MENSAJE', mensaje })
        // HU-20: tras el cierre el saldo del ganador cambia. El aviso del cobro llega solo a él; el cierre llega
        // a todos un instante antes de que wallet cobre, por eso se vuelve a consultar poco después.
        if (mensaje.tipo === 'ORBES_COBRADOS') refrescarSaldo()
        if (mensaje.tipo === 'SUBASTA_CERRADA') window.setTimeout(refrescarSaldo, 2000)
      },
      estado: (conexion) => {
        dispatch({ tipo: 'CONEXION', estado: conexion })
        if (conexion === 'abierta') void recargar()
      },
    })
    socket.current = s
    s.conectar()
    return () => {
      s.cerrar()
      socket.current = null
    }
  }, [subastaId, token, recargar])

  /** HU-13: envía la puja rápida por el WebSocket. El resultado llega como evento a la sala. */
  const pujar = useCallback((monto: number) => socket.current?.enviar({ tipo: 'PUJAR', monto }) ?? false, [])
  const limpiarAviso = useCallback(() => dispatch({ tipo: 'LIMPIAR_AVISO' }), [])
  const limpiarExtension = useCallback(() => dispatch({ tipo: 'LIMPIAR_EXTENSION' }), [])

  return { estado, pujar, recargar, limpiarAviso, limpiarExtension, dispatch }
}
