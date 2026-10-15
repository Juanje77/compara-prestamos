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

El negocio se parte en seis documentos, agrupando por quién necesita verlos:

| Bloque | Qué guarda |
|---|---|
| `comercial` | facturas, pagos, clientes, proveedores, remitos, anticipos, sectores, productos, movimientos de stock, carga diaria |
| `tesoreria` | cuentas, deudas, cheques, movimientos de tesorería y bancarios |
| `sueldos` | empleados |
| `impuestos` | IVA y IIBB manuales, monotributo, datos del emisor fiscal |
| `negocio` | números estimados, patrimonio, presupuesto, tasa de crecimiento, nombre |
| `semana` | la planilla de cobranzas y pagos de la semana |

`semana` es el único que no guarda campos de `negocioData` —la planilla vive al lado—, pero se
parte con el mismo mecanismo porque la razón es idéntica: que un empleado con Cobranzas la pueda
leer sin que eso le abra nada más.

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
3. **Empresa y miembros** (hecho): el alta por invitación, los claims y las reglas.

   - `api/empresa.js` hace todo el circuito, elegido por `accion`: `invitar`, `aceptar`,
     `listar`, `cambiar`, `quitar` y `mi-acceso`. Todas menos `aceptar` y `mi-acceso` son del
     dueño; un empleado no administra usuarios, ni siquiera el suyo.
   - La invitación se guarda en `users/{dueño}/invitaciones/{id}` con el **hash** del secreto, no
     el secreto. El código que viaja por mail es `empresa.invitacion.secreto`: lleva adentro a
     quién pertenece, para que el servidor la encuentre sin recorrer la base.
   - Al aceptar, el servidor comprueba que el mail del token coincida con el de la invitación.
     Sin eso, cualquiera que consiguiera el link —reenviado, en una captura— entraría con su
     propia cuenta.
   - Después escribe los claims `empresaId`, `modulos` y `bloques`. `bloques` está **calculado**
     por el servidor: es lo que miran las reglas, así que es la pieza que no puede venir del
     navegador.
   - `api/_empresa.js` tiene una copia de la tabla módulo → bloques, porque el backend no puede
     importar el TypeScript del front. Un test compara las dos tablas y falla si se separan.
   - `src/lib/empresa.ts` es el lado del cliente: lee los claims del token y llama al endpoint.
     No es seguridad —se puede editar en el navegador—, es comodidad.

   **Lo que hubo que cambiar para que esto cierre:** el documento principal `users/{uid}` quedó
   cerrado al dueño, ni siquiera sus empleados lo leen. Ahí había quedado el `negocioData` entero
   de antes de partirlo en bloques, y abrirlo habría anulado todo el trabajo de la etapa 2. Por
   eso `movimientosSemana`, que vivía ahí, pasó a su propio bloque.

4. **La pantalla del dueño** (hecho): `src/components/UsuariosEmpresa.tsx`, en la solapa
   **Negocio → Usuarios**. Invita por mail, lista quién tiene acceso, cambia módulos y da de
   baja. No es un módulo asignable a propósito: si un empleado pudiera administrar usuarios, se
   asignaría los sueldos solo.

   Lo que la pantalla tiene que lograr más allá de funcionar es que el dueño **entienda qué está
   dando**. Al tildar Márgenes por sector aparece el aviso de que eso incluye los sueldos, con el
   motivo ("porque le diste Márgenes por sector") y la aclaración de que no se puede evitar
   tildando menos. Sale de `modulosQueExponen`, y se avisa solo de los bloques donde la
   consecuencia no es obvia: sueldos, impuestos y tesorería.

   Los nombres de los módulos se mudaron a `MODULO_LABEL` en permisos.ts, que ahora usan tanto el
   menú de solapas como esta pantalla. Estaban escritos dos veces y un módulo podía terminar
   llamándose distinto al navegarlo que al asignarlo.
5. **La navegación según permisos**: que cada empleado vea solo sus solapas, y que todo lo que
   hoy va a Firestore con `user.uid` use el `empresaId` del acceso. Mientras esto no esté, un
   empleado que acepte la invitación entra a una cuenta vacía: los permisos ya son reales, pero
   la app todavía no sabe mirar los datos del dueño.

## Lo que se resolvió para poder hacer la etapa 3

- **El plan es del dueño, no del empleado.** Resuelto en las reglas: un miembro puede leer
  `users/{dueño}/meta/plan` y nada más de `meta`. `meta/fiscal` tiene el emisor con el que se
  factura, que no es asunto de un empleado.
- **El tope de funciones de Vercel.** Se juntaron las dos consultas fiscales en
  `api/consultar-fiscal.js` (`accion=cuit` o `accion=comprobante`), lo que dejó el lugar para
  `api/empresa.js`. Seguimos en 12 de 12: la próxima función que haga falta obliga a juntar otras
  dos o a pasar a Vercel Pro.
- **El segundo factor es por persona**, así que cada empleado tiene el suyo. No hay que hacer
  nada, pero conviene saberlo. Ojo con una cosa: los claims se escriben enteros, así que al
  tocarlos hay que conservar `mfaHasta` o el usuario queda afuera hasta pasar el código de nuevo.
  Hay un test que lo cuida.

## La demora de los claims

Un claim viaja adentro del token, y un token ya emitido no se entera de un cambio hasta que se
renueva: hasta una hora, o al instante si el empleado recarga. Sacarle un módulo a alguien **no es
instantáneo**. Por eso dar de baja a un usuario además le revoca las sesiones del lado del
servidor (`revokeRefreshTokens`), que es lo que corta de verdad. La pantalla de la etapa 4 tiene
que decirlo con todas las letras.

## Qué falta configurar

`MFA_PEPPER` (el mismo del segundo factor) y `RESEND_API_KEY` / `RESEND_FROM`. Sin el pepper,
invitar y aceptar contestan 503: no hay forma de guardar el secreto de la invitación de manera
segura. Sin Resend, la invitación igual se crea y el endpoint devuelve el link para pasarlo a
mano — perder el trabajo porque falló el proveedor de mail sería peor.
