// Pruebas del perfilador con datos 100% SINTÉTICOS generados en una carpeta
// temporal (prefijo "perfilador-SINTETICO-"). No usan respaldos reales.
//
// Ejecutar: node --test scripts/perfilador-respaldo/
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const {
  perfilarRespaldo,
  formatearInforme,
  clasificarImporte,
  clasificarFecha,
  crearAcumulador,
  contextoVacio,
  agregarMetodoPago,
  agregarEstadoServicio,
  CAMPOS_POR_COLECCION,
  COLECCIONES_ANALIZADAS,
} = require("./perfilador");

const SCRIPT = path.join(__dirname, "perfilador.js");
const AHORA = new Date(Date.UTC(2026, 9, 19, 12));

// Valores que NUNCA deben aparecer en la salida
const SECRETOS = [
  "SINTETICO_NOMBRE_QX", "+580009990001", "SINTETICO_REF_77", "SINTETICO_OBS_SECRETA",
  "SINTETICO_DESC_EGRESO", "SINTETICO_CAJA_DESC", "SINTETICO_EMPLEADO", "sintetico-cxc-1",
  "ing-sintetico-1", "egr-sintetico-4", "nom-sintetico-1", "veh-sintetico-1", "V-SINTETICO-123",
  "sintetico-proyecto", "SINTETICO_SECRETO_EN_JSON_ROTO",
];
const IMPORTES = [
  "777.31", "98765.43", "4321.09", "555.55", "2379.89", "1111.11", "22222.22", "3333.33",
  "4444.44", "9.99", "100.01", "1234.5", "888.88", "45.67",
];

const ts = (y, m, d, h = 4) => ({ __tipo: "timestamp", seconds: Date.UTC(y, m - 1, d, h) / 1000, nanoseconds: 0 });
const doc = (id, datos, extra = {}) => ({ id, datos, ...extra });

const carpetasCreadas = [];

function crearCarpeta() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "perfilador-SINTETICO-"));
  carpetasCreadas.push(carpeta);
  return carpeta;
}

test.after(() => {
  for (const carpeta of carpetasCreadas) fs.rmSync(carpeta, { recursive: true, force: true });
});

function escribir(carpeta, nombre, contenido) {
  fs.writeFileSync(path.join(carpeta, nombre), typeof contenido === "string" ? contenido : JSON.stringify(contenido, null, 2));
}

