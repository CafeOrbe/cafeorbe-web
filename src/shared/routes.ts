import type { Rol } from './api/types'

export function rutaInicio(rol: Rol): string {
  return rol === 'SUBASTADOR' ? '/subastador' : '/comprador'
}

export const rutas = {
  login: '/login',
  crearSubasta: '/subastador/subastas/nueva',
  misSubastas: '/subastador/subastas',
  gestionar: (id: string) => `/subastador/subastas/${id}`,
  sala: (id: string) => `/subastas/${id}/sala`,
  resultados: (id: string) => `/subastas/${id}/resultados`,
}
