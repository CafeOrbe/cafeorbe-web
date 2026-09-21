import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api } from '../../shared/api/endpoints'
import { SalaSocket } from '../../shared/ws/salaSocket'
import { estadoInicial, salaReducer } from './salaReducer'

/**
 * Estado en vivo de una sala. Abre el WebSocket y, cada vez que se conecta (o se reconecta), vuelve a pedir
 * el detalle por REST: así no se pierde ninguna puja ocurrida mientras la conexión estaba caída.
 */
export function useSala(subastaId: string, token: string) {
  const [estado, dispatch] = useReducer(salaReducer, estadoInicial)
  const socket = useRef<SalaSocket | null>(null)

  const recargar = useCallback(async () => {
    try {
      const [detalle, transmision] = await Promise.all([
        api.detalle(subastaId),
        api.estadoTransmision(subastaId).catch(() => ({ transmitiendo: false, sala: '' })),
      ])
      dispatch({ tipo: 'DETALLE', detalle })
      dispatch({ tipo: 'TRANSMISION', activa: transmision.transmitiendo })
    } catch (e) {
      dispatch({ tipo: 'ERROR_DE_CARGA', mensaje: e instanceof Error ? e.message : 'No se pudo cargar la sala' })
    }
  }, [subastaId])

  useEffect(() => {
    const s = new SalaSocket(subastaId, token, {
      mensaje: (mensaje) => {
        dispatch({ tipo: 'MENSAJE', mensaje })
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

  return { estado, pujar, recargar, limpiarAviso, dispatch }
}
