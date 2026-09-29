# API de peticiones Amonra

Backend independiente en NestJS. Recibe peticiones del sitio, las guarda en MongoDB Atlas, confirma el correo mediante el microservicio de email existente y ofrece consulta de estado y endpoints protegidos para administración.

## Ejecutar localmente

```sh
cd backend
npm ci
cp .env.example .env
# Completa las variables de .env
npm run start:dev
```

El API escucha por defecto en `http://localhost:3001/api`. El health check está en `/api/health`.

## Variables necesarias

- `MONGODB_URI`: cadena de conexión de MongoDB Atlas. Autoriza la IP/red del servidor en la lista de acceso de Atlas.
- `EMAIL_SERVICE_API_URL` y `EMAIL_SERVICE_API_KEY`: URL del controlador de email y clave interna del servicio existente. Si la URL termina en `/email`, la API añade `/send`; la clave solo vive en el servidor. También se acepta el nombre anterior `EMAIL_SERVICE_URL`.
- `PUBLIC_SITE_URL`: dirección del sitio; se usa para construir el enlace de confirmación.
- `WEB_ORIGINS`: orígenes web exactos permitidos, separados por coma. Incluye desarrollo y producción según corresponda.
- `ADMIN_PASSWORD`: contraseña del único administrador inicial.
- `SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres para firmar la sesión.
- `PORT`, `NODE_ENV`, `COOKIE_SAME_SITE` y `TRUST_PROXY`: opciones de ejecución. Si API y web tienen dominios distintos, configura `COOKIE_SAME_SITE=none` y usa HTTPS.

El frontend estático se configura durante su build con `PUBLIC_API_BASE_URL` (por ejemplo `http://localhost:3001` o `https://api.tudominio.cl`). Déjalo vacío si un proxy del alojamiento publica la API bajo el mismo origen.

## Flujo

1. `POST /api/peticiones` valida y guarda la petición como `pending_confirmation`.
2. Envía al correo un enlace de un solo uso que vence en 24 horas y una referencia más una clave privada de seguimiento. En MongoDB se guardan hashes de esos tokens.
3. `POST /api/peticiones/confirmar` valida el enlace y pasa la petición a `received`.
4. `POST /api/peticiones/estado` requiere la referencia y la clave privada; devuelve solo estado y fechas.
5. La sesión de administración da acceso a `GET /api/admin/peticiones` y `PATCH /api/admin/peticiones/:reference`. Los estados permitidos para gestión son `received`, `completed` y `cancelled`.

## Rutas del API

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/health` | Público |
| `POST` | `/api/peticiones` | Público |
| `POST` | `/api/peticiones/confirmar` | Público, token de confirmación |
| `POST` | `/api/peticiones/reenviar` | Público, referencia, correo y clave de seguimiento |
| `POST` | `/api/peticiones/estado` | Público, referencia y clave de seguimiento |
| `POST` | `/api/admin/login` | Público, contraseña de administrador |
| `POST` | `/api/admin/logout` | Sesión de administrador |
| `GET` | `/api/admin/peticiones?status=all` | Sesión de administrador |
| `PATCH` | `/api/admin/peticiones/:reference` | Sesión de administrador |

La administración autentica con una cookie `HttpOnly`; ninguna clave privada del backend se entrega al navegador.
