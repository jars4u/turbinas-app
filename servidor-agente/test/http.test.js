"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { crearManejadorHttp, crearManejador } = require("../src/manejador");
const { crearAgente } = require("../src/agente");
const { TOKEN, autenticacionSimulada, fuenteSimulada, modeloSimulado } = require("./ayudas");

function reqSimulada({ method = "POST", headers = {}, cuerpo, body } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { method, headers, destroy: () => {} });
  if (body !== undefined) req.body = body;
  setImmediate(() => {
    if (cuerpo !== undefined) req.emit("data", Buffer.from(cuerpo));
    req.emit("end");
  });
  return req;
}

function resSimulada() {
  const res = { statusCode: 200, encabezados: {}, cuerpo: "" };
  res.setHeader = (k, v) => { res.encabezados[k.toLowerCase()] = v; };
  res.end = (t) => { res.cuerpo = t || ""; return res; };
  return res;
}

function servicio() {
  const manejador = crearManejador({
    autenticacion: autenticacionSimulada(),
    crearAgenteParaSolicitud: () => crearAgente({ modelo: modeloSimulado([{ tipo: "texto", texto: "ok" }]), fuente: fuenteSimulada() }),
  });
  return crearManejadorHttp(manejador, { origenesPermitidos: ["https://app.ejemplo.test"] });
}

test("HTTP: respuesta JSON, sin caché y CORS solo para orígenes permitidos", async () => {
  const res = resSimulada();
  await servicio()(reqSimulada({
    headers: { authorization: `Bearer ${TOKEN}`, origin: "https://app.ejemplo.test" },
    cuerpo: JSON.stringify({ mensajes: [{ rol: "usuario", texto: "hola" }] }),
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.cuerpo).respuesta.texto, "ok");
  assert.equal(res.encabezados["cache-control"], "no-store");
  assert.equal(res.encabezados["access-control-allow-origin"], "https://app.ejemplo.test");

  const otro = resSimulada();
  await servicio()(reqSimulada({ headers: { origin: "https://otro.test" }, method: "OPTIONS" }), otro);
  assert.equal(otro.statusCode, 204);
  assert.equal(otro.encabezados["access-control-allow-origin"], undefined);
});

test("HTTP: JSON inválido 400, cuerpo grande 413, sin token 401", async () => {
  const invalido = resSimulada();
  await servicio()(reqSimulada({ headers: { authorization: `Bearer ${TOKEN}` }, cuerpo: "{no json" }), invalido);
  assert.equal(invalido.statusCode, 400);

  const grande = resSimulada();
  await servicio()(reqSimulada({ headers: { authorization: `Bearer ${TOKEN}` }, cuerpo: "x".repeat(70 * 1024) }), grande);
  assert.equal(grande.statusCode, 413);

  const anonimo = resSimulada();
  await servicio()(reqSimulada({ cuerpo: JSON.stringify({ mensajes: [{ rol: "usuario", texto: "hola" }] }) }), anonimo);
  assert.equal(anonimo.statusCode, 401);
});

test("HTTP: cuerpo ya parseado por la plataforma (Cloud Functions / Vercel)", async () => {
  const res = resSimulada();
  await servicio()(reqSimulada({ headers: { authorization: `Bearer ${TOKEN}` }, body: { mensajes: [{ rol: "usuario", texto: "hola" }] } }), res);
  assert.equal(res.statusCode, 200);
});
