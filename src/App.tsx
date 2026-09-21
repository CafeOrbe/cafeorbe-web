import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { HomeCompradorPage } from './features/home/HomeCompradorPage'
import { HomeSubastadorPage } from './features/home/HomeSubastadorPage'
import { ResultadosPage } from './features/resultados/ResultadosPage'
import { SalaPage } from './features/sala/SalaPage'
import { CrearSubastaPage } from './features/subasta/CrearSubastaPage'
import { GestionSubastaPage } from './features/subasta/GestionSubastaPage'
import { MisSubastasPage } from './features/subasta/MisSubastasPage'
import { rutaInicio, rutas } from './shared/routes'
import { useSesion } from './shared/session'
import { RequiereRol, RequiereSesion } from './shared/ui/Guardas'

export function App() {
  const { usuario } = useSesion()

  return (
    <Routes>
      <Route path={rutas.login} element={<LoginPage />} />

      {/* Subastador (HU-03, HU-08 a HU-10, HU-12) */}
      <Route path="/subastador" element={<RequiereRol rol="SUBASTADOR"><HomeSubastadorPage /></RequiereRol>} />
      <Route path={rutas.misSubastas} element={<RequiereRol rol="SUBASTADOR"><MisSubastasPage /></RequiereRol>} />
      <Route path={rutas.crearSubasta} element={<RequiereRol rol="SUBASTADOR"><CrearSubastaPage /></RequiereRol>} />
      <Route path="/subastador/subastas/:id" element={<RequiereRol rol="SUBASTADOR"><GestionSubastaPage /></RequiereRol>} />

      {/* Comprador (HU-04) */}
      <Route path="/comprador" element={<RequiereRol rol="COMPRADOR"><HomeCompradorPage /></RequiereRol>} />

      {/* Ambos roles (HU-05) */}
      <Route path="/subastas/:id/sala" element={<RequiereSesion><SalaPage /></RequiereSesion>} />
      <Route path="/subastas/:id/resultados" element={<RequiereSesion><ResultadosPage /></RequiereSesion>} />

      <Route path="*" element={<Navigate to={usuario ? rutaInicio(usuario.rol) : rutas.login} replace />} />
    </Routes>
  )
}
