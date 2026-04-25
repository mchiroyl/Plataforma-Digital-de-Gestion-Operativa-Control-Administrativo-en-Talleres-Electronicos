# Diagrama de procesos operativos del sistema

Proyecto: Plataforma Digital de Gestion Operativa para el Fortalecimiento del Control Administrativo en Talleres Electronicos.

Este documento describe los procesos principales del sistema usando diagramas Mermaid y pasos operativos. Sirve como guia para validar si la logica funcional actual coincide con la operacion real del taller.

## Roles involucrados

- `ADMIN`: administra el sistema y puede operar todos los modulos actuales.
- `RECEPCIONISTA`: registra clientes, equipos, ordenes, tickets, pagos, ventas y comunicacion con cliente.
- `TECNICO`: revisa equipos, registra diagnostico, presupuesto y avance de reparacion.
- `CLIENTE`: entrega equipo, recibe ticket, consulta rastreo, acepta o rechaza presupuesto y paga.

## Proceso general de una reparacion

```mermaid
flowchart TD
    A["Cliente llega al taller"] --> B["Recepcionista busca o registra cliente"]
    B --> C["Recepcionista busca o registra equipo"]
    C --> D["Recepcionista crea orden de reparacion"]
    D --> E["Registra problema reportado por el cliente"]
    E --> F["Marca fallas de clasificacion"]
    F --> G{"Falla requiere clave?"}
    G -- "Si" --> H["Registrar PIN, contrasena o patron"]
    G -- "No" --> I["Continuar sin datos de desbloqueo"]
    H --> J["Generar ticket con QR"]
    I --> J
    J --> K{"Cliente tiene WhatsApp disponible?"}
    K -- "Si" --> L["Preparar mensaje de rastreo por WhatsApp"]
    K -- "No" --> M["Entregar ticket impreso con QR"]
    L --> N["Tecnico recibe orden"]
    M --> N
    N --> O["Tecnico realiza pruebas y diagnostico"]
    O --> P["Registra diagnostico tecnico y fallas nuevas"]
    P --> Q{"Cliente esta presente?"}
    Q -- "Si" --> R["Informar diagnostico personalmente"]
    Q -- "No" --> S{"Tiene WhatsApp?"}
    S -- "Si" --> T["Preparar WhatsApp de diagnostico"]
    S -- "No" --> U["Cliente consulta por QR/rastreo o se le informa al regresar"]
    R --> V["Tecnico registra presupuesto"]
    T --> V
    U --> V
    V --> W["Cliente acepta o rechaza presupuesto"]
    W -- "Acepta" --> X["Sistema pasa orden a reparacion"]
    X --> Y["Consumir repuestos del inventario si fueron seleccionados"]
    Y --> Z["Tecnico realiza reparacion"]
    Z --> AA["Marcar listo para recoger"]
    AA --> AB["Registrar pago"]
    AB --> AC{"Saldo pendiente?"}
    AC -- "Si" --> AB
    AC -- "No" --> AD["Finalizar entrega"]
    W -- "Rechaza" --> AE["Orden queda como presupuesto rechazado"]
    AE --> AF["Definir devolucion sin reparar o nuevo presupuesto"]
```

## Registro de cliente

```mermaid
flowchart TD
    A["Abrir modulo Clientes"] --> B{"Cliente ya existe?"}
    B -- "Si" --> C["Editar si hay datos desactualizados"]
    B -- "No" --> D["Registrar nombres y apellidos"]
    D --> E["Registrar telefono si tiene disponible"]
    E --> F["Registrar DPI/NIT si aplica"]
    F --> G["Guardar cliente"]
    C --> H["Cliente disponible para ordenes o ventas"]
    G --> H
```

Reglas:

- El telefono puede quedar como no disponible si el equipo danado es el telefono personal del cliente.
- Los textos se normalizan a mayusculas.
- DPI y NIT ayudan a evitar duplicados.

## Registro de equipo

```mermaid
flowchart TD
    A["Abrir modulo Equipos"] --> B["Seleccionar cliente propietario"]
    B --> C["Seleccionar tipo de equipo"]
    C --> D["Registrar marca y modelo"]
    D --> E["Registrar serie o IMEI si existe"]
    E --> F["Registrar color"]
    F --> G["Registrar estado fisico"]
    G --> H["Registrar accesorios incluidos"]
    H --> I["Guardar equipo"]
    I --> J["Equipo queda disponible para crear orden"]
```

Reglas:

- Estado fisico y accesorios deben registrarse al recibir el equipo.
- Esto evita reclamos posteriores.

