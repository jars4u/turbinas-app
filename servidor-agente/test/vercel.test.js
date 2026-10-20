"use strict";

// Función de Vercel (api/agente.js) y su configuración. Sin red ni despliegue.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const funcion = require("../../api/agente");

function resSimulada() {
  const res = { statusCode: 200, encabezados: {}, cuerpo: "" };
  res.setHeader = (k, v) => { res.encabezados[k.toLowerCase()] = v; };
  res.end = (t) => { res.cuerpo = t || ""; return res; };
  return res;
}

test("vercel.json fija la región en EE. UU. (iad1) y un tiempo máximo para la función", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "vercel.json"), "utf8"));
  assert.deepEqual(config.regions, ["iad1"]);
  assert.equal(config.functions["api/agente.js"].maxDuration, 120);
});

test("sin token: 401 antes de verificar con Firebase o llamar al modelo", async () => {
  const res = resSimulada();
  await funcion({ method: "POST", headers: {}, body: { mensajes: [{ rol: "usuario", texto: "hola" }] } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.cuerpo).error.codigo, "no_autenticado");
  assert.equal(res.encabezados["cache-control"], "no-store");
});

test("JSON inválido: Vercel lanza al leer req.body y se responde 400 controlado", async () => {
  const req = { method: "POST", headers: { authorization: "Bearer a.b.c" } };
  Object.defineProperty(req, "body", { get() { throw new Error("Invalid JSON"); } });
  const res = resSimulada();
  await funcion(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.cuerpo).error.codigo, "solicitud_invalida");
});
