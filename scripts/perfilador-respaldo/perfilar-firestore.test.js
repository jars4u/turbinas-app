// Pruebas del perfilador en vivo con un Firestore SIMULADO y datos 100% sintéticos.
// No se conecta a Firebase ni usa credenciales reales: la "clave" es un JSON
// sintético en una carpeta temporal y crearFirestore se sustituye por el simulado.
//
// Ejecutar: node --test scripts/perfilador-respaldo/perfilar-firestore.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ejecutar, parsearArgumentos, calcularMargen, PLAN, MARGEN_PORCENTAJE_DEFECTO, MARGEN_MINIMO_DEFECTO } = require("./perfilar-firestore");
const { perfilarRespaldo, CAMPOS_POR_COLECCION } = require("./perfilador");

const DIR_RESPALDO = path.join(__dirname, "..", "respaldo-firestore");
// Solo se usan las clases de tipos del SDK; no se inicializa ninguna app
const { Timestamp } = require(require.resolve("firebase-admin/firestore", { paths: [DIR_RESPALDO] }));
const { aJSON } = require(path.join(DIR_RESPALDO, "tipos.js"));

const AHORA = new Date(Date.UTC(2026, 9, 19, 12));
const PROYECTO = "sintetico-proyecto";
const SECRETOS = [
  "SINTETICO_NOMBRE_QX", "+580009990001", "SINTETICO_REF_77", "SINTETICO_OBS_SECRETA", "SINTETICO_DESC_EGRESO",
  "SINTETICO_CAJA_DESC", "SINTETICO_EMPLEADO", "V-SINTETICO-123", "sintetico-cxc-1", "SINTETICO-PLACA",
  "SINTETICO_CONFIG_SECRETO", "SINTETICO_SECRETO_ERROR", "SINTETICO-PRIVATE-KEY", "sintetico@ejemplo.invalid",
  "perfilador-SINTETICO-clave",
];
const IMPORTES = ["777.31", "4321.09", "98765.43", "2379.89", "555.55", "1111.11", "4444.44", "3333.33", "100.01", "1234.5", "888.88", "45.67"];

const ts = (y, m, d, h = 4) => Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, h)));

