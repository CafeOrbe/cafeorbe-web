import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Rol } from '../api/types'
import { rutaInicio, rutas } from '../routes'
import { useSesion } from '../session'
import { Layout } from './Layout'

/** Solo con sesión activa. Sin sesión (por ejemplo tras Cerrar sesión y pulsar Atrás) vuelve al acceso. */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  const ubicacion = useLocation()
  if (!usuario) return <Navigate to={rutas.login} replace state={{ desde: ubicacion.pathname }} />
  return <Layout>{children}</Layout>
}

/** Solo para un rol. Otro rol vuelve a su propio home con el aviso "No autorizado" (HU-03). */
export function RequiereRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario } = useSesion()
  const ubicacion = useLocation()
  if (!usuario) return <Navigate to={rutas.login} replace state={{ desde: ubicacion.pathname }} />
  if (usuario.rol !== rol) return <Navigate to={rutaInicio(usuario.rol)} replace state={{ aviso: 'No autorizado' }} />
  return <Layout>{children}</Layout>
}
