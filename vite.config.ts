import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
    // Las pruebas de componentes (.test.tsx) piden jsdom con su propia cabecera `@vitest-environment`;
    // las de lógica pura siguen corriendo en node.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    // La primera prueba de cada archivo carga jsdom, React y los íconos: en un runner de CI con pocos núcleos
    // y cobertura activada puede pasar de los 5 s por defecto sin que nada esté fallando.
    testTimeout: 20_000,
    coverage: {
      // lcov no viene entre los reporters por defecto de Vitest; sin él SonarCloud deja de
      // importar la cobertura y no falla, solo reporta 0%.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      // main.tsx solo monta la aplicación en el navegador: probarlo sería levantar todo sin comprobar nada.
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**', 'src/main.tsx'],
    },
  },
})
