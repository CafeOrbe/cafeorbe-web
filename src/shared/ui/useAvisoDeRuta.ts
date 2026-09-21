import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAvisos } from './Avisos'

/** Muestra una sola vez el aviso que dejó una redirección (por ejemplo "No autorizado"). */
export function useAvisoDeRuta() {
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const { mostrar } = useAvisos()

  useEffect(() => {
    const aviso = (ubicacion.state as { aviso?: string } | null)?.aviso
    if (aviso) {
      mostrar(aviso, 'error')
      navegar(ubicacion.pathname, { replace: true, state: null })
    }
  }, [ubicacion, navegar, mostrar])
}
