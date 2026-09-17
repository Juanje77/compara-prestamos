# Reglas de Firestore y la facturación electrónica

Las reglas de este proyecto no viven en el repositorio, se editan en la consola de Firebase. Este
documento deja registrado qué toca la facturación y por qué las reglas vigentes alcanzan.

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

## Por qué las reglas vigentes alcanzan

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
