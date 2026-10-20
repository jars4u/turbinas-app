"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { crearAgente, MAX_PASOS } = require("../src/agente");
const { ejecutarHerramienta, validarArgumentos, definicionesParaModelo } = require("../src/herramientas");
const { fuenteSimulada, modeloSimulado } = require("./ayudas");

const AHORA = () => new Date("2026-10-20T15:00:00Z");
const pregunta = (texto) => ({ mensajes: [{ rol: "usuario", texto }] });
const llamadaResumen = (argumentos = {}) => ({ tipo: "herramientas", llamadas: [{ id: "c1", nombre: "resumen_servicios_por_estado", argumentos }] });

test("contrato de la herramienta: una sola, sin argumentos y con esquema cerrado", () => {
  assert.deepEqual(definicionesParaModelo().map((h) => h.nombre), ["resumen_servicios_por_estado"]);
  const [def] = definicionesParaModelo();
  assert.deepEqual(def.esquema, { type: "object", properties: {}, additionalProperties: false });
  assert.ok(def.descripcion.length > 50);
});

test("la herramienta devuelve una estructura válida y solo lee conteos", async () => {
  const fuente = fuenteSimulada({ total: 12 });
  const { resultado } = await ejecutarHerramienta("resumen_servicios_por_estado", {}, { fuente, ahora: AHORA });
  assert.deepEqual(resultado.porEstado, [
    { nombre: "entregado", etiqueta: "Entregado", esEstadoFacturacion: false, dejaDeMostrarse: true, cantidad: 5 },
    { nombre: "proceso", etiqueta: "En proceso", esEstadoFacturacion: false, dejaDeMostrarse: false, cantidad: 3 },
    { nombre: "pagado", etiqueta: "Pagado", esEstadoFacturacion: true, dejaDeMostrarse: false, cantidad: 1 },
  ]);
  assert.equal(resultado.totalServicios, 12);
  assert.equal(resultado.conEstadoFueraDelCatalogo, 3);
  assert.equal(resultado.consultadoEn, "2026-10-20T15:00:00.000Z");
  assert.match(resultado.fuente, /Turbinas App/);
  // Solo métodos de lectura de la fuente (la fuente no expone escrituras)
  assert.deepEqual(fuente.llamadas, ["leerEstadosServicio", "contarVehiculos", "contarVehiculosConStatus:proceso", "contarVehiculosConStatus:entregado", "contarVehiculosConStatus:pagado"]);
});

test("catálogo con nombres vacíos, repetidos o demasiado largos: se omiten y se informa", async () => {
  const fuente = fuenteSimulada({ estados: [{ nombre: "a" }, { nombre: "a" }, { nombre: "" }, { nombre: "x".repeat(61) }, {}], total: 2, porStatus: { a: 2 } });
  const { resultado } = await ejecutarHerramienta("resumen_servicios_por_estado", {}, { fuente, ahora: AHORA });
  assert.equal(resultado.porEstado.length, 1);
  assert.ok(resultado.notas.some((n) => n.includes("4 estado(s)")));
});

test("argumentos inválidos y herramientas desconocidas se rechazan sin consultar datos", async () => {
  const fuente = fuenteSimulada();
  for (const args of [{ coleccion: "usuarios" }, { filtro: "status != ''" }, null, [], "texto"]) {
    const r = await ejecutarHerramienta("resumen_servicios_por_estado", args, { fuente, ahora: AHORA });
    assert.equal(r.error.codigo, "argumentos_invalidos", JSON.stringify(args));
  }
  for (const nombre of ["leer_coleccion", "usuarios", undefined, 42]) {
    const r = await ejecutarHerramienta(nombre, {}, { fuente, ahora: AHORA });
    assert.equal(r.error.codigo, "herramienta_desconocida");
  }
  assert.deepEqual(fuente.llamadas, []);
});

test("validarArgumentos aplica el esquema (tipos, enum, máximos, requeridos)", () => {
  const esquema = { type: "object", properties: { n: { type: "integer", minimum: 1, maximum: 5 }, m: { type: "string", enum: ["a"], maxLength: 3 } }, required: ["n"], additionalProperties: false };
  assert.equal(validarArgumentos(esquema, { n: 2, m: "a" }), null);
  assert.ok(validarArgumentos(esquema, { m: "a" }));
  assert.ok(validarArgumentos(esquema, { n: 9 }));
  assert.ok(validarArgumentos(esquema, { n: 2, m: "b" }));
  assert.ok(validarArgumentos(esquema, { n: 2, otro: true }));
});