## Creacion de orden

```mermaid
flowchart TD
    A["Abrir modulo Ordenes"] --> B["Seleccionar cliente"]
    B --> C["Seleccionar equipo"]
    C --> D["Seleccionar tecnico opcional"]
    D --> E["Registrar problema reportado por el cliente"]
    E --> F["Marcar fallas de clasificacion"]
    F --> G{"Existe una falla que no esta en checks?"}
    G -- "Si" --> H["Registrar falla adicional no listada"]
    G -- "No" --> I["Continuar"]
    H --> J{"Alguna falla requiere clave?"}
    I --> J
    J -- "Si" --> K["Registrar tipo de clave y valor exacto"]
    J -- "No" --> L["Guardar orden"]
    K --> L
    L --> M["Sistema genera codigo ORD-YYYY-00001"]
    M --> N["Sistema genera token de rastreo"]
    N --> O["Imprimir ticket con QR"]
    O --> P{"Cliente tiene WhatsApp?"}
    P -- "Si" --> Q["Preparar mensaje de rastreo"]
    P -- "No" --> R["Entregar ticket impreso"]
```

Campos clave:

- Problema reportado: relato libre del cliente.
- Fallas: clasificacion rapida mediante checks.
- Falla adicional: cuando la falla no esta en la lista.
- Datos de desbloqueo: solo cuando la revision lo necesita.

## Registro de datos de desbloqueo

```mermaid
flowchart TD
    A["Marcar falla que requiere clave"] --> B["Sistema muestra bloque de desbloqueo"]
    B --> C["Seleccionar tipo de clave"]
    C --> D{"Tipo seleccionado"}
    D -- "PIN" --> E["Registrar numeros exactos"]
    D -- "CONTRASENA" --> F["Registrar contrasena exacta respetando mayusculas y minusculas"]
    D -- "PATRON" --> G["Registrar patron usando posiciones 1 a 9"]
    D -- "NO DEJO CLAVE" --> H["Guardar sin valor de clave"]
    E --> I["Guardar en orden"]
    F --> I
    G --> I
    H --> I
```

Referencia para patron:

```text
1 2 3
4 5 6
7 8 9
```

Ejemplo:

`1-2-5-9`

Nota:

- La clave exacta no se normaliza a mayusculas porque una contrasena puede depender de mayusculas y minusculas.

## Ticket con QR y rastreo publico

```mermaid
flowchart TD
    A["Orden creada"] --> B["Generar ticket con QR"]
    B --> C["Cliente recibe ticket impreso"]
    C --> D["Cliente escanea QR"]
    D --> E["Rastreo publico sin login"]
    E --> F["Ver estado de orden"]
    E --> G["Ver diagnostico tecnico"]
    E --> H["Ver presupuesto"]
    H --> I{"Presupuesto pendiente de decision?"}
    I -- "Si" --> J["Cliente acepta o rechaza"]
    I -- "No" --> K["Cliente solo consulta informacion"]
```

El ticket incluye:

- Codigo de orden.
- Datos del cliente.
- Datos del equipo.
- Problema reportado.
- Fallas marcadas.
- Falla adicional.
- Diagnostico.
- Datos de desbloqueo.
- QR de rastreo.
- Terminos y firmas.

## Diagnostico tecnico

```mermaid
flowchart TD
    A["Tecnico abre orden"] --> B["Marca orden en revision"]
    B --> C["Realiza pruebas fisicas/electronicas/software"]
    C --> D["Detecta hallazgos reales"]
    D --> E["Registra diagnostico tecnico"]
    E --> F{"Hay fallas nuevas?"}
    F -- "Si" --> G["Registra fallas nuevas detectadas"]
    F -- "No" --> H["Mantiene diagnostico"]
    G --> I["Guardar diagnostico"]
    H --> I
    I --> J{"Cliente presente?"}
    J -- "Si" --> K["Informar personalmente"]
    J -- "No" --> L{"Cliente tiene WhatsApp?"}
    L -- "Si" --> M["Preparar WhatsApp diagnostico"]
    L -- "No" --> N["Cliente consulta por QR/rastreo o se informa al regresar"]
```

Ejemplo operativo:

- Cliente reporta: `SE MOJO, NO CARGA, NO ENCIENDE`.
- Tecnico prueba carga y logra encenderlo.
- Luego detecta: `HUMEDAD DANO PANTALLA`.
- Se registra diagnostico y se informa al cliente antes de presupuestar o continuar.

## Presupuesto tecnico