function respaldoCompleto() {
  const c = crearCarpeta();
  escribir(c, "resumen.json", {
    proyecto: "sintetico-proyecto",
    fecha: "2026-10-18T12:00:00.000Z",
    colecciones: {
      ingresosMovimientos: 8, egresos: 6, nominas: 7, cierresDiarios: 3, cajaChicaMovimientos: 3,
      vehiculos: 5, metodosPago: 3, estadosServicio: 2, configuracion: 2, coleccionExtraSintetica: 1,
    },
  });
  escribir(c, "metodosPago.json", [
    doc("m1", { clave: "pago movil", nombre: "Pago móvil", moneda: "BS" }),
    doc("m2", { clave: "efectivo", moneda: "USD" }),
    doc("m3", { clave: "zelle", moneda: "USD" }),
  ]);
  escribir(c, "estadosServicio.json", [
    doc("s1", { nombre: "Facturado", defaultFacturar: true }),
    doc("s2", { nombre: "entregado" }),
  ]);
  escribir(c, "configuracion.json", [
    doc("configuracionCajaChica", { fondoCajaChica: 300 }),
    doc("factorConversion", { modo: "bcv_eur", valor: 45.67 }),
  ]);
  escribir(c, "ingresosMovimientos.json", [
    doc("ing-sintetico-1", {
      fecha: "05/10/2026", tipo: "servicio", customerName: "SINTETICO_NOMBRE_QX", customerPhone: "+580009990001",
      formasPago: [{ formaPago: "efectivo", monto: 777.31 }],
    }, { subcolecciones: { notas: [doc("sub-1", { texto: "SINTETICO_OBS_SECRETA" })] } }),
    doc("ing-sintetico-2", {
      fecha: "07/10/2026",
      formasPago: [{ formaPago: "PAGO MOVIL", montoBs: 98765.43, factorConversion: 41.5, usdEquiv: 2379.89, referencia: "SINTETICO_REF_77" }],
    }),
    // Cobro de cuenta por cobrar en Bs: monto como texto, sin conversión histórica
    doc("ing-sintetico-3", {
      fecha: "6/10/2026", tipo: "servicio", cuentaPorCobrarId: "sintetico-cxc-1",
      formasPago: [{ formaPago: "PAGO MÓVIL", monto: "4321.09" }],
    }),
    // Esquema antiguo: forma de pago suelta, fecha Timestamp
    doc("ing-sintetico-4", { fecha: ts(2026, 10, 8), formaPago: "zelle", monto: 555.55 }),
    // formasPago vacío, monto null, montoBs vacío, fecha imposible
    doc("ing-sintetico-5", { fecha: "31/02/2026", formasPago: [], monto: null, montoBs: "" }),
    // Importe negativo, cero y método no catalogado; sin fecha
    doc("ing-sintetico-6", {
      formasPago: [{ formaPago: "efectivo", monto: -12.5 }, { formaPago: "metodo raro sintetico", monto: 0 }],
    }),
    "entrada sintetica que no es objeto",
  ]);
  escribir(c, "egresos.json", [
    doc("egr-sintetico-1", {
      tipo: "factura", fecha: ts(2026, 10, 5), fechaStr: "05/10/2026", montoUSD: 1111.11, montoBs: 0, tasaFactura: 40,
      monedaFactura: "USD", proveedor: "SINTETICO_NOMBRE_QX", rifCi: "V-SINTETICO-123",
      items: [{ descripcion: "SINTETICO_DESC_EGRESO", cantidad: 1, precioUnitario: 1111.11, totalItem: 1111.11 }],
    }),
    // Día de fecha distinto de fechaStr
    doc("egr-sintetico-2", { tipo: "factura", fecha: ts(2026, 10, 7), fechaStr: "06/10/2026", montoUSD: 0, montoBs: 22222.22, tasaFactura: 41, monedaFactura: "Bs" }),
    doc("egr-sintetico-3", { tipo: "gastoDia", fecha: ts(2026, 10, 6), montoUSD: 0, montoBs: 3333.33, tasaFactura: null, monedaFactura: "Bs" }),
    // Reposición de caja chica: 'tasa' pero no 'tasaFactura', sin 'tipo'
    doc("egr-sintetico-4", { fecha: ts(2026, 10, 9, 15), divisa: "Bs", tasa: 40.5, montoUSD: 0, montoBs: 4444.44, descripcion: "SINTETICO_DESC_EGRESO" }),
    doc("egr-sintetico-5", { fecha: ts(2026, 10, 9, 15), divisa: "USD", montoUSD: -9.99, montoBs: 0 }),
    // Antiguo: sin tipo ni divisa, montoUSD en texto y además montoBs, sin tasa
    doc("egr-sintetico-6", { fecha: "10/10/2026", montoUSD: "15.5", montoBs: 66.6 }),
  ]);
  escribir(c, "nominas.json", [
    doc("nom-sintetico-1", { fechaInicio: "2026-09-28", fechaFin: "2026-10-02", fechaGuardado: ts(2026, 10, 2, 20),
      empleados: [{ id: "e1", nombre: "SINTETICO_EMPLEADO", monto: 100.01 }, { id: "e2", monto: 50 }] }),
    doc("nom-sintetico-2", { fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ id: "e1", monto: 100.01 }] }),
    doc("nom-sintetico-3", { fechaInicio: "2026-10-01", fechaFin: "2026-10-07", empleados: [{ nombre: "SINTETICO_EMPLEADO", monto: "30" }] }),
    doc("nom-sintetico-4", { fechaInicio: "2026-10-10", fechaFin: "2026-10-05", empleados: [] }),
    doc("nom-sintetico-5", { fechaFin: "2026-10-05", empleados: [{ id: "e3", monto: -5 }] }),
    doc("nom-sintetico-6", { fechaInicio: "2026-10-12", fechaFin: "2026-10-16", empleados: null }),
    doc("nom-sintetico-7", { fechaInicio: "2026-13-01", fechaFin: "2026-10-16", empleados: [{ id: "e1", monto: 10 }] }),
  ]);
  escribir(c, "cierresDiarios.json", [
    doc("c1", { fecha: "05/10/2026", fechaTimestamp: ts(2026, 10, 6, 3), tasa: 40, totalIngresosUSD: 1234.5, totalEgresosUSD: 0, observaciones: "Cierre automático" }),
    doc("c2", { fecha: "05/10/2026", fechaTimestamp: ts(2026, 10, 6, 3), tasa: 40, totalIngresosUSD: 1234.5, totalEgresosUSD: 0, observaciones: "Cierre automático" }),
    doc("c3", { fecha: { __tipo: "timestamp" }, observaciones: "SINTETICO_OBS_SECRETA", usuario: "SINTETICO_NOMBRE_QX" }),
  ]);
  escribir(c, "cajaChicaMovimientos.json", [
    doc("cc1", { tipo: "Egreso", divisa: "USD", monto: 7.77, montoBs: 0, fecha: ts(2026, 10, 9), descripcion: "SINTETICO_CAJA_DESC" }),
    doc("cc2", { tipo: "Egreso", divisa: "Bs", monto: 0, montoBs: 888.88, fecha: ts(2026, 10, 9) }),
    doc("cc3", { tipo: "Egreso", divisa: "Bs", monto: 5, montoBs: null, fecha: ts(2026, 10, 9) }),
  ]);
  escribir(c, "vehiculos.json", [
    doc("veh-sintetico-1", { status: "entregado", fechaEntrega: Date.UTC(2026, 9, 5, 18), precio: 20, customerName: "SINTETICO_NOMBRE_QX" }),
    doc("veh-sintetico-2", { status: "Facturado", precio: "25" }),
    doc("veh-sintetico-3", { status: "por_cobrar", precio: null }),
    doc("veh-sintetico-4", { status: "estado raro sintetico" }),
    doc("veh-sintetico-5", { estado: "Reparado" }),
  ]);
  return c;
}

