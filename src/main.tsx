import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ProveedorSesion } from './shared/session'
import { ProveedorAvisos } from './shared/ui/Avisos'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAvisos>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </ProveedorAvisos>
    </BrowserRouter>
  </StrictMode>,
)
