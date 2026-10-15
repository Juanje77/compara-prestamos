# Varios usuarios por empresa, con permisos reales

El dueño crea usuarios para sus empleados y le asigna a cada uno los módulos que necesita. Un
empleado con "Comprobantes" y "Clientes" no puede ver los sueldos — y no puede verlos de verdad,
no solo en la pantalla.

Este documento es el plan. Se escribió antes de tocar nada porque el primer paso (cómo se parten
los datos) es el caro de deshacer.

## El problema de fondo

Hoy todo el negocio vive en **un solo documento** de Firestore: `users/{uid}`, campo
`negocioData`. Comprobantes, sueldos, tesorería, impuestos, todo junto.

Las reglas de Firestore dan permiso **por documento, no por campo**. Mientras siga así, cualquiera
que pueda leer ese documento lo lee entero, por más que la interfaz le muestre dos solapas:
alcanza con abrir las herramientas del navegador. Esconder módulos en la pantalla sería un
cartelito, no un permiso.

Por eso el trabajo empieza partiendo el negocio en varios documentos.

## Los bloques

El negocio se parte en cinco documentos, agrupando por quién necesita verlos:

| Bloque | Qué guarda |
|---|---|
| `comercial` | facturas, pagos, clientes, proveedores, remitos, anticipos, sectores, productos, movimientos de stock, carga diaria |
| `tesoreria` | cuentas, deudas, cheques, movimientos de tesorería y bancarios |
| `sueldos` | empleados |
| `impuestos` | IVA y IIBB manuales, monotributo, datos del emisor fiscal |
| `negocio` | números estimados, patrimonio, presupuesto, tasa de crecimiento, nombre |

El reparto exacto vive en `src/lib/permisos.ts`, con un test que verifica que **todo campo esté en
un bloque y en uno solo**. Si mañana se agrega un campo nuevo y nadie lo ubica, el test falla en
vez de que ese dato se pierda en silencio.

`sueldos` quedó solo con `empleados` a propósito: es el bloque sensible, y tenerlo aparte es lo
que permite cerrarlo sin arrastrar nada más.

## Qué módulo necesita qué bloque

También en `src/lib/permisos.ts`. Lo importante de esa tabla son las **consecuencias no obvias**,
que el dueño tiene que conocer al asignar:

- **Márgenes por sector** incluye el costo de la nómina asignada a cada sector, así que da acceso
  a `sueldos`. No hay forma de mostrar ese número sin ese dato.
- **Dashboard** y **Presupuesto vs. Real** también, por el costo de la nómina en los gastos.
- **Cobranzas y pagos** muestra los pagos de sueldos del mes, así que también.
- **Backup** es una copia del negocio entero: da acceso a todo. No debería asignarse a un empleado.

La pantalla de asignación tiene que avisar esto cuando pasa (`modulosQueExponen`), para que el
dueño se entere al asignar y no después.

## Cómo entra un empleado

1. El dueño carga el mail y tilda los módulos.
2. El servidor crea la invitación y le manda un mail (con Resend, el mismo del segundo factor).
3. El empleado entra, se crea su contraseña y acepta la invitación.
4. El servidor comprueba que el mail coincida con el de la invitación y le pone en el token un
   `empresaId` y la lista de módulos, como *custom claims* — igual que la marca del segundo factor.
5. Las reglas de Firestore leen esos claims. Por eso un empleado no puede ampliarse los permisos
   desde el navegador: el token lo firma el servidor.

## Etapas

1. **El modelo de permisos** (hecho): bloques, mapeo módulo → bloques, y sus tests.
2. **Partir los datos** (hecho): el negocio se guarda en `users/{uid}/datos/{bloque}`, cinco
   documentos. El resto del sistema sigue viendo un solo objeto; `negocioBloques.ts` es la única
   capa que sabe que está partido, con un test de ida y vuelta sobre un negocio completo.

   La migración corre sola y una sola vez por cuenta: al detectar que hay `negocioData` en el
   documento principal y ningún bloque, lo parte. **No borra el original**, que queda como
   respaldo de cómo estaba justo antes; limpiarlo es una tarea aparte para cuando esto lleve
   tiempo andando.

   Se escriben solo los bloques que cambiaron, porque Firestore cobra por escritura y guardar los
   cinco en cada tecla sería multiplicar el costo por cinco.
3. **Empresa y miembros**: la entidad empresa, el alta por invitación, los claims y las reglas.
4. **La pantalla del dueño**: crear usuarios, asignar módulos, dar de baja.
5. **La navegación según permisos**: que cada empleado vea solo sus solapas.

## Cosas a resolver antes de la etapa 3

- **El plan es del dueño, no del empleado.** Hoy el plan se lee de `users/{uid}/meta/plan`. Un
  empleado no tiene plan propio: hay que resolverlo contra el de la empresa.
- **El tope de funciones de Vercel.** El plan Hobby admite 12 y ya estamos en 12. La invitación
  necesita al menos un endpoint más, así que antes hay que juntar dos de los que hay (los dos de
  consulta fiscal son candidatos) o pasar a Vercel Pro.
- **El segundo factor es por persona**, así que cada empleado tiene el suyo. No hay que hacer
  nada, pero conviene saberlo.
