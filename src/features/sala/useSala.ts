import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/client'
import { refrescarSaldo } from '../../shared/ui/SaldoOrbes'
import { SalaSocket } from '../../shared/ws/salaSocket'
import { desfaseConElServidor } from './reloj'
import { estadoInicial, salaReducer } from './salaReducer'

/** Cada cuánto se compara la sala con el servidor mientras la subasta está en curso, por si se perdió un evento. */
const RESINCRONIZAR_CADA_MS = 60_000

/**
 * Estado en vivo de una sala. Carga el detalle por REST al entrar y abre el WebSocket; cada vez que este se
 * conecta (o se reconecta) vuelve a pedir el detalle: así no se pierde ninguna puja ocurrida mientras la
 * conexión estaba caída.
 */
export function useSala(subastaId: string, token: string) {
  const [estado, dispatch] = useReducer(salaReducer, estadoInicial)
  const socket = useRef<SalaSocket | null>(null)
  // Pujas que la sala ya conoce, para notar un salto sin depender de un render.
  const pujasConocidas = useRef<number | null>(null)
  pujasConocidas.current = estado.detalle?.cantidadPujas ?? null

  const recargar = useCallback(async () => {
    try {
      const enviadoEn = Date.now()
      let recibidoEn = enviadoEn
      const [detalle, transmision] = await Promise.all([
        api.detalle(subastaId).then((d) => {
          recibidoEn = Date.now()
          return d
        }),
        // Si la consulta falla no se sabe si hay transmisión: se conserva lo que la sala ya mostraba. Tratarlo
        // como "sin transmisión" le cortaba el video al comprador por un fallo momentáneo de red.
        api.estadoTransmision(subastaId).catch(() => null),
      ])
      // HU-17: la hora del servidor corresponde, más o menos, a la mitad del viaje de la petición.
      const desfaseMs = desfaseConElServidor(detalle.horaServidor, (enviadoEn + recibidoEn) / 2)
      dispatch({ tipo: 'DETALLE', detalle, desfaseMs })
      if (transmision) dispatch({ tipo: 'TRANSMISION', activa: transmision.transmitiendo })
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
        // Cada puja aceptada trae cuántas van. Si salta más de una, se perdió alguna en el camino: se pide el
        // estado completo en lugar de mostrar un historial con huecos.
        if (mensaje.tipo === 'PUJA_ACEPTADA' && pujasConocidas.current !== null) {
          const van = Number(mensaje.datos.cantidadPujas)
          if (van > pujasConocidas.current + 1) void recargar()
          // Dos mensajes pueden llegar antes del siguiente render: la cuenta se lleva aquí mismo.
          pujasConocidas.current = Math.max(pujasConocidas.current, van)
        }
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

  // Red de seguridad: un evento que se pierde entre el servidor y el navegador (inicio o fin de la transmisión,
  // una extensión de tiempo) no vuelve a enviarse. Mientras la subasta está en curso la sala se compara con el
  // servidor cada minuto; el intervalo es largo y con un desfase al azar para no cargar al servidor con muchos
  // compradores conectados.
  const enCurso = estado.detalle?.estado === 'EN_CURSO'
  useEffect(() => {
    if (!enCurso) return
    const cada = RESINCRONIZAR_CADA_MS + Math.floor(Math.random() * 15_000)
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recargar()
    }, cada)
    return () => window.clearInterval(t)
  }, [enCurso, recargar])

  /** HU-13: envía la puja rápida por el WebSocket. El resultado llega como evento a la sala. */
  const pujar = useCallback((monto: number) => socket.current?.enviar({ tipo: 'PUJAR', monto }) ?? false, [])
  const limpiarAviso = useCallback(() => dispatch({ tipo: 'LIMPIAR_AVISO' }), [])
  const limpiarExtension = useCallback(() => dispatch({ tipo: 'LIMPIAR_EXTENSION' }), [])

  return { estado, pujar, recargar, limpiarAviso, limpiarExtension, dispatch }
}
