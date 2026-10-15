# Las variables de entorno: de dónde sale cada valor

Se cargan en **Vercel → el proyecto → Settings → Environment Variables**, y hay que volver a
desplegar para que una variable nueva se aplique: las funciones las leen al arrancar.

Las que empiezan con `VITE_` son las únicas que viajan al navegador — se compilan adentro del
JavaScript del sitio. **Ninguna otra puede llevar un secreto que importe**, y por eso ni el token
de la API fiscal ni la clave de Resend están ahí. Las del servidor sólo las ve el código de
`api/`.

| Variable | De dónde sale el valor | Qué pasa si falta |
|---|---|---|
| `VITE_FIREBASE_*` (6) | Firebase → Configuración del proyecto → Tus apps → SDK | La app funciona sin cuentas, sólo con el navegador |
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud → Credenciales → ID de cliente OAuth tipo "aplicación web" | No aparece el backup en Drive |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase → Configuración → Cuentas de servicio → Generar clave privada (el JSON entero, en una línea) | No anda nada del servidor: planes, facturación, 2FA, usuarios |
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago → Tus integraciones → la aplicación → Credenciales de producción | No se pueden contratar planes |
| `MERCADOPAGO_WEBHOOK_SECRET` | Mercado Pago → la aplicación → Webhooks → "Clave secreta" | Las notificaciones de pago se rechazan |
| `SISTEMAS360_TOKEN` | El proveedor de la API fiscal. Es de FinCorp, no de cada cliente | No se puede emitir ni consultar CUIT |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | No anda "Leer factura" |
| `RESEND_API_KEY` | resend.com → API Keys → Create API Key | No sale ningún mail (ver abajo) |
| `RESEND_FROM` | Lo elegís vos, con un dominio verificado en Resend | Se usa el remitente por defecto, que Resend rechaza si el dominio no está verificado |
| `MFA_PEPPER` | **No existe en ningún lado: lo inventás vos.** Ver abajo | El segundo factor y las invitaciones no funcionan |
| `ADMIN_SECRET` | Lo inventás vos, igual que el pepper | No se puede asignar un plan a mano |

## `MFA_PEPPER`

Es el único valor de esta lista que no se copia de ningún panel: es un secreto que se inventa una
vez y no se cambia más. Sirve para que los hashes que quedan guardados en Firestore —el código
del segundo factor, el secreto de cada invitación— no se puedan recalcular desde afuera: quien se
llevara la base, sin el pepper no tiene con qué.

Para generar uno, cualquiera de estas sirve:

```bash
openssl rand -hex 32
```

```js
// En la consola del navegador (F12 → Console):
crypto.randomUUID() + crypto.randomUUID()
```

Tiene que ser largo y aleatorio; cualquier cosa de 32 caracteres o más que no se pueda adivinar
está bien.

**Cambiarlo después rompe lo que ya estaba hasheado con el anterior**: los dispositivos recordados
del segundo factor y las invitaciones sin aceptar dejan de valer. No se pierde ningún dato del
negocio —hay que volver a pedir el código y volver a mandar las invitaciones—, pero no es algo
para tocar por las dudas. Guardalo donde guardes las contraseñas.

## Resend

1. Crear la cuenta en resend.com.
2. **Domains → Add Domain** con el dominio del sitio, y cargar en el DNS los registros que te da
   (son TXT y MX). Hasta que el dominio no figure verificado, Resend no manda nada.
3. **API Keys → Create API Key** → ese valor va en `RESEND_API_KEY`.
4. `RESEND_FROM` es la dirección desde la que salen los mails, con ese dominio. Por ejemplo:
   `FinCorp <no-responder@fincorp.com.ar>`. **Tiene que ser del dominio verificado**, no de
   Gmail: ese es el error que más se repite.

Si al cambiar de dominio se mueve el sitio, hay que verificar el nuevo en Resend — está anotado en
[Cambiar el dominio](CAMBIAR-DE-DOMINIO.md).