function huella(carpeta) {
  const out = {};
  for (const f of fs.readdirSync(carpeta).sort()) {
    const ruta = path.join(carpeta, f);
    const st = fs.statSync(ruta);
    out[f] = { hash: crypto.createHash("sha256").update(fs.readFileSync(ruta)).digest("hex"), mtime: st.mtimeMs, size: st.size };
  }
  return out;
}

function sinFugas(texto) {
  for (const s of [...SECRETOS, ...IMPORTES]) {
    assert.ok(!texto.includes(s), `la salida no debe contener un valor individual (${s.length} caracteres)`);
  }
}

// ---------------------------------------------------------------------------

test("clasificarImporte distingue ausente, null, vacío, cero, texto e inválidos", () => {
  assert.equal(clasificarImporte(undefined), "ausente");
  assert.equal(clasificarImporte(null), "null");
  assert.equal(clasificarImporte(""), "cadena_vacia");
  assert.equal(clasificarImporte("   "), "cadena_vacia");
  assert.equal(clasificarImporte(0), "numero_cero");
  assert.equal(clasificarImporte(3), "numero_positivo");
  assert.equal(clasificarImporte(-3), "numero_negativo");
  assert.equal(clasificarImporte("0"), "texto_cero");
  assert.equal(clasificarImporte("12.5"), "texto_positivo");
  assert.equal(clasificarImporte("-2"), "texto_negativo");
  assert.equal(clasificarImporte("10,5"), "texto_con_coma_ambiguo");
  assert.equal(clasificarImporte("1.234,56"), "texto_con_coma_ambiguo");
  assert.equal(clasificarImporte("abc"), "texto_invalido");
  assert.equal(clasificarImporte(true), "tipo_invalido");
  assert.equal(clasificarImporte({ __tipo: "timestamp", seconds: 1 }), "tipo_invalido");
});

