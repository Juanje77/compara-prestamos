# Regla de Firestore que exige la facturación electrónica

**Esto no está hecho todavía y hay que hacerlo en la consola de Firebase antes de cargar un token
de producción.** Las reglas de este proyecto no viven en el repositorio.

## Por qué

`api/guardar-token-fiscal.js` guarda el token de emisión en:

```
users/{uid}/secretos/fiscal
```

El token habilita a emitir facturas con el CUIT del contribuyente. Guardarlo del lado del servidor
no sirve de nada si las reglas dejan que el SDK del navegador lo lea de vuelta — y la regla
habitual en una app así es justamente esa:

```
match /users/{uid}/{documento=**} {
  allow read, write: if request.auth.uid == uid;
}
```

Con esa regla, cualquiera con la sesión abierta puede hacer un `getDoc` a `secretos/fiscal` desde
la consola del navegador y llevarse el token. El circuito entero queda igual de expuesto que si lo
hubiéramos dejado en `localStorage`.

## Qué agregar

La colección `secretos` tiene que quedar cerrada a todo el mundo. El Admin SDK, que es el que usan
las funciones de `api/`, **no pasa por las reglas**: las ignora por diseño, así que cerrarla no le
impide trabajar.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cerrada antes que la regla general: en Firestore gana cualquier allow que matchee, así
    // que no alcanza con negar después — esta colección no debe tener ningún allow.
    match /users/{uid}/secretos/{documento=**} {
      allow read, write: if false;
    }

    // Igual para la copia de las emisiones: no tiene secretos, pero la escribe el servidor y el
    // navegador no tiene por qué tocarla.
    match /users/{uid}/emisiones/{documento=**} {
      allow read: if request.auth.uid == uid;
      allow write: if false;
    }

    // ... el resto de las reglas que ya estén configuradas
  }
}
```

## Cómo verificar que quedó bien

En la consola del navegador, con la sesión iniciada:

```js
const { getFirestore, doc, getDoc } = await import('firebase/firestore')
await getDoc(doc(getFirestore(), `users/${TU_UID}/secretos/fiscal`))
```

Tiene que fallar con `permission-denied`. Si devuelve el documento, la regla no está aplicada y no
hay que cargar ningún token real hasta que lo esté.
