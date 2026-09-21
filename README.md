# cafeorbe-web

Cliente web de CaféOrbe. **Arquitectura:** SPA organizada por funcionalidades (React + Vite + TypeScript). Puerto `5173`.

```text
src/features/auth        acceso con nombre y rol            (HU-01)
src/features/home        home del Subastador y del Comprador (HU-03, HU-04, HU-07)
src/features/subasta     crear, ficha, reglas, iniciar       (HU-08 a HU-10, HU-12)
src/features/sala        sala en vivo: puja, video, líder    (HU-05, HU-06, HU-11, HU-13; parte de HU-15 y HU-16)
src/features/resultados  destino de una subasta finalizada   (mínimo; el resto es Sprint 2)
src/shared               cliente REST único, cliente WebSocket único, sesión, validadores, UI
```

- **Cerrar sesión** (HU-02) está en la barra superior de toda pantalla autenticada; borra la sesión y las rutas protegidas devuelven al acceso, así que **Atrás** no reabre la sesión.
- La sesión vive en `sessionStorage` (por pestaña). Un 401 del servidor la cierra sola.
- La sala abre el WebSocket **primero** y luego carga el detalle por REST (también al reconectar), para no perder pujas.
- El video usa `livekit-client`, cargado de forma diferida al entrar a una sala.

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:5173  (API en :8080, WebSocket en :8085; ver .env.example)
npm test             # 22 pruebas de validadores, formato y el reducer de la sala
npm run build        # typecheck + build de producción
```

## Decisiones a confirmar con el Product Owner

- **Botón de puja y saldo (HU-13):** el criterio de la tarea dice que el botón se deshabilita si no hay saldo, pero el escenario Gherkin dice que se pulsa y el sistema responde `Orbes insuficientes`. Se implementó el Gherkin: el botón solo se bloquea siendo líder o si la subasta no está en curso.
- **Primera puja:** la puja mínima es *precio actual + incremento* también al inicio (precio base 100, incremento 10 → primera puja 110), como en los ejemplos del backlog.