```mermaid
flowchart TD
    A["Diagnostico registrado"] --> B["Tecnico agrega detalle de presupuesto"]
    B --> C{"Tipo de detalle"}
    C -- "Mano de obra" --> D["Registrar descripcion, cantidad y precio"]
    C -- "Repuesto" --> E{"Sale de inventario?"}
    E -- "Si" --> F["Seleccionar repuesto del inventario"]
    E -- "No" --> G["Registrar como repuesto externo/no controlado"]
    C -- "Otro" --> H["Registrar cargo adicional"]
    D --> I["Agregar detalle"]
    F --> I
    G --> I
    H --> I
    I --> J["Sistema calcula subtotal"]
    J --> K["Sistema recalcula total de presupuesto"]
    K --> L{"Detalle incorrecto?"}
    L -- "Si" --> M["Editar o quitar detalle"]
    M --> K
    L -- "No" --> N["Presupuesto listo para decision del cliente"]
```

Reglas:

- No se aprueba presupuesto sin detalles.
- Se puede editar o quitar detalles antes del consumo de inventario.
- Al modificar presupuesto, la aprobacion vuelve a pendiente.

## Aceptacion o rechazo del presupuesto

```mermaid
flowchart TD
    A["Presupuesto enviado o visible en rastreo"] --> B{"Cliente revisa presupuesto"}
    B -- "Desde QR/rastreo" --> C["Aceptar o rechazar en pagina publica"]
    B -- "Por WhatsApp" --> D["Responde APROBAR o RECHAZAR con codigo de orden"]
    B -- "Presencial" --> E["Autoriza directamente al operador"]
    C --> F{"Decision"}
    D --> F
    E --> F
    F -- "Acepta" --> G["Sistema marca presupuesto aprobado"]
    G --> H["Orden pasa a EN_REPARACION"]
    H --> I["Consumir repuestos de inventario si aplica"]
    F -- "Rechaza" --> J["Orden pasa a PRESUPUESTO_RECHAZADO"]
    J --> K["Definir si se devuelve sin reparar o se replantea presupuesto"]
```

Mensaje sugerido por WhatsApp:

```text
APROBAR ORD-2026-00001
RECHAZAR ORD-2026-00001
```

Nota:

- El sistema no lee automaticamente WhatsApp. El operador debe registrar manualmente la decision si el cliente responde por chat.

## Reparacion y consumo de inventario

```mermaid
flowchart TD
    A["Cliente aprueba presupuesto"] --> B["Orden pasa a EN_REPARACION"]
    B --> C{"Presupuesto contiene repuestos de inventario?"}
    C -- "Si" --> D{"Hay stock suficiente?"}
    D -- "Si" --> E["Descontar stock"]
    D -- "No" --> F["Bloquear aprobacion o consumo e informar falta de stock"]
    C -- "No" --> G["Continuar reparacion sin consumo de inventario"]
    E --> H["Registrar movimiento SALIDA_ORDEN"]
    G --> I["Tecnico realiza reparacion"]
    H --> I
    I --> J["Marcar LISTO_PARA_RECOGER"]
```

Reglas:

- Cotizar no descuenta stock.
- Aprobar presupuesto descuenta stock si el repuesto fue seleccionado desde inventario.
- Repuesto externo/no controlado no descuenta stock.

## Registro de pagos y finalizacion

```mermaid
flowchart TD
    A["Orden lista o en proceso de cobro"] --> B["Registrar pago"]
    B --> C["Seleccionar forma de pago"]
    C --> D["Ingresar monto"]
    D --> E{"Monto valido?"}
    E -- "No" --> F["Mostrar error"]
    E -- "Si" --> G["Guardar pago"]
    G --> H{"Saldo pendiente?"}
    H -- "Si" --> B
    H -- "No" --> I["Marcar listo para recoger si corresponde"]
    I --> J["Finalizar entrega"]
```

Reglas:

- No se aceptan pagos en cero.
- No se permite pagar mas del saldo pendiente.
- No se finaliza orden con saldo pendiente.

## Venta directa de inventario

```mermaid
flowchart TD
    A["Abrir modulo Ventas"] --> B["Seleccionar cliente comprador"]
    B --> C["Seleccionar forma de pago"]
    C --> D["Seleccionar articulo del inventario"]
    D --> E["Ingresar cantidad"]
    E --> F["Ingresar o confirmar precio unitario"]
    F --> G{"Agregar mas articulos?"}
    G -- "Si" --> D
    G -- "No" --> H["Revisar total de venta"]
    H --> I["Registrar venta"]
    I --> J{"Stock suficiente?"}
    J -- "No" --> K["Mostrar error"]
    J -- "Si" --> L["Generar codigo VEN-YYYY-00001"]
    L --> M["Descontar stock"]
    M --> N["Registrar movimiento SALIDA_VENTA"]
    N --> O["Venta queda asociada al cliente"]
```

