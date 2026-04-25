# Plataforma Digital de Gestion Operativa para el Fortalecimiento del Control Administrativo en Talleres Electronicos

Sistema web full-stack para administrar talleres electronicos: clientes, equipos, ordenes de reparacion, estados, presupuestos, pagos, inventario basico, ticket PDF con QR, rastreo publico y envio de WhatsApp con `whatsapp-web.js`.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend: NestJS, TypeScript, Prisma.
- Base de datos: PostgreSQL.
- WhatsApp: `whatsapp-web.js` y `qrcode-terminal`.
- Contenedores: Docker Compose.

## Arranque local recomendado

1. Levantar PostgreSQL:

```bash
docker compose up -d postgres
```

2. Crear tablas y datos iniciales:

```bash
cd backend
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run security:db:local
```

3. Iniciar backend:

```bash
npm run start:dev
```

4. Iniciar frontend en otra terminal:

```bash
cd frontend
npm run dev
```

Credenciales iniciales:

- Usuario: `admin`
- Contrasena: `Admin123*`

## Seguridad aplicada

- `Row Level Security (RLS)` en PostgreSQL con rol runtime separado del rol administrador.
- `CORS` restringido por la variable `FRONTEND_URLS`.
- `Security Headers` mediante `helmet`.

Variables nuevas del backend:

- `APP_DATABASE_URL`: conexion runtime del backend. Debe usar el rol restringido.
- `DB_APP_USER`: nombre del rol runtime que se crea/aplica en PostgreSQL.
- `DB_APP_PASSWORD`: password del rol runtime.
- `NODE_ENV`: usa `development` en local y `production` en despliegue.

Comandos utiles:

```bash
cd backend
npm run security:db:local
npm run security:db:prod
```

## WhatsApp

Desde el panel WhatsApp presione `Iniciar QR`. El backend imprimira el QR en la terminal. En el telefono, abrir WhatsApp, ir a dispositivos vinculados y escanear el QR para agregarlo como dispositivo secundario.

Tambien puede iniciar una terminal dedicada solo para el QR:

```bash
cd backend
npm run whatsapp:qr
```

## Docker completo

```bash
docker compose up --build
```

El contenedor de backend sincroniza el esquema y ejecuta la semilla automaticamente al iniciar.

URLs:

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- PostgreSQL: localhost:55432

## Modulos incluidos

- Login JWT y roles iniciales: ADMIN, RECEPCIONISTA, TECNICO.
- Dashboard operativo.
- Clientes.
- Equipos y tipos de equipos.
- Tipos de falla.
- Ordenes de reparacion con codigo `ORD-YYYY-00001` y token.
- Historial de estados.
- Presupuesto por orden.
- Registro de pagos.
- Ticket PDF con QR.
- Rastreo publico sin login.
- Inventario basico de repuestos.
- WhatsApp Web con QR por terminal.
