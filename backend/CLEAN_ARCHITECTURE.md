# Clean Architecture

## Capas

- `src/modules/<feature>/domain`
  Contiene entidades y contratos del negocio que no dependen de Nest, Prisma o detalles de infraestructura.

- `src/modules/<feature>/application`
  Contiene casos de uso y servicios de aplicacion. Orquesta reglas del negocio a traves de puertos.

- `src/modules/<feature>/infrastructure`
  Implementa detalles tecnicos concretos como repositorios Prisma o integraciones externas.

- `src/modules/<feature>/presentation`
  Expone controladores, DTOs, guards y adaptadores HTTP.

- `src/shared`
  Aloja piezas transversales reutilizables como `PrismaService`, tipos HTTP compartidos y utilidades.

## Regla principal

Las dependencias deben apuntar hacia adentro:

`presentation -> application -> domain`

La infraestructura implementa puertos definidos por la aplicacion o el dominio, pero no debe contener reglas del negocio.

## Estado actual

- `auth` ya usa Clean Architecture completa.
- `core`, `public` y `whatsapp` ya fueron separados por modulo para salir de la estructura plana previa.
- El siguiente paso recomendado es dividir `core` en features pequenas:
  - `clients`
  - `equipment`
  - `orders`
  - `inventory`
  - `settings`

## Convencion sugerida

Cuando agreguemos una nueva feature, usar esta base:

```text
src/modules/<feature>/
  domain/
  application/
  infrastructure/
  presentation/
  <feature>.module.ts
```
