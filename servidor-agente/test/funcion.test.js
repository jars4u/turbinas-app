"use strict";

// Punto de entrada de Cloud Functions: configuración del despliegue y rechazo sin
// sesión. No despliega ni llama a Firebase ni a OpenAI.
const test = require("node:test");
const assert = require("node:assert/strict");
const { agente } = require("../index");

test("la función se despliega en us-central1, con la clave como secreto y límites de coste", () => {
  const e = agente.__endpoint;
  assert.deepEqual(e.region, ["us-central1"]);
  assert.deepEqual(e.secretEnvironmentVariables, [{ key: "OPENAI_API_KEY" }]);
  assert.deepEqual(e.httpsTrigger.invoker, ["public"]);
  assert.equal(e.maxInstances, 2);
  assert.equal(e.timeoutSeconds, 180);
});

test("sin token la función responde 401 antes de verificar con Firebase o llamar al modelo", async () => {
  const res = { statusCode: 200, encabezados: {}, cuerpo: "" };
  res.setHeader = (k, v) => { res.encabezados[k.toLowerCase()] = v; };
  res.end = (t) => { res.cuerpo = t || ""; return res; };
  const req = { method: "POST", headers: {}, body: { mensajes: [{ rol: "usuario", texto: "hola" }] } };
  await agente(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.cuerpo).error.codigo, "no_autenticado");
});
