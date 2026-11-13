# Pipeline `ci.yml`

Ejecuta typecheck, build, pruebas con cobertura y el Quality Gate de Sonar. Este repositorio **no despliega**: Vercel publica el sitio estático.

## Secretos

| Nombre | Tipo | Uso |
| --- | --- | --- |
| `SONAR_TOKEN` | secreto de organización | Quality Gate |

## Variables de Vercel

Se leen en tiempo de compilación; un cambio exige volver a desplegar.

| Nombre | Uso |
| --- | --- |
| `VITE_API_URL` | URL del api-gateway |
| `VITE_WS_URL` | URL del realtime-gateway |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google; es público y queda incrustado en el bundle |

No configures `client_secret` en el frontend: el flujo usa el ID token y el backend lo valida con las claves públicas de Google.
