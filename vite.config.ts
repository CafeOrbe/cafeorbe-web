import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      // lcov no viene entre los reporters por defecto de Vitest; sin él SonarCloud deja de
      // importar la cobertura y no falla, solo reporta 0%.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