Reglas:

- La venta directa no se registra desde Inventario.
- Inventario administra articulos.
- Ventas registra salida comercial asociada a cliente.

## Administracion de inventario

```mermaid
flowchart TD
    A["Abrir modulo Inventario"] --> B{"Articulo existe?"}
    B -- "No" --> C["Crear articulo"]
    B -- "Si" --> D["Editar articulo"]
    C --> E["Registrar codigo interno"]
    E --> F["Registrar nombre y categoria"]
    F --> G["Registrar costo y precio de venta"]
    G --> H["Registrar stock actual y minimo"]
    H --> I["Guardar"]
    D --> J["Actualizar datos o stock"]
    J --> I
```

## Comunicacion con cliente

```mermaid
flowchart TD
    A["Necesidad de informar al cliente"] --> B{"Cliente tiene telefono WhatsApp?"}
    B -- "Si" --> C["Preparar mensaje via wa.me"]
    C --> D["Operador revisa y confirma envio manualmente"]
    B -- "No" --> E["Cliente consulta por QR o se informa al regresar"]
    D --> F["Cliente recibe enlace o informacion"]
    F --> G{"Debe tomar decision?"}
    G -- "Si" --> H["Aceptar/rechazar por rastreo o responder por WhatsApp"]
    G -- "No" --> I["Solo queda informado"]
```

Casos de comunicacion:

- Registro de orden.
- Diagnostico tecnico.
- Presupuesto.
- Orden lista para recoger.

## Normalizacion de datos

```mermaid
flowchart TD
    A["Usuario escribe datos"] --> B["Frontend muestra textos en mayusculas"]
    B --> C["Frontend normaliza payload antes de enviar"]
    C --> D["Backend vuelve a normalizar antes de guardar"]
    D --> E["Base de datos queda uniforme"]
    C --> F{"Campo clave exacta?"}
    F -- "Si" --> G["No se convierte a mayusculas"]
    F -- "No" --> D
```

Excepcion:

- Valor exacto de PIN/contrasena/patron (`unlockCredentialValue`) no se transforma, porque una contrasena puede mezclar mayusculas y minusculas.

## Flujo de estados de orden

```mermaid
stateDiagram-v2
    [*] --> CREADO
    CREADO --> EN_REVISION: Tecnico inicia revision
    EN_REVISION --> PRESUPUESTO_ENVIADO: Tecnico registra presupuesto
    PRESUPUESTO_ENVIADO --> EN_REPARACION: Cliente aprueba
    PRESUPUESTO_ENVIADO --> PRESUPUESTO_RECHAZADO: Cliente rechaza
    EN_REPARACION --> LISTO_PARA_RECOGER: Reparacion terminada
    LISTO_PARA_RECOGER --> FINALIZADO: Pago completo y entrega
    PRESUPUESTO_RECHAZADO --> DEVUELTO_SIN_REPARAR: Cliente retira sin reparar
    PRESUPUESTO_RECHAZADO --> EN_REVISION: Se replantea revision o presupuesto
```

## Resumen de responsabilidades por rol

| Procedimiento | ADMIN | RECEPCIONISTA | TECNICO | CLIENTE |
|---|---:|---:|---:|---:|
| Iniciar sesion | Si | Si | Si | No |
| Registrar cliente | Si | Si | No | No |
| Registrar equipo | Si | Si | No | No |
| Crear orden | Si | Si | Puede apoyar | No |
| Imprimir ticket QR | Si | Si | No | Recibe |
| Registrar diagnostico | Si | No recomendado | Si | No |
| Registrar presupuesto | Si | No recomendado | Si | No |
| Aceptar/rechazar presupuesto | Manual | Manual | No | Si |
| Registrar pago | Si | Si | No | Paga |
| Registrar venta directa | Si | Si | No | Compra |
| Administrar inventario | Si | Segun politica | Segun politica | No |
| Finalizar entrega | Si | Si | No | Recibe equipo |

## Procedimientos pendientes por definir

- Permisos estrictos por rol.
- Catalogo editable de fallas.
- Comprobante de venta directa.
- Garantias de reparacion.
- Firma digital o constancia de entrega.
- Reporte de ingresos por orden y ventas.
- Reporte de movimientos de inventario.
- Auditoria detallada de cambios por usuario.