function datosSinteticos() {
  return {
    metodosPago: [{ clave: "pago movil", nombre: "Pago móvil", moneda: "BS" }, { clave: "efectivo", moneda: "USD" }],
    estadosServicio: [{ nombre: "Facturado", defaultFacturar: true }],
    ingresosMovimientos: [
      { fecha: "05/10/2026", tipo: "servicio", customerName: "SINTETICO_NOMBRE_QX", customerPhone: "+580009990001",
        formasPago: [{ formaPago: "efectivo", monto: 777.31, referencia: "SINTETICO_REF_77" }] },
      { fecha: ts(2026, 10, 6), cuentaPorCobrarId: "sintetico-cxc-1", formasPago: [{ formaPago: "PAGO MOVIL", monto: "4321.09" }] },
      { fecha: "07/10/2026", formasPago: [{ formaPago: "pago movil", montoBs: 98765.43, factorConversion: 41.5, usdEquiv: 2379.89 }] },
      { fecha: "31/02/2026", formaPago: "zelle", monto: -555.55, observaciones: "SINTETICO_OBS_SECRETA" },
    ],
    egresos: [
      { tipo: "factura", fecha: ts(2026, 10, 5), fechaStr: "05/10/2026", montoUSD: 1111.11, montoBs: 0, tasaFactura: 40, monedaFactura: "USD",
        proveedor: "SINTETICO_NOMBRE_QX", rifCi: "V-SINTETICO-123", items: [{ descripcion: "SINTETICO_DESC_EGRESO", cantidad: 1, precioUnitario: 1111.11 }] },
      { fecha: ts(2026, 10, 9, 15), divisa: "Bs", tasa: 40.5, montoUSD: 0, montoBs: 4444.44, descripcion: "SINTETICO_DESC_EGRESO" },
      { tipo: "gastoDia", fecha: ts(2026, 10, 6), montoUSD: 0, montoBs: 3333.33, tasaFactura: null, monedaFactura: "Bs" },
    ],
    nominas: [
      { fechaInicio: "2026-09-28", fechaFin: "2026-10-02", fechaGuardado: ts(2026, 10, 2, 20),
        empleados: [{ id: "e1", nombre: "SINTETICO_EMPLEADO", cedula: "V-SINTETICO-123", monto: 100.01 }] },
      { fechaInicio: "2026-10-01", fechaFin: "2026-10-07", empleados: [{ id: "e1", monto: 50 }] },
    ],
    cierresDiarios: [
      { fecha: "05/10/2026", fechaTimestamp: ts(2026, 10, 6, 3), tasa: 40, totalIngresosUSD: 1234.5, totalEgresosUSD: 0,
        observaciones: "Cierre automático", usuario: "SINTETICO_NOMBRE_QX" },
    ],
    cajaChicaMovimientos: [{ tipo: "Egreso", divisa: "Bs", monto: 0, montoBs: 888.88, fecha: ts(2026, 10, 9), descripcion: "SINTETICO_CAJA_DESC" }],
    vehiculos: [
      { status: "entregado", fechaEntrega: Date.UTC(2026, 9, 5, 18), precio: 20, customerName: "SINTETICO_NOMBRE_QX",
        placa: "SINTETICO-PLACA", historial: [{ usuario: "SINTETICO_NOMBRE_QX" }] },
      { status: "Facturado" },
    ],
    // Colecciones que NUNCA deben consultarse
    usuarios: [{ email: "sintetico@ejemplo.invalid", owner: true }],
    clientes: [{ nombre: "SINTETICO_NOMBRE_QX" }],
    configuracion: {
      factorConversion: { modo: "bcv_eur", valor: 45.67, secreto: "SINTETICO_CONFIG_SECRETO" },
      configuracionCajaChica: { fondoCajaChica: 300 },
      otroDocSintetico: { apiKey: "SINTETICO_CONFIG_SECRETO" },
    },
  };
}

/** Firestore simulado que registra cada acceso y rechaza lo no permitido. */
function crearSimulado(datos, { fallos = {}, conteos = {} } = {}) {
  const reg = { colecciones: [], selects: {}, counts: [], streams: [], destruidos: [], getAll: [], prohibidas: [], ordenIncremental: true, cerrado: false };
  const llamadasData = {};

  function vigilar(objeto, contexto) {
    return new Proxy(objeto, {
      get(target, prop) {
        if (typeof prop === "symbol" || prop === "then" || prop in target) return target[prop];
        reg.prohibidas.push(`${contexto}.${String(prop)}`);
        return () => {
          throw new Error(`operación prohibida: ${contexto}.${String(prop)}`);
        };
      },
    });
  }

  function errorSintetico(code) {
    return Object.assign(new Error("SINTETICO_SECRETO_ERROR"), { code });
  }

  function stream(nombre, docs, campos) {
    async function* generar() {
      for (let i = 0; i < docs.length; i++) {
        // Incremental: antes de entregar el doc i, los anteriores ya se procesaron
        if ((llamadasData[nombre] || 0) !== i) reg.ordenIncremental = false;
        if (fallos.stream && fallos.stream.coleccion === nombre && fallos.stream.despues === i) throw errorSintetico(14);
        const proyectado = {};
        for (const c of campos) if (c in docs[i]) proyectado[c] = docs[i][c];
        yield { data: () => { llamadasData[nombre] = (llamadasData[nombre] || 0) + 1; return proyectado; } };
      }
    }
    const it = generar();
    it.destroy = () => reg.destruidos.push(nombre);
    return it;
  }

  function coleccion(nombre) {
    reg.colecciones.push(nombre);
    const docs = Array.isArray(datos[nombre]) ? datos[nombre] : [];
    return vigilar({
      count: () => vigilar({
        get: async () => {
          reg.counts.push(nombre);
          if (fallos.count === nombre) throw errorSintetico(7);
          return { data: () => ({ count: conteos[nombre] ?? docs.length }) };
        },
      }, `${nombre}.count()`),
      select: (...campos) => {
        reg.selects[nombre] = campos;
        return vigilar({ stream: () => { reg.streams.push(nombre); return stream(nombre, docs, campos); } }, `${nombre}.select()`);
      },
      doc: (id) => ({ coleccion: nombre, id }),
    }, `collection(${nombre})`);
  }

  const db = vigilar({
    collection: coleccion,
    getAll: async (ref, opciones) => {
      reg.getAll.push({ ref: `${ref.coleccion}/${ref.id}`, fieldMask: opciones && opciones.fieldMask });
      const doc = datos[ref.coleccion] && datos[ref.coleccion][ref.id];
      const proyectado = {};
      if (doc) for (const c of opciones.fieldMask) if (c in doc) proyectado[c] = doc[c];
      return [{ exists: !!doc, data: () => proyectado }];
    },
  }, "db");

  return { reg, fabrica: () => ({ db, cerrar: async () => { reg.cerrado = true; } }) };
}

