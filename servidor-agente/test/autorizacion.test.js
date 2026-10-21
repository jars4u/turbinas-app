"use strict";

// Clasificación de errores de verificación de sesión con errores REALES de
// firebase-admin (FirebaseAuthError), sin red ni credenciales.
const test = require("node:test");
const assert = require("node:assert/strict");
const { FirebaseAuthError, AuthClientErrorCode } = require("firebase-admin/auth");
const { crearManejador } = require("../src/manejador");
const { crearAgente } = require("../src/agente");
const { TOKEN, USUARIOS, fuenteSimulada, modeloSimulado } = require("./ayudas");

const SECRETO = "SECRETO_SINTETICO_turbinas-app_sa@ejemplo.invalid";
const PREGUNTA = { mensajes: [{ rol: "usuario", texto: "hola" }] };
const errorAuth = (codigo, mensaje = `detalle interno ${SECRETO}`) => new FirebaseAuthError(AuthClientErrorCode[codigo], mensaje);

function preparar({ verificarToken, leerUsuario = async (uid) => USUARIOS[uid] || null }) {
  const registros = [];
  let agentes = 0;
  const manejador = crearManejador({
    autenticacion: { verificarToken, leerUsuario },
    crearAgenteParaSolicitud: () => {
      agentes += 1;
      return crearAgente({ modelo: modeloSimulado([{ tipo: "texto", texto: "ok" }]), fuente: fuenteSimulada() });
    },
    registrar: (r) => registros.push(r),
  });
  const llamar = () => manejador.manejar({ metodo: "POST", authorization: `Bearer ${TOKEN}`, cuerpo: PREGUNTA });
  return { llamar, registros, agentes: () => agentes };
}

function sinFugas(respuesta, registros) {
  const texto = JSON.stringify({ respuesta, registros });
  for (const prohibido of [SECRETO, TOKEN, "detalle interno", "getaddrinfo"]) assert.ok(!texto.includes(prohibido), prohibido);
  for (const r of registros) {
    for (const clave of Object.keys(r)) assert.ok(["evento", "codigo", "origen", "estado", "ms", "herramientas"].includes(clave), clave);
  }
}

test("token expirado o revocado → 401", async () => {
  for (const codigo of ["ID_TOKEN_EXPIRED", "ID_TOKEN_REVOKED"]) {
    const ctx = preparar({ verificarToken: async () => { throw errorAuth(codigo); } });
    const r = await ctx.llamar();
    assert.deepEqual([r.estado, r.cuerpo.error.codigo], [401, "no_autenticado"], codigo);
    assert.equal(ctx.registros[0].origen, "sesion");
    sinFugas(r, ctx.registros);
  }
});

test("token inválido (firma, audiencia, formato) y usuario deshabilitado o inexistente → 401", async () => {
  const casos = [
    errorAuth("INVALID_ARGUMENT", "Firebase ID token has invalid signature."),
    errorAuth("INVALID_ARGUMENT", 'Firebase ID token has incorrect "aud" (audience) claim.'),
    errorAuth("INVALID_ID_TOKEN"),
    errorAuth("USER_DISABLED"),
    errorAuth("USER_NOT_FOUND"),
  ];
  for (const error of casos) {
    const ctx = preparar({ verificarToken: async () => { throw error; } });
    const r = await ctx.llamar();
    assert.deepEqual([r.estado, r.cuerpo.error.codigo], [401, "no_autenticado"], error.code);
    assert.equal(ctx.agentes(), 0);
    sinFugas(r, ctx.registros);
  }
});

test("auth/insufficient-permission → 503 autenticacion_no_configurada (no es una sesión inválida)", async () => {
  const ctx = preparar({ verificarToken: async () => { throw errorAuth("INSUFFICIENT_PERMISSION"); } });
  const r = await ctx.llamar();
  assert.deepEqual([r.estado, r.cuerpo.error.codigo], [503, "autenticacion_no_configurada"]);
  assert.doesNotMatch(r.cuerpo.error.mensaje, /vuelve a iniciar/i);
  assert.deepEqual(ctx.registros[0], { evento: "verificacion_sesion_fallida", codigo: "auth/insufficient-permission", origen: "servidor" });
  assert.equal(ctx.agentes(), 0);
  sinFugas(r, ctx.registros);
});

test("errores de red, credenciales, configuración o desconocidos → 503", async () => {
  const casos = [
    // firebase-admin informa como argument-error el fallo de red al descargar sus claves públicas
    [errorAuth("INVALID_ARGUMENT", "Error fetching public keys for Google certs: getaddrinfo ENOTFOUND"), "auth/key-fetch-error"],
    [errorAuth("INVALID_CREDENTIAL"), "auth/invalid-credential"],
    [errorAuth("INTERNAL_ERROR"), "auth/internal-error"],
    [errorAuth("PROJECT_NOT_FOUND"), "auth/project-not-found"],
    [Object.assign(new Error(`network ${SECRETO}`), { code: "app/network-error" }), "app/network-error"],
    [Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }), "desconocido"],
    [new TypeError(`fallo inesperado ${SECRETO}`), "desconocido"],
  ];
  for (const [error, codigo] of casos) {
    const ctx = preparar({ verificarToken: async () => { throw error; } });
    const r = await ctx.llamar();
    assert.deepEqual([r.estado, r.cuerpo.error.codigo], [503, "autenticacion_no_configurada"], codigo);
    assert.equal(ctx.registros[0].codigo, codigo);
    assert.equal(ctx.registros[0].origen, "servidor");
    sinFugas(r, ctx.registros);
  }
});

test("fallo al leer el rol en Firestore → 503, no 401 ni 500", async () => {
  const ctx = preparar({
    verificarToken: async () => ({ uid: "uid-owner" }),
    leerUsuario: async () => { throw Object.assign(new Error(`7 PERMISSION_DENIED ${SECRETO}`), { code: 7 }); },
  });
  const r = await ctx.llamar();
  assert.deepEqual([r.estado, r.cuerpo.error.codigo], [503, "autenticacion_no_configurada"]);
  // El código gRPC de Firestore se registra (sin el mensaje) para poder diagnosticar
  assert.deepEqual(ctx.registros[0], { evento: "lectura_rol_fallida", codigo: "grpc/7", origen: "servidor" });
  sinFugas(r, ctx.registros);
});

test("tras autenticar correctamente, el rol se sigue verificando", async () => {
  for (const [uid, estado] of [["uid-owner", 200], ["uid-admin", 200], ["uid-observador", 403], ["uid-admin-texto", 403], ["uid-sin-documento", 403]]) {
    const ctx = preparar({ verificarToken: async () => ({ uid }) });
    const r = await ctx.llamar();
    assert.equal(r.estado, estado, uid);
    assert.equal(ctx.agentes(), estado === 200 ? 1 : 0, uid);
  }
});