test("clasificarFecha interpreta Timestamps serializados y formatos de texto", () => {
  // 04:00 UTC es medianoche en Caracas: mismo día
  assert.deepEqual(clasificarFecha(ts(2026, 10, 5)), { cat: "timestamp", dia: "2026-10-05", anio: 2026 });
  // 03:00 UTC aún es el día anterior en Caracas
  assert.equal(clasificarFecha(ts(2026, 10, 6, 3)).dia, "2026-10-05");
  assert.equal(clasificarFecha({ __tipo: "timestamp" }).cat, "timestamp_invalido");
  assert.equal(clasificarFecha({ seconds: 5 }).cat, "objeto_seconds_sin_etiqueta");
  assert.equal(clasificarFecha({ __tipo: "geopoint", latitude: 1, longitude: 2 }).cat, "tipo_especial_inesperado");
  assert.equal(clasificarFecha("05/10/2026").dia, "2026-10-05");
  assert.equal(clasificarFecha("5-10-2026").cat, "texto_dd-mm-aaaa");
  assert.equal(clasificarFecha("31/02/2026").cat, "texto_dd/mm/aaaa_invalido");
  assert.equal(clasificarFecha("2026-09-28").dia, "2026-09-28");
  assert.equal(clasificarFecha("2026-13-01").cat, "texto_aaaa-mm-dd_invalido");
  assert.equal(clasificarFecha("ayer").cat, "texto_no_reconocido");
  assert.equal(clasificarFecha(Date.UTC(2026, 9, 5, 18)).cat, "numero_epoch_ms");
  assert.equal(clasificarFecha(1760000000).cat, "numero_posible_epoch_s");
  assert.equal(clasificarFecha(undefined).cat, "ausente");
  assert.equal(clasificarFecha(null).cat, "null");
  assert.equal(clasificarFecha("").cat, "cadena_vacia");
});

test("cobertura: formato { id, datos, subcolecciones? }, entradas inválidas y conteo vs resumen", () => {
  const c = respaldoCompleto();
  const p = perfilarRespaldo(c, { ahora: AHORA });
  assert.equal(p.estado, "VALIDO");
  assert.deepEqual(p.motivos, []);
  const ing = p.cobertura.ingresosMovimientos;
  assert.equal(ing.estado, "analizada");
  assert.equal(ing.entradas, 7);
  assert.equal(ing.documentosInvalidos, 1);
  assert.equal(ing.conSubcolecciones, 1);
  assert.equal(ing.coincideConResumen, true); // 7 entradas + 1 documento de subcolección
  assert.equal(p.cobertura.egresos.coincideConResumen, true);
  assert.deepEqual(p.otrasColecciones.nombres, ["coleccionExtraSintetica"]);
  assert.equal(p.fechaRespaldo, "2026-10-18");
  assert.deepEqual(p.configuracion, { estado: "analizada", fondoCajaChica: "numero_positivo", modoFactorConversion: "bcv_eur" });
});

