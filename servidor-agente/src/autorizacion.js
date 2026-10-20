"use strict";

const { ERRORES } = require("./errores");
const { LIMITES } = require("./contrato");

const RE_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RE_CODIGO_FIREBASE = /^[a-z]+\/[a-z0-9-]{1,60}$/;

// Errores de firebase-admin que significan que la SESIÓN del usuario no es válida
// (token mal formado, con firma o audiencia incorrecta, expirado o revocado;
// usuario deshabilitado o inexistente). Cualquier otro error, incluidos los
// desconocidos, es un fallo del servidor y no se presenta como sesión inválida.
const ERRORES_DE_SESION = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/argument-error",
  "auth/user-disabled",
  "auth/user-not-found",
]);

// firebase-admin 13 también informa como auth/argument-error un fallo de red al
// descargar sus claves públicas (lib/utils/jwt.js); ese caso es del servidor.
const PREFIJO_FALLO_CLAVES = "Error fetching public keys";

function codigoSeguro(error) {
  const codigo = error && typeof error.code === "string" ? error.code : "";
  return RE_CODIGO_FIREBASE.test(codigo) ? codigo : "desconocido";
}

/** { sesionInvalida, codigo }; el mensaje del SDK solo se inspecciona, nunca se registra. */
function clasificarErrorVerificacion(error) {
  const codigo = codigoSeguro(error);
  const mensaje = error && typeof error.message === "string" ? error.message : "";
  if (codigo === "auth/argument-error" && mensaje.startsWith(PREFIJO_FALLO_CLAVES)) {
    return { sesionInvalida: false, codigo: "auth/key-fetch-error" };
  }
  return { sesionInvalida: ERRORES_DE_SESION.has(codigo), codigo };
}

/**
 * Autentica y autoriza en el servidor. El rol nunca se toma del cliente:
 *   1. Verifica el Firebase ID token (firma, caducidad y revocación).
 *   2. Lee usuarios/{uid} y exige owner === true o admin === true, el mismo
 *      criterio que isOwner()/isAdmin() de firestore.rules.
 * Errores: sesión inválida -> 401; fallo que impide verificar (IAM, credenciales,
 * red, desconocido) -> 503 autenticacion_no_configurada; sin rol -> 403.
 * Dependencias inyectadas (ver firebase.js):
 *   verificarToken(token) -> { uid }      leerUsuario(uid) -> datos | null
 * registrar: solo recibe códigos de error, nunca tokens, mensajes ni datos.
 */
async function autorizar(encabezadoAuthorization, { verificarToken, leerUsuario }, registrar = () => {}) {
  const valor = typeof encabezadoAuthorization === "string" ? encabezadoAuthorization : "";
  const coincide = valor.match(/^Bearer (.+)$/);
  const token = coincide ? coincide[1].trim() : "";
  if (!token || token.length > LIMITES.caracteresToken || !RE_JWT.test(token)) throw ERRORES.noAutenticado();

  let uid;
  try {
    const decodificado = await verificarToken(token);
    uid = decodificado && decodificado.uid;
  } catch (error) {
    const { sesionInvalida, codigo } = clasificarErrorVerificacion(error);
    registrar({ evento: "verificacion_sesion_fallida", codigo, origen: sesionInvalida ? "sesion" : "servidor" });
    throw sesionInvalida ? ERRORES.noAutenticado() : ERRORES.autenticacionNoConfigurada();
  }
  if (typeof uid !== "string" || uid === "") throw ERRORES.noAutenticado();

  let usuario;
  try {
    usuario = await leerUsuario(uid);
  } catch (error) {
    // Sin poder leer el rol no se puede autorizar: es un fallo del servidor
    registrar({ evento: "lectura_rol_fallida", codigo: codigoSeguro(error), origen: "servidor" });
    throw ERRORES.autenticacionNoConfigurada();
  }
  const rol = usuario && usuario.owner === true ? "owner" : usuario && usuario.admin === true ? "admin" : null;
  if (!rol) throw ERRORES.sinPermiso();
  return { uid, rol };
}

module.exports = { autorizar, clasificarErrorVerificacion };
