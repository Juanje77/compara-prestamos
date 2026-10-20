# Cambiar el dominio de FinCorp

Checklist para cuando el sitio pase a otro dominio. Casi nada de esto está en el código: son
servicios de afuera que tienen el dominio anotado y dejan de funcionar en silencio si no se los
actualiza. El orden importa poco, pero conviene hacerlos todos de una y después probar.

## 1. Google OAuth — la copia de backup en Drive

Sin esto, el botón "Conectar con Google Drive" falla con un error de origen no autorizado.

- Google Cloud Console → **APIs y servicios → Credenciales** → el cliente de OAuth tipo
  "Aplicación web".
- En **Orígenes de JavaScript autorizados**, agregar el dominio nuevo: `https://dominio-nuevo`,
  sin barra final y sin ruta.
- Dejar el viejo hasta confirmar que el nuevo anda, y recién ahí sacarlo.
- Google avisa que el cambio puede tardar **de 5 minutos a varias horas** en aplicarse. Si al
  principio falla, es eso.

El Client ID no cambia: sigue siendo el mismo valor en `VITE_GOOGLE_CLIENT_ID`.

## 2. Firebase Authentication — el login

Sin esto, nadie puede iniciar sesión desde el dominio nuevo.

- Firebase Console → **Authentication → Settings → Authorized domains** → agregar el dominio nuevo.
- Si además cambia el `authDomain` del proyecto, actualizar `VITE_FIREBASE_AUTH_DOMAIN` en Vercel.

## 3. Vercel — el dominio y las variables

- Vercel → el proyecto → **Settings → Domains** → agregar el dominio nuevo y apuntar el DNS.
- Las variables `VITE_*` se compilan al armar el build, así que **después de cualquier cambio hay
  que hacer un redeploy**; no alcanza con guardarlas.

## 4. Mercado Pago — la vuelta después de pagar

`api/crear-suscripcion.js` arma el `back_url` con el origen del pedido (`req.headers.origin`), así
que el dominio nuevo se toma solo y no hay nada que tocar en el código. Lo que sí conviene revisar:

- En el panel de Mercado Pago, la URL del **webhook** de notificaciones, si quedó apuntando al
  dominio viejo.
- Que el dominio viejo siga respondiendo (o redirigiendo) mientras haya suscripciones en curso que
  puedan volver ahí.

## 5. La imagen que se ve al compartir el link

`index.html` tiene las URL absolutas de `og:image` y `twitter:image`, más el `canonical` y el
`og:url`, todas con el dominio escrito a mano: los que arman la vista previa no resuelven rutas
relativas. Hay que cambiarlas las cuatro, y también las tres URL de `public/sitemap.xml`. Si
quedan apuntando al dominio viejo, el link compartido sigue mostrando la imagen del sitio anterior
hasta que ese dominio deje de responder, y ahí pasa a no mostrar nada.

## 6. Resend — los mails

Resend sólo manda desde un dominio verificado en su panel. Con el dominio nuevo hay que:

- **Domains → Add Domain** y cargar en el DNS los registros que da.
- Actualizar `RESEND_FROM` para que la dirección sea del dominio nuevo.

Si no, el código del segundo factor y las invitaciones a los usuarios de la empresa dejan de
salir. Ver [Variables de entorno](VARIABLES-DE-ENTORNO.md).

## 7. Probar, en este orden

1. Entrar al dominio nuevo e **iniciar sesión** (valida el punto 2).
2. Abrir **Negocio → Backup** y tocar **Conectar con Google Drive** (valida el punto 1).
3. Arrancar una suscripción de prueba y ver que vuelva bien al sitio (valida el punto 4).
4. Mandarte una invitación a vos mismo desde **Negocio → Usuarios** y ver que llegue el mail
   (valida el punto 6).