test("ingresos: variantes de esquema, Bs sin conversión, texto y negativos", () => {
  const i = perfilarRespaldo(respaldoCompleto(), { ahora: AHORA }).resultados.ingresosMovimientos;
  assert.equal(i.documentos, 6);
  assert.deepEqual(i.varianteFormasPago, { formasPago_con_items: 4, formasPago_ausente: 1, formasPago_arreglo_vacio: 1 });
  assert.equal(i.variantesLegado.formaPago_suelto_en_raiz, 1);
  assert.equal(i.variantesLegado.montoBs_en_raiz, 1);
  assert.deepEqual(i.fecha.categorias, { "texto_dd/mm/aaaa": 3, timestamp: 1, "texto_dd/mm/aaaa_invalido": 1, ausente: 1 });
  assert.deepEqual(i.sinFormasPago.importeRaizUSD, { numero_positivo: 1, null: 1 });
  assert.deepEqual(i.sinFormasPago.importeRaizBs, { ausente: 1, cadena_vacia: 1 });

  const fp = i.formasPago;
  assert.equal(fp.items, 5);
  assert.deepEqual(fp.metodo, { efectivo: 2, "pago movil": 2, otro_no_catalogado: 1 });
  assert.equal(fp.metodosDesconocidosDistintos, 1);
  assert.equal(fp.variantesEscrituraPorMetodo["pago movil"], 2);
  assert.deepEqual(fp.moneda, { USD: 3, BS: 2 });
  assert.equal(fp.origenMoneda.valor_por_defecto_app_USD, 1);
  assert.deepEqual(fp.bs.fuenteImporte, { montoBs: 1, monto: 1 });
  assert.deepEqual(fp.bs.importe, { numero_positivo: 1, texto_positivo: 1 });
  assert.deepEqual(fp.bs.conversion, { usdEquiv_utilizable: 1, sin_conversion_historica: 1 });
  assert.deepEqual(fp.usd.importe, { numero_positivo: 1, numero_negativo: 1, numero_cero: 1 });
  assert.equal(i.documentosConBsSinConversion, 1);
  assert.equal(i.documentosConBsSinConversionYCuentaPorCobrar, 1);
  assert.equal(i.documentosConImporteNegativo, 1);
  assert.equal(i.presencia.monto.null, 1);
  assert.equal(i.presencia.montoBs.cadena_vacia, 1);
});

test("egresos: Bs con 'tasa' sin 'tasaFactura', variantes y fechas", () => {
  const e = perfilarRespaldo(respaldoCompleto(), { ahora: AHORA }).resultados.egresos;
  assert.equal(e.documentos, 6);
  assert.deepEqual(e.variantes, { factura: 2, gasto_dia: 1, indicio_reposicion_caja_chica: 2, sin_tipo_sin_indicio: 1 });
  assert.deepEqual(e.porVariante.indicio_reposicion_caja_chica.tasa, { solo_tasa_utilizable: 1, no_aplica_sin_bs: 1 });
  assert.deepEqual(e.porVariante.gasto_dia.tasa, { sin_tasa_utilizable: 1 });
  assert.deepEqual(e.porVariante.factura.tasa, { no_aplica_sin_bs: 1, tasaFactura_utilizable: 1 });
  assert.deepEqual(e.porVariante.sin_tipo_sin_indicio.tasa, { sin_tasa_utilizable: 1 });
  assert.equal(e.ambosMontosPositivos, 1);
  assert.equal(e.importeUSD.texto_positivo, 1);
  assert.equal(e.documentosConImporteNegativo, 1);
  assert.deepEqual(e.fechaVsFechaStr, { comparables: 2, diaDistinto: 1 });
  assert.equal(e.presencia.tasaFactura.null, 1);
  assert.equal(e.presencia.tasaFactura.ausente, 3);
});

test("nóminas: rangos inválidos y solapamiento por documento y por id de empleado", () => {
  const n = perfilarRespaldo(respaldoCompleto(), { ahora: AHORA }).resultados.nominas;
  assert.deepEqual(n.rango, { valido: 4, fin_antes_de_inicio: 1, falta_inicio: 1, fecha_no_interpretable: 1 });
  assert.equal(n.cruzanCambioDeMes, 2);
  assert.deepEqual(n.solapamiento, {
    criterio: "por_documento",
    rangosValidos: 4,
    paresSolapados: 3,
    paresConRangoIdentico: 1,
    documentosEnAlgunSolapamiento: 3,
    paresComparablesPorEmpleado: 1,
    paresSinIdsCompletos: 2,
    coincidenciasEmpleadoEnParesSolapados: 1,
  });
  assert.equal(n.empleados.documentosSinArreglo, 1);
  assert.equal(n.empleados.documentosArregloVacio, 1);
  assert.equal(n.empleados.monto.texto_positivo, 1);
  assert.equal(n.documentosConImporteNegativo, 1);
  assert.equal(n.documentosConTotalCeroOInvalido, 3);
});

