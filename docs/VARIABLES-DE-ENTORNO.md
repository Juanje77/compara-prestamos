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
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | La casilla de mail que ya tengas (ver abajo) | No sale ningún mail, salvo que esté Resend |
| `SMTP_PORT` | Opcional: 587 por defecto, 465 si el servidor pide TLS directo | Se usa 587 |
| `MAIL_FROM` | Lo elegís vos. Si falta, se usa `SMTP_USER` | — |
| `RESEND_API_KEY` | resend.com → API Keys (alternativa a SMTP) | — |
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

## Los mails: SMTP o Resend

Hay dos caminos y se usa el que esté configurado, con **SMTP primero**: si alguien se tomó el
trabajo de configurar una casilla propia, es la que quiere usar.

### SMTP — una casilla que ya existe

Es el camino corto cuando ya hay un mail andando (el hosting, Google Workspace, Gmail). Los datos
salen de ahí:

| Variable | Dónde está |
|---|---|
| `SMTP_HOST` | El servidor de salida de esa casilla. Gmail y Google Workspace: `smtp.gmail.com`. En un hosting suele ser `mail.tudominio.com` y figura en el panel como "servidor SMTP" o "correo saliente" |
| `SMTP_PORT` | 587 casi siempre. 465 solo si el panel dice "SSL/TLS" en vez de "STARTTLS" |
| `SMTP_USER` | La dirección completa de la casilla |
| `SMTP_PASS` | La contraseña de esa casilla |
| `MAIL_FROM` | Cómo se ve el remitente: `FinCorp <avisos@tudominio.com.ar>` |

**Con Gmail o Google Workspace la contraseña NO es la de la cuenta.** Google bloquea eso desde
2022. Hay que tener la verificación en dos pasos activada y generar una **contraseña de
aplicación** en myaccount.google.com → Seguridad → Contraseñas de aplicaciones: son 16 letras, y
eso va en `SMTP_PASS`.

Otra cosa de Gmail: el remitente tiene que ser **la misma casilla** (o un alias configurado en
ella). Si ponés otra dirección, Gmail la reescribe con la real y el mail sale igual pero con el
remitente cambiado.

Ojo con el volumen: una casilla de Gmail común tiene un tope de unos cientos de mails por día.
Para códigos de acceso e invitaciones sobra; para mandarle algo a todos los clientes, no.

### Resend — cuando no hay casilla

1. Crear la cuenta en resend.com.
2. **Domains → Add Domain** con el dominio del sitio, y cargar en el DNS los registros que te da
   (son TXT y MX). Hasta que el dominio no figure verificado, Resend no manda nada.
3. **API Keys → Create API Key** → ese valor va en `RESEND_API_KEY`.
4. `MAIL_FROM` es la dirección desde la que salen los mails, con ese dominio. Por ejemplo:
   `FinCorp <no-responder@fincorp.com.ar>`. **Tiene que ser del dominio verificado**, no de
   Gmail: ese es el error que más se repite. (`RESEND_FROM` sigue valiendo, es como se llamaba
   antes de que existiera el camino SMTP.)

Si al cambiar de dominio se mueve el sitio, hay que verificar el nuevo en Resend — está anotado en
[Cambiar el dominio](CAMBIAR-DE-DOMINIO.md).

## Si quedaste afuera por el segundo factor

El sistema pide el código solo cuando hay **las dos cosas**: `MFA_PEPPER` y un transporte de mail
configurado. Si falta cualquiera de las dos, no lo pide — justamente para que una variable a
medio cargar no deje a nadie afuera.

Pero si el transporte está configurado y **no anda** (contraseña equivocada, puerto mal, el
servidor rechaza el remitente), sí se puede quedar encerrado: la pantalla pide un código que
nunca llega, y desde el navegador no hay salida.

**La salida es sacar `MFA_PEPPER` de Vercel y volver a desplegar.** Con esa variable borrada, el
servidor contesta que el segundo factor no está configurado y se entra normalmente. Después se
arregla el mail y se vuelve a cargar.

No se pierde nada de los datos. Lo único que se pierde al borrar y volver a poner un pepper
*distinto* son los dispositivos recordados y las invitaciones sin aceptar; si se vuelve a cargar
**el mismo valor**, ni eso.

## Probar que el mail sale, antes de encender el segundo factor

Conviene en este orden:

1. Cargar las variables de mail (sin `MFA_PEPPER` todavía) y desplegar.
2. Entrar a **Negocio → Usuarios** e invitarte a vos mismo a otra dirección. Si el mail llega, el
   transporte anda.
3. Recién ahí cargar `MFA_PEPPER` y volver a desplegar.

Al revés —el pepper primero— es como quedarse afuera.
