// Los usuarios de la empresa: invitar, aceptar, listar, cambiar módulos y dar de baja.
//
// Todo en un endpoint elegido por `accion`, por el tope de funciones de Vercel (ver mfa.js, misma
// razón). Comparten además lo esencial: quién es el dueño y qué claims lleva el token.
//
// Lo que hace que esto sea un permiso y no un cartelito: el servidor escribe `empresaId`,
// `modulos` y `bloques` como custom claims del usuario invitado. Esos claims viajan firmados
// adentro del token de Firebase, el navegador no los puede tocar, y las reglas de Firestore
// comparan contra ellos. Un empleado que se edite el JavaScript de la página sigue sin poder
// leer un bloque que no tiene asignado: la base le dice que no.
//
// Lo que el dueño tiene que saber (y la pantalla de la etapa 4 le va a decir): los claims viven
// en el token, y un token ya emitido no se entera de un cambio hasta que se renueva —hasta una
// hora, o al instante si el empleado recarga. Sacarle un módulo a alguien no es instantáneo.
import { sesionAutenticada } from './_auth.js'
import { obtenerAuthAdmin, obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { enviarMail } from './_mail.js'
import { pepper } from './_mfaComun.js'
import { dentroDelLimite, ipDe } from './_rateLimit.js'
import {
  MAX_MIEMBROS,
  VIGENCIA_INVITACION_MS,
  armarCodigo,
  bloquesDe,
  claimsDeMiembro,
  claimsSinEmpresa,
  emailValido,
  estadoInvitacion,
  generarSecreto,
  hashCoincide,
  hashSecreto,
  normalizarEmail,
  normalizarModulos,
  partirCodigo,
  plantillaInvitacion,
} from './_empresa.js'

const ACCIONES = ['invitar', 'listar', 'cambiar', 'quitar', 'aceptar', 'mi-acceso']

const MOTIVOS = {
  inexistente: 'La invitación no existe. Pedile al dueño de la cuenta que te mande una nueva.',
  usada: 'Esa invitación ya se usó.',
  revocada: 'La invitación fue dada de baja.',
  vencida: 'La invitación venció. Pedile al dueño de la cuenta que te mande una nueva.',
}

function refMiembros(db, empresaId) {
  return db.collection('users').doc(empresaId).collection('miembros')
}

function refInvitaciones(db, empresaId) {
  return db.collection('users').doc(empresaId).collection('invitaciones')
}

/** La empresa a la que pertenece quien pide, según su token. Un usuario sin `empresaId` es dueño
 * de la suya: su propio uid. Sale del token y nunca del cuerpo del pedido. */
async function contextoDe(uid) {
  const auth = await obtenerAuthAdmin()
  const usuario = await auth.getUser(uid)
  const claims = usuario.customClaims ?? {}
  const empresaId = typeof claims.empresaId === 'string' ? claims.empresaId : null
  return { auth, claims, empresaId, esDueno: empresaId === null }
}

async function invitar(req, res, { db, uid, email: emailDueno }) {
  const email = normalizarEmail(req.body?.email)
  const modulos = normalizarModulos(req.body?.modulos)

  if (!emailValido(email)) {
    res.status(400).json({ error: 'El mail no parece válido.' })
    return
  }
  if (modulos.length === 0) {
    res.status(400).json({ error: 'Hay que asignarle al menos un módulo.' })
    return
  }
  if (normalizarEmail(emailDueno) === email) {
    res.status(400).json({ error: 'Ese es tu propio mail: ya tenés acceso a todo.' })
    return
  }

  const secretoPepper = pepper()
  if (!secretoPepper) {
    res.status(503).json({ error: 'Los usuarios de la empresa todavía no están configurados.' })
    return
  }

  const miembros = await refMiembros(db, uid).get()
  if (miembros.size >= MAX_MIEMBROS) {
    res.status(409).json({ error: `El tope es de ${MAX_MIEMBROS} usuarios por empresa.` })
    return
  }
  if (miembros.docs.some((d) => normalizarEmail(d.data()?.email) === email)) {
    res.status(409).json({ error: 'Esa persona ya tiene acceso. Cambiale los módulos desde la lista.' })
    return
  }

  const ahora = Date.now()
  const secreto = generarSecreto()
  const ref = refInvitaciones(db, uid).doc()
  await ref.set({
    email,
    modulos,
    bloques: bloquesDe(modulos),
    hashSecreto: hashSecreto(secreto, secretoPepper),
    creadaEn: ahora,
    vence: ahora + VIGENCIA_INVITACION_MS,
  })

  const codigo = armarCodigo(uid, ref.id, secreto)
  const origen = req.headers?.origin || `https://${req.headers?.host ?? 'fincorp.com.ar'}`
  const url = `${origen}/empresas?invitacion=${encodeURIComponent(codigo)}`
  const nombreEmpresa = (await db.collection('users').doc(uid).get()).data()?.nombreEmpresa

  const enviado = await enviarMail({ para: email, ...plantillaInvitacion({ codigo, empresa: nombreEmpresa, url }) })

  // Si el mail no sale, la invitación igual queda creada y se devuelve el link: el dueño lo puede
  // pasar por otro lado. Borrarla sería perder el trabajo por una falla del proveedor de mail.
  res.status(200).json({ invitacionId: ref.id, email, modulos, enviado, url: enviado ? undefined : url })
}

async function listar(res, { db, uid }) {
  const [miembros, invitaciones] = await Promise.all([refMiembros(db, uid).get(), refInvitaciones(db, uid).get()])
  const ahora = Date.now()
  res.status(200).json({
    miembros: miembros.docs.map((d) => ({ uid: d.id, ...d.data() })),
    // El hash del secreto no se devuelve: no le sirve a nadie y es lo único que protege el código.
    invitaciones: invitaciones.docs
      .map((d) => ({ id: d.id, ...d.data(), hashSecreto: undefined }))
      .filter((i) => estadoInvitacion(i, ahora) === 'vigente'),
  })
}

async function cambiar(req, res, { db, auth, uid }) {
  const miembroUid = typeof req.body?.uid === 'string' ? req.body.uid : ''
  const modulos = normalizarModulos(req.body?.modulos)
  if (!miembroUid) {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }
  if (modulos.length === 0) {
    res.status(400).json({ error: 'Hay que dejarle al menos un módulo. Para sacarle todo, dalo de baja.' })
    return
  }

  const ref = refMiembros(db, uid).doc(miembroUid)
  if (!(await ref.get()).exists) {
    res.status(404).json({ error: 'Ese usuario no es de tu empresa.' })
    return
  }

  const bloques = bloquesDe(modulos)
  // Primero el token y después la base: si algo falla en el medio, prefiero que quede guardado
  // menos acceso del que el token ya tiene y no al revés.
  const actuales = (await auth.getUser(miembroUid)).customClaims ?? {}
  await auth.setCustomUserClaims(miembroUid, claimsDeMiembro(actuales, uid, modulos))
  await ref.set({ modulos, bloques, actualizadoEn: Date.now() }, { merge: true })

  res.status(200).json({ uid: miembroUid, modulos, bloques })
}

async function quitar(req, res, { db, auth, uid }) {
  const miembroUid = typeof req.body?.uid === 'string' ? req.body.uid : ''
  if (!miembroUid) {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }

  const ref = refMiembros(db, uid).doc(miembroUid)
  if (!(await ref.get()).exists) {
    res.status(404).json({ error: 'Ese usuario no es de tu empresa.' })
    return
  }

  // El token primero: mientras los claims sigan puestos, las reglas lo dejan entrar aunque el
  // documento ya no esté. Y aun así no es instantáneo —el token ya emitido vale hasta una hora—,
  // que es la razón por la que la respuesta lo dice.
  const actuales = (await auth.getUser(miembroUid)).customClaims ?? {}
  await auth.setCustomUserClaims(miembroUid, claimsSinEmpresa(actuales))
  await auth.revokeRefreshTokens(miembroUid)
  await ref.delete()

  res.status(200).json({ uid: miembroUid, dadoDeBaja: true })
}

async function aceptar(req, res, { db, auth, uid, email }) {
  const secretoPepper = pepper()
  if (!secretoPepper) {
    res.status(503).json({ error: 'Los usuarios de la empresa todavía no están configurados.' })
    return
  }

  const partes = partirCodigo(req.body?.codigo)
  if (!partes) {
    res.status(400).json({ error: 'El código de invitación no es válido.' })
    return
  }
  if (partes.empresaId === uid) {
    res.status(400).json({ error: 'No podés aceptar una invitación tuya.' })
    return
  }

  const ref = refInvitaciones(db, partes.empresaId).doc(partes.invitacionId)
  const snap = await ref.get()
  const invitacion = snap.exists ? snap.data() : null
  const estado = estadoInvitacion(invitacion)
  if (estado !== 'vigente') {
    res.status(410).json({ error: MOTIVOS[estado] })
    return
  }

  if (!hashCoincide(hashSecreto(partes.secreto, secretoPepper), invitacion.hashSecreto)) {
    res.status(403).json({ error: 'El código de invitación no es válido.' })
    return
  }

  // Que el mail coincida es lo que ata la invitación a una persona. Sin esto, cualquiera que
  // consiguiera el link —reenviado, en una captura de pantalla— entraría con su propia cuenta.
  if (normalizarEmail(email) !== normalizarEmail(invitacion.email)) {
    res.status(403).json({
      error: `Esta invitación es para ${invitacion.email}. Entrá con esa dirección de mail.`,
    })
    return
  }

  const claims = (await auth.getUser(uid)).customClaims ?? {}
  if (typeof claims.empresaId === 'string' && claims.empresaId !== partes.empresaId) {
    res.status(409).json({ error: 'Ya tenés acceso a otra empresa con este mail.' })
    return
  }

  const modulos = normalizarModulos(invitacion.modulos)
  await auth.setCustomUserClaims(uid, claimsDeMiembro(claims, partes.empresaId, modulos))
  await refMiembros(db, partes.empresaId).doc(uid).set({
    email: normalizarEmail(email),
    modulos,
    bloques: bloquesDe(modulos),
    creadoEn: Date.now(),
  })
  await ref.set({ aceptadaEn: Date.now(), aceptadaPor: uid }, { merge: true })

  res.status(200).json({ empresaId: partes.empresaId, modulos, bloques: bloquesDe(modulos) })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const accion = req.body?.accion
  if (!ACCIONES.includes(accion)) {
    res.status(400).json({ error: 'Acción no válida.' })
    return
  }

  const sesion = await sesionAutenticada(req)
  if (!sesion) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  // "aceptar" es el único que prueba un secreto, así que es el único que se puede atacar a
  // fuerza bruta. El límite va por IP y por cuenta: el secreto son 36 caracteres hexadecimales,
  // pero un tope barato no cuesta nada y cierra la puerta de entrada.
  if (accion === 'aceptar') {
    const { permitido } = dentroDelLimite(`empresa-aceptar:${ipDe(req)}:${sesion.uid}`, {
      maximo: 10,
      ventanaMs: 10 * 60 * 1000,
    })
    if (!permitido) {
      res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos.' })
      return
    }
  }

  try {
    const db = obtenerFirestoreAdmin()
    const { auth, claims, empresaId, esDueno } = await contextoDe(sesion.uid)

    if (accion === 'mi-acceso') {
      res.status(200).json({
        esDueno,
        empresaId: empresaId ?? sesion.uid,
        modulos: Array.isArray(claims.modulos) ? claims.modulos : null,
        bloques: Array.isArray(claims.bloques) ? claims.bloques : null,
      })
      return
    }

    if (accion === 'aceptar') {
      await aceptar(req, res, { db, auth, uid: sesion.uid, email: sesion.email })
      return
    }

    // El resto son del dueño. Un empleado no administra usuarios ni siquiera los suyos: si
    // pudiera, se asignaría los sueldos solo.
    if (!esDueno) {
      res.status(403).json({ error: 'Solo el dueño de la cuenta puede administrar usuarios.' })
      return
    }

    const ctx = { db, auth, uid: sesion.uid, email: sesion.email }
    if (accion === 'invitar') await invitar(req, res, ctx)
    else if (accion === 'listar') await listar(res, ctx)
    else if (accion === 'cambiar') await cambiar(req, res, ctx)
    else await quitar(req, res, ctx)
  } catch {
    res.status(500).json({ error: 'No se pudo completar la operación.' })
  }
}