test("cierres, caja chica y vehículos: tipos, Bs sin conversión y variantes de status", () => {
  const r = perfilarRespaldo(respaldoCompleto(), { ahora: AHORA }).resultados;
  const c = r.cierresDiarios;
  assert.equal(c.diasConMasDeUnCierre, 1);
  assert.equal(c.documentosEnDiasRepetidos, 2);
  assert.equal(c.fecha.categorias.timestamp_invalido, 1);
  assert.deepEqual(c.origen, { observacion_cierre_automatico: 2, otra_observacion: 1 });
  assert.equal(c.totalEgresosUSD.numero_cero, 2);

  const cc = r.cajaChicaMovimientos;
  assert.deepEqual(cc.divisa, { USD: 1, Bs: 2 });
  assert.deepEqual(cc.bs, { movimientos: 2, sinImporteBsUtilizable: 1, sinDatoDeConversion: 2, conMontoDistintoDeCero: 1 });

  const v = r.vehiculos;
  assert.deepEqual(v.status, { entregado: 1, facturado: 1, por_cobrar: 1, otro_no_catalogado: 1, reparado: 1 });
  assert.equal(v.statusDesconocidosDistintos, 1);
  assert.equal(v.entregadosSegunHeuristicaApp, 2);
  assert.equal(v.entregadosSinFechaUtilizable, 1);
  assert.equal(v.enEstadoDefaultFacturar, 1);
  assert.deepEqual(v.estadoDefaultFacturar, { configDisponible: true, cantidad: 1, reconocidoPorHeuristica: [false] });
  assert.equal(v.precio.texto_positivo, 1);
});

test("colecciones ausentes y archivos corruptos: no disponible / error, sin filtrar contenido", () => {
  const c = crearCarpeta();
  escribir(c, "resumen.json", { fecha: "2026-10-18T00:00:00Z", colecciones: { ingresosMovimientos: 0, egresos: 3, nominas: 2, cierresDiarios: 1 } });
  escribir(c, "ingresosMovimientos.json", []);
  escribir(c, "egresos.json", "{SINTETICO_SECRETO_EN_JSON_ROTO");
  escribir(c, "cierresDiarios.json", {});
  const p = perfilarRespaldo(c, { ahora: AHORA });
  assert.equal(p.cobertura.ingresosMovimientos.estado, "analizada");
  assert.equal(p.resultados.ingresosMovimientos.documentos, 0);
  assert.deepEqual(p.cobertura.egresos, { estado: "error", enResumen: true, error: "json_invalido" });
  assert.deepEqual(p.cobertura.cierresDiarios, { estado: "error", enResumen: true, error: "estructura_invalida" });
  assert.deepEqual(p.cobertura.nominas, { estado: "no_disponible", enResumen: true });
  assert.deepEqual(p.cobertura.vehiculos, { estado: "no_disponible", enResumen: false });
  assert.equal(p.resultados.nominas, undefined);
  assert.equal(p.resultados.egresos, undefined);
  const texto = formatearInforme(p);
  assert.match(texto, /nominas: NO DISPONIBLE \(no hay archivo; sí figura en resumen\.json\)/);
  assert.match(texto, /egresos: ERROR json_invalido/);
  assert.equal(p.estado, "INCOMPLETO");
  assert.ok(p.motivos.includes("nominas:no_disponible"));
  assert.ok(p.motivos.includes("egresos:error:json_invalido"));
  assert.ok(p.motivos.includes("metodosPago:no_disponible"));
  assert.match(texto, /ESTADO: INCOMPLETO — NO USAR COMO INFORME VÁLIDO/);
  sinFugas(texto + JSON.stringify(p));

  const cli = spawnSync(process.execPath, [SCRIPT, c], { encoding: "utf8" });
  assert.equal(cli.status, 3, "un informe incompleto termina con código 3");
});