test("falla de lectura: error controlado, sin detalles internos", async () => {
  const r = await ejecutarHerramienta("resumen_servicios_por_estado", {}, { fuente: fuenteSimulada({ falla: true }), ahora: AHORA });
  assert.deepEqual(r, { error: { codigo: "consulta_fallida", mensaje: "No se pudieron consultar los datos de Turbinas App." } });
});

test("pregunta general: el modelo responde sin consultar datos", async () => {
  const fuente = fuenteSimulada();
  const modelo = modeloSimulado([{ tipo: "texto", texto: "Una turbina comprime aire..." }]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder(pregunta("¿Qué es una turbina?"));
  assert.deepEqual(r, { texto: "Una turbina comprime aire...", consultas: [] });
  assert.deepEqual(fuente.llamadas, []);
  assert.deepEqual(modelo.entradas[0].herramientas.map((h) => h.nombre), ["resumen_servicios_por_estado"]);
  assert.match(modelo.entradas[0].sistema, /nunca inventes cifras/);
});

test("pregunta de datos: el modelo pide la herramienta, el servidor la ejecuta y devuelve la consulta", async () => {
  const fuente = fuenteSimulada();
  const modelo = modeloSimulado([
    llamadaResumen(),
    (entrada) => {
      const ultimo = entrada.conversacion[entrada.conversacion.length - 1];
      assert.equal(ultimo.rol, "herramienta");
      assert.equal(ultimo.resultados[0].esError, false);
      return { tipo: "texto", texto: `Datos de Turbinas App: ${ultimo.resultados[0].contenido.totalServicios} servicios.` };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder(pregunta("¿Cuántos servicios hay por estado?"));
  assert.equal(r.texto, "Datos de Turbinas App: 10 servicios.");
  assert.equal(r.consultas.length, 1);
  assert.equal(r.consultas[0].herramienta, "resumen_servicios_por_estado");
  assert.equal(r.consultas[0].resultado.totalServicios, 10);
});

test("si el modelo pide algo no permitido, recibe un error y no se consulta nada", async () => {
  const fuente = fuenteSimulada();
  const modelo = modeloSimulado([
    { tipo: "herramientas", llamadas: [{ id: "x", nombre: "leer_coleccion", argumentos: { coleccion: "usuarios" } }] },
    (entrada) => {
      const resultado = entrada.conversacion[entrada.conversacion.length - 1].resultados[0];
      assert.equal(resultado.esError, true);
      return { tipo: "texto", texto: "No tengo una herramienta para eso." };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder(pregunta("Lista los usuarios"));
  assert.equal(r.consultas[0].error.codigo, "herramienta_desconocida");
  assert.deepEqual(fuente.llamadas, []);
});

test("límite de pasos: si el modelo nunca termina se corta con error controlado", async () => {
  const modelo = modeloSimulado(Array.from({ length: MAX_PASOS + 2 }, () => llamadaResumen()));
  await assert.rejects(
    crearAgente({ modelo, fuente: fuenteSimulada(), ahora: AHORA }).responder(pregunta("x")),
    (e) => e.codigo === "limite_iteraciones" && e.estado === 502
  );
});

test("el código del servidor solo lee: sin escrituras y solo las colecciones previstas", () => {
  const dir = path.join(__dirname, "..", "src");
  const archivos = [];
  const recorrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? recorrer(path.join(d, e.name)) : archivos.push(path.join(d, e.name))));
  recorrer(dir);
  const fuente = archivos.map((a) => fs.readFileSync(a, "utf8")).join("\n");
  // Solo firebase.js accede a Firestore, y únicamente con lecturas
  const accesoFirestore = archivos.filter((a) => /getFirestore|collection\(/.test(fs.readFileSync(a, "utf8")));
  assert.deepEqual(accesoFirestore.map((a) => path.basename(a)), ["firebase.js"]);
  const firebase = fs.readFileSync(path.join(dir, "firebase.js"), "utf8");
  assert.ok(!/\.(set|update|add|create|delete)\(|batch\(|bulkWriter|runTransaction|recursiveDelete|listCollections/.test(firebase));
  const colecciones = [...fuente.matchAll(/collection\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(colecciones)].sort(), ["estadosServicio", "usuarios", "vehiculos"]);
});
