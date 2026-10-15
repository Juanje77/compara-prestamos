# Reglas de Firestore y la facturación electrónica

Las reglas vigentes viven en `firestore.rules`, en la raíz del repositorio. Ese archivo es la
copia de lo que tiene que estar publicado **hoy**: cada vez que se toca hay que publicarlo con

```bash
firebase deploy --only firestore:rules
```

Una regla que queda sólo en el repositorio no protege nada, y una que se publica antes de que el
código que la habilita esté en producción deja a todos afuera. Este documento deja registrado qué
toca la facturación, por qué las reglas vigentes alcanzan, y cuál es el único cambio pendiente de
activar.

## El cambio pendiente: exigir el segundo factor

`firestore.rules` **no** exige todavía el segundo factor. No es un olvido: la marca `mfaHasta` la
pone el servidor en el token al verificar el código por mail, y mientras `RESEND_API_KEY`,
`RESEND_FROM` y `MFA_PEPPER` no estén cargadas en Vercel ningún token la tiene. Publicar la regla
antes de eso deniega absolutamente todo, incluido el acceso del dueño de la cuenta.

Cuando el circuito esté configurado y probado en producción, el cambio es agregar la función y
usarla en `esElDueno`:

```
function pasoSegundoFactor() {
  return request.auth.token.mfaHasta is number && request.auth.token.mfaHasta > request.time.toMillis();
}

function esElDueno(userId) {
  return request.auth != null && request.auth.uid == userId && pasoSegundoFactor();
}
```

Exigirlo **acá** es lo que hace que el segundo factor sirva: si sólo lo mirara la pantalla,
cualquiera con la contraseña podría saltear el código hablándole a Firestore directo con su token.
Las reglas no le creen al navegador, le creen al token.

Antes de publicarlo hay que verificar, con una cuenta de prueba, que al verificar el código el
token efectivamente trae `mfaHasta` — y recordar que el token ya emitido no se entera del cambio
hasta que se refresca.

## Qué guarda cada cosa

El token de la API fiscal es de FinCorp, no de cada cliente: vive en la variable de entorno
`SISTEMAS360_TOKEN` en Vercel y nunca toca Firestore ni el navegador. Del lado del usuario sólo
queda información no secreta:

| Dónde | Qué | Quién lo lee |
|---|---|---|
| `users/{uid}` → `negocioData.datosEmisorFiscal` | CUIT, razón social, punto de venta, `emisorId` y el avance del circuito de ARCA | El usuario y el servidor |
| `users/{uid}/emisiones/{referencia}` | Copia del resultado de cada emisión, para no perder un CAE | Sólo el servidor |

El `emisorId` no es un secreto, pero **sí es una autorización**: quien pudiera elegirlo estaría
facturando con el CUIT de otro contribuyente de la misma cuenta. Por eso
`api/emitir-comprobante.js` no lo toma del cuerpo del pedido — lo lee de `users/{uid}` con el Admin
SDK y pisa cualquier valor que viniera del navegador. Ver `emisorIdDe` en `api/_auth.js`.

## Por qué las reglas de los datos alcanzan

En lo esencial, lo que protege la facturación es esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /meta/{document} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false;
      }
    }
  }
}
```

El usuario puede escribir su propio documento, y ahí está su `emisorId` — pero eso no es un
problema, porque el servidor no le cree al navegador: lo relee de Firestore antes de emitir. Si
alguien se editara el `emisorId` a mano, `emisorIdDe` lo tomaría… y ahí sí facturaría con otro CUIT.

**Ésa es la razón por la que conviene mover `datosEmisorFiscal.emisorId` a una subcolección cerrada
cuando haya más de un cliente en la misma cuenta de la API.** Hoy, con un solo emisor real, el
riesgo es teórico; con varios, deja de serlo. Queda anotado como lo primero a cambiar antes de
sumar el segundo cliente.

`emisiones` no tiene regla propia, así que el navegador no la lee. El Admin SDK, que es el que usan
las funciones de `api/`, no pasa por las reglas.

## El cambio que rompería esto

Si la primera regla pasara a ser recursiva:

```
match /users/{userId}/{documento=**} {
```

la subcolección `emisiones` quedaría legible desde el navegador. No hay secretos ahí, pero sí el
detalle fiscal de cada comprobante. Vale saber que **un `allow ... : if false` explícito no
protegería de eso**: en Firestore los permisos se suman y gana cualquier `allow` que matchee.
