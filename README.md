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

---

## Análisis del Sistema

### Tabla 1. Matriz Diagnóstica

| Problema | Causa | Efecto | Área Afectada | Tipo de Problema |
|---|---|---|---|---|
| Gestión manual de órdenes de reparación | Uso de formularios en papel o registros informales | Pérdida de información y errores en el historial del equipo | Recepción / Taller | Operativo |
| Falta de trazabilidad del estado de cada equipo | No existe sistema de seguimiento de estados automatizado | El cliente desconoce el avance real de su reparación | Dirección / Atención al cliente | Control |
| Asignación de órdenes sin control de roles | Acceso indiscriminado a todos los módulos | Riesgo de modificación o eliminación no autorizada de datos | Administración / Sistemas | Seguridad |
| Documentos físicos de presupuestos y pagos | Manejo físico de comprobantes y cotizaciones | Falta de historial financiero confiable y auditable | Administración / Contabilidad | Información |
| Procesos de recepción y entrega lentos | Revisión y llenado manual de formularios | Retrasos en atención al cliente y cuellos de botella | Recepción | Productividad |
| Dificultad para generar reportes de gestión | No existe sistema digital centralizado | Decisiones directivas basadas en información incompleta | Dirección | Gestión |
| Comunicación ineficiente con el cliente | Sin notificaciones automáticas de avance o entrega | Incumplimiento de promesas de entrega y baja satisfacción | Atención al cliente | Control |
| Baja modernización tecnológica del taller | Falta de inversión e implementación de TIC | Procesos desactualizados frente a la competencia | Institucional | Estratégico |
| Falta de respaldo de información de clientes y equipos | Sin copias digitales ni sistema de base de datos | Riesgo de pérdida total de datos ante incidentes | Sistemas | Seguridad |
| Control de inventario de repuestos inexistente | Registro manual o sin registro de stock | Desabastecimiento o compras duplicadas innecesarias | Almacén / Taller | Operativo |

---

### Tabla 2. Matriz de Priorización de Problemas

| Problema | Poco Importante | Medianamente Importante | Bastante Importante | Muy Importante |
|---|:---:|:---:|:---:|:---:|
| Gestión manual de órdenes de reparación | | | | ✅ |
| Falta de trazabilidad del estado de cada equipo | | | ✅ | |
| Asignación de órdenes sin control de roles | | | | ✅ |
| Documentos físicos de presupuestos y pagos | | | ✅ | |
| Procesos de recepción y entrega lentos | | | ✅ | |
| Dificultad para generar reportes de gestión | | | ✅ | |
| Comunicación ineficiente con el cliente | | | | ✅ |
| Baja modernización tecnológica del taller | | ✅ | | |
| Falta de respaldo de información de clientes y equipos | | | ✅ | |
| Control de inventario de repuestos inexistente | | | ✅ | |

---

### Tabla 3. Matriz de Objetivos del Sistema

**Objetivo General:**  
Desarrollar e implementar una plataforma digital integral de gestión operativa y control administrativo para talleres electrónicos, que automatice los procesos de recepción de equipos, seguimiento de órdenes de reparación, comunicación con el cliente y gestión de inventario de repuestos, incrementando la eficiencia, trazabilidad y seguridad de la información en el taller.

| Problema | Objetivo Específico | Indicador | Resultado Esperado |
|---|---|---|---|
| Gestión manual de órdenes de reparación | Automatizar la creación y seguimiento de órdenes con código único (`ORD-YYYY-NNNNN`) | % de órdenes generadas digitalmente | Eliminación del registro manual de órdenes |
| Falta de trazabilidad del estado de cada equipo | Implementar historial de estados en tiempo real para cada orden | Tiempo de actualización de estado | Control inmediato del avance de cada reparación |
| Asignación de órdenes sin control de roles | Establecer sistema de roles (ADMIN, RECEPCIONISTA, TÉCNICO) con permisos diferenciados | Número de accesos no autorizados detectados | Reducción de riesgos de seguridad y manipulación de datos |
| Documentos físicos de presupuestos y pagos | Digitalizar presupuestos y registro de pagos vinculados a cada orden | % de presupuestos y pagos registrados digitalmente | Base de datos financiera segura y auditable |
| Procesos de recepción y entrega lentos | Optimizar el flujo de recepción mediante formularios digitales y ticket PDF con QR | Tiempo promedio de registro de una orden | Mayor eficiencia en la atención al cliente |
| Dificultad para generar reportes de gestión | Implementar dashboard operativo con reportes automáticos por período y técnico | Número de reportes generados automáticamente | Mejores decisiones directivas basadas en datos reales |
| Comunicación ineficiente con el cliente | Integrar notificaciones automáticas por WhatsApp Web al cambiar el estado de la orden | % de clientes notificados automáticamente | Mayor satisfacción y reducción de consultas presenciales |
| Baja modernización tecnológica del taller | Implementar plataforma web full-stack con React, NestJS y PostgreSQL | Nivel de adopción del sistema por el personal | Modernización institucional y ventaja competitiva |
| Falta de respaldo de información de clientes y equipos | Centralizar datos en base de datos PostgreSQL con respaldos y RLS habilitado | Número de copias de seguridad realizadas | Seguridad y disponibilidad de la información |
| Control de inventario de repuestos inexistente | Desarrollar módulo de inventario básico de repuestos con alertas de stock | % de repuestos registrados en el sistema | Reducción de desabastecimiento y compras duplicadas |

