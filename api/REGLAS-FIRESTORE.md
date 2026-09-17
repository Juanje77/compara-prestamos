# Reglas de Firestore y el token fiscal

Las reglas de este proyecto no viven en el repositorio, se editan en la consola de Firebase. Este
documento deja registrado por qué el token de emisión está a salvo con las reglas actuales, y qué
cambio lo pondría en peligro.

## Dónde vive el token

`api/guardar-token-fiscal.js` lo guarda en:

```
users/{uid}/secretos/fiscal
```

El token habilita a emitir facturas con el CUIT del contribuyente. Guardarlo del lado del servidor
sólo sirve si las reglas impiden que el SDK del navegador lo lea de vuelta.

## Por qué ya está protegido

Las reglas vigentes son:

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

La clave está en que **las reglas de Firestore no se heredan a las subcolecciones**. `match
/users/{userId}` matchea el documento del usuario y nada más: no alcanza a
`users/{uid}/secretos/fiscal`, que es un documento de una subcolección. Por eso `meta` necesitó su
propio `match` anidado para poder leerse.

Todo lo que no tiene una regla que lo matchee queda denegado. `secretos` no la tiene, así que el
navegador no puede leerlo. El Admin SDK, que es el que usan las funciones de `api/`, no pasa por
las reglas: las ignora por diseño.

## El cambio que rompería esto

Si alguna vez la primera línea pasa a ser recursiva:

```
match /users/{userId}/{documento=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

el token queda legible desde la consola del navegador con un `getDoc`. Es un cambio que se hace
solo, casi sin pensarlo, el día que algo necesite acceso a una subcolección nueva y la respuesta
rápida sea "hago el match recursivo".

Vale la pena saber que **un `allow ... : if false` explícito sobre `secretos` no protegería de
eso**: en Firestore gana cualquier `allow` que matchee, los permisos se suman y no hay denegación
que tenga prioridad. Serviría como señal para quien lea las reglas, no como candado. El candado
real es no volver recursiva esa primera regla.

## Cómo verificar

En la consola del navegador, con la sesión iniciada:

```js
const { getFirestore, doc, getDoc } = await import('firebase/firestore')
await getDoc(doc(getFirestore(), `users/${TU_UID}/secretos/fiscal`))
```

Tiene que fallar con `permission-denied`.

## Pendiente menor: las emisiones

`api/emitir-comprobante.js` guarda una copia del resultado en `users/{uid}/emisiones/{referencia}`,
para que un CAE no se pierda si el navegador se cierra justo después de la respuesta. Con las
reglas actuales esa subcolección tampoco se puede leer desde el navegador.

Hoy no molesta: el resultado de la emisión vuelve en la respuesta HTTP. Si más adelante la interfaz
tiene que recuperar un CAE perdido, hace falta agregar:

```
match /emisiones/{documento} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}
```

anidado dentro de `match /users/{userId}`, igual que el de `meta`. La escritura queda en `false`
porque sólo la hace el servidor.