test("los analizadores solo leen los campos de CAMPOS_POR_COLECCION (base de la proyección en vivo)", () => {
  const c = respaldoCompleto();
  const leer = (nombre) => JSON.parse(fs.readFileSync(path.join(c, `${nombre}.json`), "utf8")).filter((e) => e && e.datos).map((e) => e.datos);
  const vigilar = (datos, accedidos) => new Proxy(datos, { get: (t, k) => { if (typeof k === "string") accedidos.add(k); return t[k]; } });
  const fuera = (accedidos, nombre) => [...accedidos].filter((k) => !CAMPOS_POR_COLECCION[nombre].includes(k));

  const ctx = contextoVacio(2026);
  for (const [nombre, agregar] of [["metodosPago", agregarMetodoPago], ["estadosServicio", agregarEstadoServicio]]) {
    const accedidos = new Set();
    for (const d of leer(nombre)) agregar(ctx, vigilar(d, accedidos));
    assert.deepEqual(fuera(accedidos, nombre), [], nombre);
  }
  for (const nombre of COLECCIONES_ANALIZADAS) {
    const accedidos = new Set();
    const acumulador = crearAcumulador(nombre, ctx);
    for (const d of leer(nombre)) acumulador.procesar(vigilar(d, accedidos));
    acumulador.finalizar();
    assert.deepEqual(fuera(accedidos, nombre), [], nombre);
  }
});

test("validación de la ruta y de resumen.json", () => {
  assert.throws(() => perfilarRespaldo("relativa/sintetica"), /absoluta/);
  assert.throws(() => perfilarRespaldo(path.join(os.tmpdir(), "perfilador-SINTETICO-no-existe-xyz")), /no existe/);
  const sinResumen = crearCarpeta();
  assert.throws(() => perfilarRespaldo(sinResumen), /resumen\.json/);
  const resumenRoto = crearCarpeta();
  escribir(resumenRoto, "resumen.json", "{roto");
  assert.throws(() => perfilarRespaldo(resumenRoto), /json_invalido/);
  const resumenSinColecciones = crearCarpeta();
  escribir(resumenSinColecciones, "resumen.json", { fecha: "x" });
  assert.throws(() => perfilarRespaldo(resumenSinColecciones), /colecciones/);
});

test("CLI: salida agregada sin datos personales ni importes, y archivos de entrada intactos", () => {
  const c = respaldoCompleto();
  const antes = huella(c);

  const texto = spawnSync(process.execPath, [SCRIPT, c], { encoding: "utf8" });
  assert.equal(texto.status, 0, texto.stderr);
  assert.match(texto.stdout, /INGRESOS \(ingresosMovimientos\) — 6 documentos válidos/);
  assert.match(texto.stdout, /sin_conversion_historica: 1 de 2 \(50\.0%\)/);
  assert.match(texto.stdout, /criterio: POR DOCUMENTO/);
  sinFugas(texto.stdout + texto.stderr);

  const json = spawnSync(process.execPath, [SCRIPT, c, "--json"], { encoding: "utf8" });
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).resultados.egresos.documentos, 6);
  sinFugas(json.stdout + json.stderr);

  assert.deepEqual(huella(c), antes, "el respaldo no debe modificarse ni recibir archivos nuevos");
});

test("CLI: errores con mensaje sanitizado y código de salida 2", () => {
  const sinArgs = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(sinArgs.status, 2);
  const relativa = spawnSync(process.execPath, [SCRIPT, "SINTETICO_RUTA_RELATIVA"], { encoding: "utf8" });
  assert.equal(relativa.status, 2);
  assert.ok(!relativa.stderr.includes("SINTETICO_RUTA_RELATIVA"));
  assert.equal(relativa.stdout, "");
});

test("el perfilador no importa módulos de red, Firebase ni procesos", () => {
  const fuente = fs.readFileSync(SCRIPT, "utf8");
  const requeridos = [...fuente.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(requeridos, ["fs", "path"]);
  assert.ok(!/writeFile|appendFile|createWriteStream|mkdir|unlink|rename|copyFile/.test(fuente));
});
