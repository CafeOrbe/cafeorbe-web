import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin `globals: true` Testing Library no se limpia sola: cada prueba debe empezar con el documento vacío.
afterEach(() => {
  if (typeof document === 'undefined') return
  cleanup()
  sessionStorage.clear()
})