const carpetas = [];
function carpetaTemporal(prefijo) {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
  carpetas.push(c);
  return c;
}
test.after(() => {
  for (const c of carpetas) fs.rmSync(c, { recursive: true, force: true });
});

function claveSintetica(extra = {}) {
  const dir = carpetaTemporal("perfilador-SINTETICO-clave-");
  const ruta = path.join(dir, "clave-sintetica.json");
  fs.writeFileSync(ruta, JSON.stringify({
    type: "service_account", project_id: PROYECTO, client_email: "sintetico@ejemplo.invalid",
    private_key: "-----SINTETICO-PRIVATE-KEY-----", ...extra,
  }));
  return ruta;
}

/** Ejecuta el CLI con el simulado, bloqueando cualquier escritura en disco. */
async function correr(args, simulado, deps = {}) {
  let out = "";
  let err = "";
  const bloqueadas = ["writeFileSync", "writeFile", "appendFileSync", "appendFile", "mkdirSync", "mkdir", "createWriteStream", "copyFileSync", "renameSync", "rmSync", "unlinkSync"];
  const originales = {};
  const escrituras = [];
  for (const m of bloqueadas) {
    originales[m] = fs[m];
    fs[m] = (...a) => {
      escrituras.push(m);
      throw new Error("escritura en disco prohibida");
    };
  }
  let codigo;
  try {
    codigo = await ejecutar(["node", "perfilar-firestore.js", ...args], {
      crearFirestore: simulado ? simulado.fabrica : () => { throw new Error("no debe conectarse"); },
      entorno: {},
      ahora: AHORA,
      salida: { write: (s) => { out += s; } },
      errores: { write: (s) => { err += s; } },
      ...deps,
    });
  } finally {
    for (const m of bloqueadas) fs[m] = originales[m];
  }
  return { codigo, out, err, escrituras };
}

function sinFugas(texto) {
  for (const s of [...SECRETOS, ...IMPORTES]) assert.ok(!texto.includes(s), `la salida no debe contener un valor individual (${s.length} caracteres)`);
}

function verificarAccesosPermitidos(reg) {
  assert.deepEqual(reg.prohibidas, []);
  for (const c of reg.colecciones) assert.ok([...PLAN, "configuracion"].includes(c), `colección no permitida: ${c}`);
  assert.ok(!reg.colecciones.includes("usuarios") && !reg.colecciones.includes("clientes"));
}

// ---------------------------------------------------------------------------

test("margen: porcentaje configurable con mínimo absoluto y valores por defecto documentados", () => {
  assert.equal(MARGEN_PORCENTAJE_DEFECTO, 20);
  assert.equal(MARGEN_MINIMO_DEFECTO, 100);
  assert.equal(calcularMargen(17, 20, 100), 100);
  assert.equal(calcularMargen(10000, 20, 100), 2000);
  assert.equal(calcularMargen(101, 10, 0), 11);
  assert.equal(calcularMargen(0, 0, 0), 0);
});

test("argumentos: --leer exige --max-lecturas, números válidos y sin argumentos desconocidos", () => {
  assert.throws(() => parsearArgumentos(["--clave=/x", "--proyecto=sintetico-proyecto", "--leer"]), /max-lecturas/);
  assert.throws(() => parsearArgumentos(["--clave=/x", "--proyecto=sintetico-proyecto", "--max-lecturas=-1"]), /entero/);
  assert.throws(() => parsearArgumentos(["--clave=/x", "--proyecto=sintetico-proyecto", "--margen-porcentaje=5000"]), /superar/);
  assert.throws(() => parsearArgumentos(["--clave=/x", "--proyecto=sintetico-proyecto", "--max-lectura=5"]), /no reconocido/);
  assert.throws(() => parsearArgumentos(["--clave=/x"]), /proyecto/);
  const o = parsearArgumentos(["--clave=/x", "--proyecto=sintetico-proyecto", "--leer", "--max-lecturas=10", "--margen-porcentaje=5", "--margen-minimo=0"]);
  assert.deepEqual([o.leer, o.maxLecturas, o.margenPorcentaje, o.margenMinimo], [true, 10, 5, 0]);
});

test("validaciones previas: nada toca Firestore si la clave o el proyecto no son correctos", async () => {
  const clave = claveSintetica();
  const casos = [
    [["--clave=relativa/clave.json", `--proyecto=${PROYECTO}`], {}, /clave_ruta_relativa/],
    [[`--clave=${clave}`, "--proyecto=otro-proyecto"], {}, /proyecto_no_coincide/],
    [[`--clave=${clave}`, `--proyecto=${PROYECTO}`], { raizRepo: path.dirname(path.dirname(clave)) }, /clave_dentro_del_repositorio/],
    [[`--clave=${clave}`, `--proyecto=${PROYECTO}`], { entorno: { OneDrive: path.dirname(path.dirname(clave)) } }, /clave_en_carpeta_sincronizada/],
    [[`--clave=${claveSintetica({ type: "authorized_user" })}`, `--proyecto=${PROYECTO}`], {}, /clave_invalida/],
    [[`--clave=${path.join(path.dirname(clave), "no-existe.json")}`, `--proyecto=${PROYECTO}`], {}, /clave_no_accesible/],
    [[`--clave=${clave}`, `--proyecto=${PROYECTO}`, "--leer"], {}, /falta_max_lecturas/],
  ];
  for (const [args, deps, esperado] of casos) {
    const r = await correr(args, null, deps);
    assert.equal(r.codigo, 2);
    assert.match(r.err, esperado);
    assert.equal(r.out, "");
    sinFugas(r.err);
  }
});

test("preflight sin --leer: solo count() de la lista permitida, sin leer documentos", async () => {
  const sim = crearSimulado(datosSinteticos());
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`], sim);
  assert.equal(r.codigo, 0);
  assert.deepEqual(sim.reg.counts, PLAN);
  assert.deepEqual(sim.reg.streams, []);
  assert.deepEqual(sim.reg.getAll, []);
  verificarAccesosPermitidos(sim.reg);
  assert.match(r.out, /Lecturas estimadas para la fase de lectura: 17/);
  assert.match(r.out, /Margen de seguridad: max\(20% de la estimación, mínimo 100\) = 100/);
  assert.match(r.out, /Total estimado con margen: 117/);
  assert.match(r.out, /Límite autorizado \(--max-lecturas\): no indicado/);
  assert.match(r.out, /Fase de lectura NO ejecutada/);
  assert.ok(sim.reg.cerrado);
  assert.deepEqual(r.escrituras, []);
  sinFugas(r.out + r.err);
});

test("límite: si estimación + margen supera --max-lecturas, aborta antes de leer documentos", async () => {
  const sim = crearSimulado(datosSinteticos());
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=116"], sim);
  assert.equal(r.codigo, 4);
  assert.match(r.out, /ABORTADO antes de leer documentos: estimación \+ margen \(117\) supera --max-lecturas \(116\)/);
  assert.deepEqual(sim.reg.streams, []);
  assert.deepEqual(sim.reg.getAll, []);
});

test("lectura válida: proyección exacta, incremental, mismos resultados que el respaldo local y sin fugas", async () => {
  const datos = datosSinteticos();
  const sim = crearSimulado(datos);
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=117", "--json"], sim);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(r.escrituras, []);
  verificarAccesosPermitidos(sim.reg);
  assert.deepEqual(sim.reg.streams, PLAN);
  for (const nombre of PLAN) assert.deepEqual(sim.reg.selects[nombre], CAMPOS_POR_COLECCION[nombre]);
  assert.deepEqual(sim.reg.getAll, [{ ref: "configuracion/factorConversion", fieldMask: ["modo"] }]);
  assert.ok(sim.reg.ordenIncremental, "cada documento debe procesarse antes de pedir el siguiente");
  sinFugas(r.out + r.err);

  const { perfil } = JSON.parse(r.out);
  assert.equal(perfil.estado, "VALIDO");
  assert.equal(perfil.lecturas.contadas, 17);
  assert.equal(perfil.configuracion.modoFactorConversion, "bcv_eur");
  assert.equal(perfil.configuracion.fondoCajaChica, "no_solicitado");

  // Misma entrada como respaldo local (formato de respaldar.js) → mismos resultados
  const carpeta = carpetaTemporal("perfilador-SINTETICO-respaldo-");
  const colecciones = {};
  for (const [nombre, valor] of Object.entries(datos)) {
    const docs = Array.isArray(valor)
      ? valor.map((d, i) => ({ id: `${nombre}-${i}`, datos: aJSON(d) }))
      : Object.entries(valor).map(([id, d]) => ({ id, datos: aJSON(d) }));
    fs.writeFileSync(path.join(carpeta, `${nombre}.json`), JSON.stringify(docs));
    colecciones[nombre] = docs.length;
  }
  fs.writeFileSync(path.join(carpeta, "resumen.json"), JSON.stringify({ fecha: "2026-10-19T12:00:00Z", colecciones }));
  const local = perfilarRespaldo(carpeta, { ahora: AHORA });
  assert.deepEqual(perfil.resultados, JSON.parse(JSON.stringify(local.resultados)));
  assert.deepEqual(perfil.contexto, local.contexto);
  assert.equal(perfil.resultados.ingresosMovimientos.documentosConBsSinConversion, 1);
  assert.equal(perfil.resultados.egresos.porVariante.indicio_reposicion_caja_chica.tasa.solo_tasa_utilizable, 1);
});

test("informe de texto válido: estado, cobertura y lecturas separadas", async () => {
  const sim = crearSimulado(datosSinteticos());
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500"], sim);
  assert.equal(r.codigo, 0, r.err);
  assert.match(r.out, /ESTADO: VÁLIDO/);
  assert.match(r.out, /ingresosMovimientos: 4 documentos leídos \(count\(\) previo: 4\); subcolecciones no consultadas/);
  assert.match(r.out, /estimadas en preflight: 17; margen de seguridad: 100; total con margen: 117; límite autorizado: 500/);
  assert.match(r.out, /Otras colecciones: no consultadas/);
  sinFugas(r.out + r.err);
});

test("fallo de count(): no se lee ningún documento y no se presenta informe", async () => {
  const sim = crearSimulado(datosSinteticos(), { fallos: { count: "nominas" } });
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500"], sim);
  assert.equal(r.codigo, 3);
  assert.match(r.out, /ERROR en count\(\) de nominas: PERMISSION_DENIED/);
  assert.deepEqual(sim.reg.streams, []);
  assert.ok(!r.out.includes("ESTADO: VÁLIDO"));
  sinFugas(r.out + r.err);
});

test("colección requerida vacía o inexistente: NO VÁLIDO antes de leer", async () => {
  const datos = datosSinteticos();
  datos.nominas = [];
  const sim = crearSimulado(datos);
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500"], sim);
  assert.equal(r.codigo, 3);
  assert.match(r.out, /colecciones requeridas sin documentos o inexistentes: nominas/);
  assert.match(r.out, /ESTADO: NO VÁLIDO/);
  assert.deepEqual(sim.reg.streams, []);
});

test("caja chica vacía es un estado normal: la lectura es VÁLIDA y la colección figura con 0 documentos", async () => {
  const datos = datosSinteticos();
  datos.cajaChicaMovimientos = [];
  const sim = crearSimulado(datos);
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500", "--json"], sim);
  assert.equal(r.codigo, 0, r.err);
  const { perfil } = JSON.parse(r.out);
  assert.equal(perfil.estado, "VALIDO");
  assert.equal(perfil.cobertura.cajaChicaMovimientos.leidos, 0);
  assert.equal(perfil.resultados.cajaChicaMovimientos.documentos, 0);
});

test("error a mitad de lectura: INCOMPLETO, sin estadísticas parciales y con el resto sin leer", async () => {
  const sim = crearSimulado(datosSinteticos(), { fallos: { stream: { coleccion: "egresos", despues: 1 } } });
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500", "--json"], sim);
  assert.equal(r.codigo, 3);
  const { perfil } = JSON.parse(r.out);
  assert.equal(perfil.estado, "INCOMPLETO");
  assert.deepEqual(perfil.cobertura.egresos, { origen: "firestore", estado: "error", contados: 3, error: "consulta_o_procesamiento_fallido", codigo: "UNAVAILABLE" });
  assert.equal(perfil.cobertura.nominas.estado, "no_leida");
  assert.deepEqual(perfil.resultados, {});
  assert.ok(!sim.reg.streams.includes("nominas"));
  assert.ok(sim.reg.destruidos.includes("egresos"));
  sinFugas(r.out + r.err);

  const texto = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=500"],
    crearSimulado(datosSinteticos(), { fallos: { stream: { coleccion: "egresos", despues: 1 } } }));
  assert.match(texto.out, /ESTADO: INCOMPLETO — NO USAR COMO INFORME VÁLIDO/);
  assert.match(texto.out, /FIN DEL INFORME \(INCOMPLETO/);
  assert.ok(!texto.out.includes("INGRESOS (ingresosMovimientos)"));
});

test("límite en tiempo de lectura: si hay más documentos que los estimados, corta y marca INCOMPLETO", async () => {
  // count() subestima ingresos (1 en vez de 4): el tope local se alcanza antes de terminar
  const sim = crearSimulado(datosSinteticos(), { conteos: { ingresosMovimientos: 1 } });
  const r = await correr([`--clave=${claveSintetica()}`, `--proyecto=${PROYECTO}`, "--leer", "--max-lecturas=14", "--margen-porcentaje=0", "--margen-minimo=0", "--json"], sim);
  assert.equal(r.codigo, 3);
  const { perfil } = JSON.parse(r.out);
  assert.equal(perfil.estado, "INCOMPLETO");
  assert.equal(perfil.cobertura.cajaChicaMovimientos.error, "limite_lecturas_alcanzado");
  assert.equal(perfil.cobertura.vehiculos.estado, "no_leida");
  assert.ok(perfil.lecturas.contadas <= 14);
  assert.ok(!sim.reg.streams.includes("vehiculos"));
});

test("el código no importa red ni escribe: solo fs (lectura), path y el perfilador", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "perfilar-firestore.js"), "utf8");
  const requeridos = [...fuente.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(requeridos, ["./perfilador", "fs", "path"]);
  assert.ok(!/writeFile|appendFile|createWriteStream|mkdir|unlink|rename|copyFile|rmSync/.test(fuente));
  assert.ok(!/listCollections|listDocuments|\.set\(|\.update\(|\.add\(|batch\(|bulkWriter|runTransaction|recursiveDelete/.test(fuente));
  // El único .delete() permitido es cerrar la instancia local de la app de Firebase
  assert.deepEqual([...fuente.matchAll(/(\w+)\.delete\(/g)].map((m) => m[1]), ["app"]);
});
