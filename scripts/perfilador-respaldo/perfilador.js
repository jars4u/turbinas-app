// Perfilador estadístico de un respaldo LOCAL de Firestore hecho con
// scripts/respaldo-firestore/respaldar.js.
//
// Uso:
//   node scripts/perfilador-respaldo/perfilador.js <ruta-absoluta-carpeta-respaldo> [--json]
//
// La carpeta debe contener resumen.json y un <coleccion>.json por colección raíz,
// cada uno un arreglo de { id, datos, subcolecciones? } (ver respaldo-firestore/tipos.js).
//
// Garantías:
//   - Solo LEE archivos locales: no se conecta a Firebase ni a ningún servicio,
//     no usa credenciales, no escribe archivos ni copia registros.
//   - La salida (stdout) es solo agregada: conteos, porcentajes y categorías de
//     catálogos conocidos. Nunca imprime IDs, nombres, teléfonos, referencias,
//     observaciones, documentos ni importes individuales.
//   - Una colección cuyo archivo falta se informa como "no disponible", nunca como vacía.
//   - Si falta una colección requerida o un archivo no se puede leer, el informe
//     se marca INCOMPLETO y el proceso termina con código 3.
//
// Los analizadores son acumuladores incrementales (crearAcumulador): procesan un
// documento a la vez y solo conservan agregados. perfilar-firestore.js los reutiliza
// para leer directamente de Firestore sin guardar documentos.
"use strict";

const fs = require("fs");
const path = require("path");

const COLECCIONES_ANALIZADAS = [
  "ingresosMovimientos",
  "egresos",
  "nominas",
  "cierresDiarios",
  "cajaChicaMovimientos",
  "vehiculos",
];
// Colecciones de configuración que solo se usan como catálogo (monedas, estados)
const COLECCIONES_AUXILIARES = ["metodosPago", "estadosServicio", "configuracion"];
// Sin estas el informe no es válido: metodosPago decide la moneda de cada pago.
// cajaChicaMovimientos es opcional: la reposición borra los movimientos
// (CajaChica.js), así que 0 documentos es un estado normal.
const COLECCIONES_REQUERIDAS = [...COLECCIONES_ANALIZADAS.filter((n) => n !== "cajaChicaMovimientos"), "metodosPago"];

// Únicos campos que leen los analizadores. perfilar-firestore.js los usa como
// proyección (select), así que añadir aquí un campo amplía lo que se lee.
const CAMPOS_POR_COLECCION = {
  ingresosMovimientos: ["fecha", "fechaServicio", "formasPago", "formaPago", "monto", "montoUSD", "montoBs", "formaPago2", "monto2", "usdEquiv", "factorConversion", "precio", "precioBs", "tipo", "vehiculoId", "cuentaPorCobrarId"],
  egresos: ["fecha", "fechaStr", "montoUSD", "montoBs", "tasaFactura", "tasa", "tipo", "divisa", "monedaFactura", "items"],
  nominas: ["fechaInicio", "fechaFin", "fechaGuardado", "empleados", "total", "totalNomina", "montoTotal"],
  cierresDiarios: ["fecha", "fechaTimestamp", "tasa", "totalIngresosUSD", "totalIngresosBs", "totalEgresosUSD", "totalEgresosBs", "utilidadUSD", "utilidadBs", "observaciones"],
  cajaChicaMovimientos: ["fecha", "tipo", "monto", "montoBs", "divisa", "tasa", "tasaFactura", "usdEquiv"],
  vehiculos: ["status", "estado", "fechaEntrega", "deliveredAt", "updatedAt", "arrivalTime", "precio", "precioBs"],
  metodosPago: ["clave", "nombre", "moneda"],
  estadosServicio: ["nombre", "label", "defaultFacturar"],
};

// Venezuela usa UTC-4 fijo desde mayo de 2016 (antes, UTC-4:30)
const OFFSET_CARACAS_MS = -4 * 60 * 60 * 1000;
const ANIO_MINIMO_PLAUSIBLE = 2015;

// Catálogos fijos (vienen del código de la app, no de los datos)
const METODOS_BASE = ["efectivo", "binance", "pago movil", "zelle", "transferencia", "credito", "punto", "punto de venta", "usd", "$", "bs"];
const ESTADOS_BASE = ["por_cobrar", "entregado", "reparado", "completado", "facturado", "pendiente", "en proceso", "recibido", "cancelado"];
// Etiquetas tomadas de la configuración del respaldo: solo si son cortas y simples
const RE_ETIQUETA_SEGURA = /^[a-z0-9 $._]{1,24}$/;
const RE_NOMBRE_COLECCION = /^[A-Za-z0-9_]{1,40}$/;

const RE_NUMERO_TEXTO = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const RE_NUMERO_COMA = /^[+-]?\d{1,3}(\.\d{3})+,\d+$|^[+-]?\d+,\d+$/;

// ---------------------------------------------------------------------------
// Utilidades de clasificación
// ---------------------------------------------------------------------------

function esObjetoPlano(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function esTimestampSerializado(v) {
  return esObjetoPlano(v) && v.__tipo === "timestamp";
}

function sumar(mapa, clave, n = 1) {
  mapa[clave] = (mapa[clave] || 0) + n;
}

/** Tipo general de un campo, para las tablas de presencia. */
function tipoCampo(v) {
  if (v === undefined) return "ausente";
  if (v === null) return "null";
  if (typeof v === "string") return v.trim() === "" ? "cadena_vacia" : "texto";
  if (typeof v === "number") return v === 0 ? "numero_cero" : "numero";
  if (typeof v === "boolean") return "booleano";
  if (Array.isArray(v)) return v.length === 0 ? "arreglo_vacio" : "arreglo";
  if (esTimestampSerializado(v)) return "timestamp";
  if (esObjetoPlano(v) && typeof v.__tipo === "string") return "tipo_especial_otro";
  return "objeto";
}

/**
 * Clasifica un importe sin convertirlo: distingue ausente, null, vacío, cero,
 * números, números en texto, texto con coma decimal (ambiguo) e inválidos.
 */
function clasificarImporte(v) {
  if (v === undefined) return "ausente";
  if (v === null) return "null";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "numero_no_finito";
    if (v === 0) return "numero_cero";
    return v > 0 ? "numero_positivo" : "numero_negativo";
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return "cadena_vacia";
    if (RE_NUMERO_TEXTO.test(t)) {
      const n = Number(t);
      if (n === 0) return "texto_cero";
      return n > 0 ? "texto_positivo" : "texto_negativo";
    }
    if (RE_NUMERO_COMA.test(t)) return "texto_con_coma_ambiguo";
    return "texto_invalido";
  }
  return "tipo_invalido";
}

/** Valor numérico si es número finito o texto numérico inequívoco; si no, null. */
function valorNumerico(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && RE_NUMERO_TEXTO.test(v.trim())) return Number(v.trim());
  return null;
}

function esPositivoUtilizable(v) {
  const n = valorNumerico(v);
  return n !== null && n > 0;
}

function esNegativo(cat) {
  return cat === "numero_negativo" || cat === "texto_negativo";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fechaCalendarioValida(y, m, d) {
  if (!(y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function diaCaracasDesdeMs(ms) {
  const d = new Date(ms + OFFSET_CARACAS_MS);
  return { dia: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`, anio: d.getUTCFullYear() };
}

/**
 * Clasifica una fecha y, si es interpretable sin ambigüedad de formato, devuelve
 * el día calendario (YYYY-MM-DD) en hora de Caracas.
 */
function clasificarFecha(v) {
  if (v === undefined) return { cat: "ausente", dia: null };
  if (v === null) return { cat: "null", dia: null };
  if (esTimestampSerializado(v)) {
    if (typeof v.seconds !== "number" || !Number.isFinite(v.seconds)) return { cat: "timestamp_invalido", dia: null };
    return { cat: "timestamp", ...diaCaracasDesdeMs(v.seconds * 1000) };
  }
  if (esObjetoPlano(v)) {
    if (typeof v.__tipo === "string") return { cat: "tipo_especial_inesperado", dia: null };
    if (typeof v.seconds === "number") return { cat: "objeto_seconds_sin_etiqueta", dia: null };
    return { cat: "tipo_invalido", dia: null };
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { cat: "numero_no_reconocido", dia: null };
    if (v >= 946684800000 && v <= 4102444800000) return { cat: "numero_epoch_ms", ...diaCaracasDesdeMs(v) };
    if (v >= 946684800 && v <= 4102444800) return { cat: "numero_posible_epoch_s", dia: null };
    return { cat: "numero_no_reconocido", dia: null };
  }
  if (typeof v !== "string") return { cat: "tipo_invalido", dia: null };
  const t = v.trim();
  if (t === "") return { cat: "cadena_vacia", dia: null };
  let m = t.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/);
  if (m) {
    const [d, mes, y] = [Number(m[1]), Number(m[3]), Number(m[4])];
    const base = m[2] === "/" ? "texto_dd/mm/aaaa" : "texto_dd-mm-aaaa";
    if (!fechaCalendarioValida(y, mes, d)) return { cat: `${base}_invalido`, dia: null };
    return { cat: base, dia: `${y}-${pad2(mes)}-${pad2(d)}`, anio: y };
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!fechaCalendarioValida(y, mes, d)) return { cat: "texto_aaaa-mm-dd_invalido", dia: null };
    return { cat: "texto_aaaa-mm-dd", dia: `${y}-${pad2(mes)}-${pad2(d)}`, anio: y };
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const ms = Date.parse(t);
    if (Number.isNaN(ms)) return { cat: "texto_iso_invalido", dia: null };
    return { cat: "texto_iso_con_hora", ...diaCaracasDesdeMs(ms) };
  }
  return { cat: "texto_no_reconocido", dia: null };
}

function diaANumero(dia) {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Normalización idéntica a normalizarMetodo() de src/lib/metodosPago.js. */
function normalizarComoApp(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Categoría segura de un valor de catálogo; los desconocidos se agrupan. */
function categorizar(valor, catalogo) {
  if (valor === undefined || valor === null) return { cat: "ausente_o_null", desconocido: null };
  if (typeof valor !== "string") return { cat: "tipo_invalido", desconocido: null };
  const norm = normalizarComoApp(valor);
  if (norm === "") return { cat: "cadena_vacia", desconocido: null };
  if (catalogo.has(norm)) return { cat: norm, desconocido: null };
  return { cat: "otro_no_catalogado", desconocido: norm };
}

// ---------------------------------------------------------------------------
// Lectura y validación del respaldo
// ---------------------------------------------------------------------------

class ErrorRespaldo extends Error {}

function codigoSeguro(c) {
  return typeof c === "string" && /^[A-Z_]{1,20}$/.test(c) ? c : "DESCONOCIDO";
}

function leerJSON(ruta) {
  let texto;
  try {
    texto = fs.readFileSync(ruta, "utf8");
  } catch (e) {
    return { error: "error_lectura", codigo: codigoSeguro(e && e.code) };
  }
  try {
    return { valor: JSON.parse(texto.replace(/^﻿/, "")) };
  } catch (_) {
    // El mensaje de JSON.parse puede citar contenido del archivo: no se propaga
    return { error: "json_invalido" };
  }
}

function contarSubcolecciones(subs) {
  let total = 0;
  for (const docs of Object.values(subs)) {
    if (!Array.isArray(docs)) continue;
    total += docs.length;
    for (const d of docs) {
      if (esObjetoPlano(d) && esObjetoPlano(d.subcolecciones)) total += contarSubcolecciones(d.subcolecciones);
    }
  }
  return total;
}

function cargarColeccion(carpeta, nombre, resumen) {
  const ruta = path.join(carpeta, `${nombre}.json`);
  const enResumen = Object.prototype.hasOwnProperty.call(resumen.colecciones, nombre);
  if (!fs.existsSync(ruta)) {
    return { estado: "no_disponible", enResumen, docs: [] };
  }
  const lectura = leerJSON(ruta);
  if (lectura.error) return { estado: "error", error: lectura.error, codigo: lectura.codigo, enResumen, docs: [] };
  if (!Array.isArray(lectura.valor)) return { estado: "error", error: "estructura_invalida", enResumen, docs: [] };

  const docs = [];
  let invalidos = 0;
  let conSubcolecciones = 0;
  let totalRecursivo = 0;
  for (const entrada of lectura.valor) {
    totalRecursivo += 1;
    if (!esObjetoPlano(entrada) || !esObjetoPlano(entrada.datos)) {
      invalidos += 1;
      continue;
    }
    docs.push(entrada.datos);
    if (esObjetoPlano(entrada.subcolecciones)) {
      conSubcolecciones += 1;
      totalRecursivo += contarSubcolecciones(entrada.subcolecciones);
    }
  }
  const esperado = enResumen ? resumen.colecciones[nombre] : null;
  return {
    estado: "analizada",
    enResumen,
    entradas: lectura.valor.length,
    documentosInvalidos: invalidos,
    conSubcolecciones,
    coincideConResumen: typeof esperado === "number" ? esperado === totalRecursivo : null,
    docs,
  };
}

function cargarRespaldo(carpeta) {
  if (typeof carpeta !== "string" || !path.isAbsolute(carpeta)) {
    throw new ErrorRespaldo("La ruta del respaldo debe ser absoluta.");
  }
  let stat;
  try {
    stat = fs.statSync(carpeta);
  } catch (_) {
    throw new ErrorRespaldo("La ruta indicada no existe o no es accesible.");
  }
  if (!stat.isDirectory()) throw new ErrorRespaldo("La ruta indicada no es una carpeta.");
  const rutaResumen = path.join(carpeta, "resumen.json");
  if (!fs.existsSync(rutaResumen)) throw new ErrorRespaldo("La carpeta no contiene resumen.json.");
  const resumen = leerJSON(rutaResumen);
  if (resumen.error) throw new ErrorRespaldo(`resumen.json no se pudo leer (${resumen.error}).`);
  if (!esObjetoPlano(resumen.valor) || !esObjetoPlano(resumen.valor.colecciones)) {
    throw new ErrorRespaldo("resumen.json no tiene el formato de respaldar.js (falta 'colecciones').");
  }

  const colecciones = {};
  for (const nombre of [...COLECCIONES_ANALIZADAS, ...COLECCIONES_AUXILIARES]) {
    colecciones[nombre] = cargarColeccion(carpeta, nombre, resumen.valor);
  }

  // Otras colecciones presentes (solo nombres con formato de identificador)
  const conocidas = new Set([...COLECCIONES_ANALIZADAS, ...COLECCIONES_AUXILIARES]);
  const otras = new Set(Object.keys(resumen.valor.colecciones));
  for (const archivo of fs.readdirSync(carpeta)) {
    if (archivo.endsWith(".json") && archivo !== "resumen.json") otras.add(archivo.slice(0, -5));
  }
  const otrasColecciones = [...otras].filter((n) => !conocidas.has(n));

  return {
    resumenFecha: typeof resumen.valor.fecha === "string" ? clasificarFecha(resumen.valor.fecha).dia : null,
    colecciones,
    otrasColecciones: {
      nombres: otrasColecciones.filter((n) => RE_NOMBRE_COLECCION.test(n)).sort(),
      noMostradas: otrasColecciones.filter((n) => !RE_NOMBRE_COLECCION.test(n)).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Catálogos a partir de la configuración del respaldo
// ---------------------------------------------------------------------------

function contextoVacio(anioActual) {
  return {
    anioActual,
    catalogoMetodos: new Set(METODOS_BASE),
    monedaPorMetodo: new Map(),
    configMetodosDisponible: false,
    catalogoEstados: new Set(ESTADOS_BASE),
    estadosFacturar: [],
    configEstadosDisponible: false,
  };
}

/** Incorpora un documento de metodosPago al contexto (catálogo y moneda). */
function agregarMetodoPago(ctx, m) {
  const claveRaw = m.clave || m.nombre;
  if (typeof claveRaw !== "string") return;
  const clave = normalizarComoApp(claveRaw);
  if (!RE_ETIQUETA_SEGURA.test(clave)) return;
  ctx.catalogoMetodos.add(clave);
  if (m.moneda === "BS" || m.moneda === "USD") ctx.monedaPorMetodo.set(clave, m.moneda);
}

/** Incorpora un documento de estadosServicio al contexto. */
function agregarEstadoServicio(ctx, e) {
  for (const campo of ["nombre", "label"]) {
    if (typeof e[campo] !== "string") continue;
    const n = normalizarComoApp(e[campo]);
    if (RE_ETIQUETA_SEGURA.test(n)) ctx.catalogoEstados.add(n);
  }
  if (e.defaultFacturar && typeof e.nombre === "string") ctx.estadosFacturar.push(e.nombre);
}

function construirContexto(colecciones, anioActual) {
  const ctx = contextoVacio(anioActual);
  if (colecciones.metodosPago.estado === "analizada") {
    ctx.configMetodosDisponible = true;
    for (const m of colecciones.metodosPago.docs) agregarMetodoPago(ctx, m);
  }
  if (colecciones.estadosServicio.estado === "analizada") {
    ctx.configEstadosDisponible = true;
    for (const e of colecciones.estadosServicio.docs) agregarEstadoServicio(ctx, e);
  }
  return ctx;
}

/** Moneda que usaría la app hoy para un método (getMonedaMetodo) y su origen. */
function resolverMoneda(formaPago, ctx) {
  const clave = typeof formaPago === "string" ? normalizarComoApp(formaPago) : "";
  if (ctx.monedaPorMetodo.has(clave)) return { moneda: ctx.monedaPorMetodo.get(clave), origen: "config_metodosPago_del_respaldo" };
  if (clave === "pago movil") return { moneda: "BS", origen: "regla_legado_pago_movil" };
  return { moneda: "USD", origen: "valor_por_defecto_app_USD" };
}

function fueraDeRango(fecha, ctx) {
  return fecha.anio !== undefined && fecha.anio !== null &&
    (fecha.anio < ANIO_MINIMO_PLAUSIBLE || fecha.anio > ctx.anioActual + 1);
}

function presenciaInicial(campos) {
  const tabla = {};
  for (const campo of campos) tabla[campo] = {};
  return tabla;
}

function sumarPresencia(tabla, d) {
  for (const campo of Object.keys(tabla)) sumar(tabla[campo], tipoCampo(d[campo]));
}

function registrarFecha(destino, valor, ctx) {
  const f = clasificarFecha(valor);
  sumar(destino.categorias, f.cat);
  if (fueraDeRango(f, ctx)) destino.fueraDeRangoPlausible += 1;
  return f;
}

function nuevaFecha() {
  return { categorias: {}, fueraDeRangoPlausible: 0 };
}

// ---------------------------------------------------------------------------
// Acumuladores por colección: procesar(datos) por documento, finalizar() al final.
// Solo conservan agregados; los valores de los documentos se descartan al
// terminar cada procesar(). Excepciones acotadas: conjuntos de valores distintos
// (para contar variantes) y, en nóminas, el rango y los ids de empleado de cada
// documento con rango válido (necesarios para calcular solapamientos).
// ---------------------------------------------------------------------------

function acumuladorIngresos(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.ingresosMovimientos),
    fecha: nuevaFecha(),
    fechaServicio: nuevaFecha(),
    tipo: {},
    varianteFormasPago: {},
    variantesLegado: {},
    sinFormasPago: { total: 0, importeRaizUSD: {}, importeRaizBs: {} },
    documentosConBsSinConversion: 0,
    documentosConBsSinConversionYCuentaPorCobrar: 0,
    documentosConImporteNegativo: 0,
    formasPago: {
      items: 0,
      itemsNoObjeto: 0,
      metodo: {},
      metodosDesconocidosDistintos: 0,
      variantesEscrituraPorMetodo: {},
      moneda: {},
      origenMoneda: {},
      bs: { items: 0, fuenteImporte: {}, importe: {}, conversion: {}, usdEquivNoUtilizable: 0 },
      usd: { items: 0, fuenteImporte: {}, importe: {}, conMontoBs: 0 },
    },
  };
  const desconocidos = new Set();
  const escrituras = {};

  function procesar(d) {
    r.documentos += 1;
    sumarPresencia(r.presencia, d);
    registrarFecha(r.fecha, d.fecha, ctx);
    if (d.fechaServicio !== undefined) registrarFecha(r.fechaServicio, d.fechaServicio, ctx);
    sumar(r.tipo, categorizar(d.tipo, new Set(["servicio", "manual"])).cat);

    let negativo = false;
    const fp = d.formasPago;
    let variante;
    if (Array.isArray(fp)) variante = fp.length > 0 ? "formasPago_con_items" : "formasPago_arreglo_vacio";
    else if (fp === undefined) variante = "formasPago_ausente";
    else variante = "formasPago_tipo_invalido";
    sumar(r.varianteFormasPago, variante);

    if (typeof d.formaPago === "string" && d.formaPago.trim() !== "") sumar(r.variantesLegado, "formaPago_suelto_en_raiz");
    if (d.formaPago2 !== undefined || d.monto2 !== undefined) sumar(r.variantesLegado, "campos_2_sueltos_en_raiz");
    if (d.montoBs !== undefined) sumar(r.variantesLegado, "montoBs_en_raiz");
    if (d.usdEquiv !== undefined || d.factorConversion !== undefined) sumar(r.variantesLegado, "conversion_en_raiz");

    if (variante !== "formasPago_con_items") {
      // Lo que leería buildReportData sin formasPago: montoUSD || monto, y montoBs
      r.sinFormasPago.total += 1;
      const usdRaiz = d.montoUSD !== undefined ? d.montoUSD : d.monto;
      const catUsd = clasificarImporte(usdRaiz);
      const catBs = clasificarImporte(d.montoBs);
      sumar(r.sinFormasPago.importeRaizUSD, catUsd);
      sumar(r.sinFormasPago.importeRaizBs, catBs);
      if (esNegativo(catUsd) || esNegativo(catBs)) negativo = true;
    }

    let bsSinConversion = false;
    for (const item of Array.isArray(fp) ? fp : []) {
      r.formasPago.items += 1;
      if (!esObjetoPlano(item)) {
        r.formasPago.itemsNoObjeto += 1;
        continue;
      }
      const cat = categorizar(item.formaPago, ctx.catalogoMetodos);
      sumar(r.formasPago.metodo, cat.cat);
      if (cat.desconocido !== null) desconocidos.add(cat.desconocido);
      if (typeof item.formaPago === "string" && cat.desconocido === null) {
        (escrituras[cat.cat] = escrituras[cat.cat] || new Set()).add(item.formaPago);
      }
      const { moneda, origen } = resolverMoneda(item.formaPago, ctx);
      sumar(r.formasPago.moneda, moneda);
      sumar(r.formasPago.origenMoneda, origen);

      if (moneda === "BS") {
        const bs = r.formasPago.bs;
        bs.items += 1;
        // Igual que la app: montoBs si existe; si no, monto
        const usaMontoBs = item.montoBs !== undefined && item.montoBs !== null;
        const fuente = usaMontoBs ? "montoBs" : item.monto !== undefined && item.monto !== null ? "monto" : "ninguno";
        sumar(bs.fuenteImporte, fuente);
        const catImp = clasificarImporte(usaMontoBs ? item.montoBs : item.monto);
        sumar(bs.importe, catImp);
        if (esNegativo(catImp)) negativo = true;

        let conversion;
        if (esPositivoUtilizable(item.usdEquiv)) conversion = "usdEquiv_utilizable";
        else if (esPositivoUtilizable(item.factorConversion)) conversion = "solo_factorConversion_utilizable";
        else conversion = "sin_conversion_historica";
        sumar(bs.conversion, conversion);
        if (item.usdEquiv !== undefined && !esPositivoUtilizable(item.usdEquiv)) bs.usdEquivNoUtilizable += 1;
        if (conversion === "sin_conversion_historica") bsSinConversion = true;
      } else {
        const usd = r.formasPago.usd;
        usd.items += 1;
        // Igual que buildReportData: monto || montoUSD || usdEquiv
        const fuente = item.monto !== undefined ? "monto" : item.montoUSD !== undefined ? "montoUSD" : item.usdEquiv !== undefined ? "usdEquiv" : "ninguno";
        sumar(usd.fuenteImporte, fuente);
        const catImp = clasificarImporte(fuente === "ninguno" ? undefined : item[fuente]);
        sumar(usd.importe, catImp);
        if (esNegativo(catImp)) negativo = true;
        if (item.montoBs !== undefined) usd.conMontoBs += 1;
      }
    }
    if (bsSinConversion) {
      r.documentosConBsSinConversion += 1;
      if (typeof d.cuentaPorCobrarId === "string" && d.cuentaPorCobrarId !== "") r.documentosConBsSinConversionYCuentaPorCobrar += 1;
    }
    if (negativo) r.documentosConImporteNegativo += 1;
  }

  function finalizar() {
    r.formasPago.metodosDesconocidosDistintos = desconocidos.size;
    for (const [cat, set] of Object.entries(escrituras)) r.formasPago.variantesEscrituraPorMetodo[cat] = set.size;
    return r;
  }

  return { procesar, finalizar };
}

function totalItems(items) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const it of items) {
    if (!esObjetoPlano(it)) continue;
    const t = valorNumerico(it.totalItem);
    if (t !== null && t > 0) total += t;
    else {
      const c = valorNumerico(it.cantidad);
      const p = valorNumerico(it.precioUnitario);
      if (c !== null && p !== null) total += c * p;
    }
  }
  return total;
}

function varianteEgreso(d) {
  if (d.tipo === "factura") return "factura";
  if (d.tipo === "gastoDia") return "gasto_dia";
  if (d.tipo === undefined || d.tipo === null || d.tipo === "") {
    // CajaChica.js (reposición) escribe 'divisa' y no escribe 'tipo'
    return d.divisa !== undefined ? "indicio_reposicion_caja_chica" : "sin_tipo_sin_indicio";
  }
  return "tipo_no_catalogado";
}

function acumuladorEgresos(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.egresos),
    fecha: nuevaFecha(),
    fechaStr: nuevaFecha(),
    fechaVsFechaStr: { comparables: 0, diaDistinto: 0 },
    importeUSD: {},
    importeBs: {},
    monedaFactura: {},
    variantes: {},
    porVariante: {},
    ambosMontosPositivos: 0,
    soloImporteEnItems: 0,
    sinImporteUtilizable: 0,
    monedaFacturaIncoherente: 0,
    documentosConImporteNegativo: 0,
  };

  function procesar(d) {
    r.documentos += 1;
    sumarPresencia(r.presencia, d);
    const f = registrarFecha(r.fecha, d.fecha, ctx);
    if (d.fechaStr !== undefined) {
      const fs2 = registrarFecha(r.fechaStr, d.fechaStr, ctx);
      if (f.dia && fs2.dia) {
        r.fechaVsFechaStr.comparables += 1;
        if (f.dia !== fs2.dia) r.fechaVsFechaStr.diaDistinto += 1;
      }
    }
    const catUSD = clasificarImporte(d.montoUSD);
    const catBs = clasificarImporte(d.montoBs);
    sumar(r.importeUSD, catUSD);
    sumar(r.importeBs, catBs);
    if (esNegativo(catUSD) || esNegativo(catBs)) r.documentosConImporteNegativo += 1;

    const monedaCat = d.monedaFactura === undefined ? "ausente" : typeof d.monedaFactura === "string" ? (["usd", "bs"].includes(d.monedaFactura.trim().toLowerCase()) ? d.monedaFactura.trim().toLowerCase() : "otro_no_catalogado") : "tipo_invalido";
    sumar(r.monedaFactura, monedaCat);

    const usdPos = esPositivoUtilizable(d.montoUSD);
    const bsPos = esPositivoUtilizable(d.montoBs);
    const items = totalItems(d.items);
    if (usdPos && bsPos) r.ambosMontosPositivos += 1;
    if (!usdPos && !bsPos) {
      if (items > 0) r.soloImporteEnItems += 1;
      else r.sinImporteUtilizable += 1;
    }
    if ((monedaCat === "usd" && bsPos && !usdPos) || (monedaCat === "bs" && usdPos && !bsPos)) r.monedaFacturaIncoherente += 1;

    const esBs = bsPos || (monedaCat === "bs" && !usdPos && items > 0);
    let tasa = "no_aplica_sin_bs";
    if (esBs) {
      if (esPositivoUtilizable(d.tasaFactura)) tasa = "tasaFactura_utilizable";
      else if (esPositivoUtilizable(d.tasa)) tasa = "solo_tasa_utilizable";
      else tasa = "sin_tasa_utilizable";
    }

    const variante = varianteEgreso(d);
    sumar(r.variantes, variante);
    const pv = (r.porVariante[variante] = r.porVariante[variante] || { documentos: 0, conBs: 0, tasa: {}, conItems: 0, conFechaStr: 0 });
    pv.documentos += 1;
    if (esBs) pv.conBs += 1;
    sumar(pv.tasa, tasa);
    if (Array.isArray(d.items) && d.items.length > 0) pv.conItems += 1;
    if (d.fechaStr !== undefined) pv.conFechaStr += 1;
  }

  return { procesar, finalizar: () => r };
}

function acumuladorNominas(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.nominas),
    fechaInicio: nuevaFecha(),
    fechaFin: nuevaFecha(),
    fechaGuardado: nuevaFecha(),
    rango: {},
    duracionDias: {},
    cruzanCambioDeMes: 0,
    solapamiento: {
      criterio: "por_documento",
      rangosValidos: 0,
      paresSolapados: 0,
      paresConRangoIdentico: 0,
      documentosEnAlgunSolapamiento: 0,
      paresComparablesPorEmpleado: 0,
      paresSinIdsCompletos: 0,
      coincidenciasEmpleadoEnParesSolapados: 0,
    },
    empleados: { documentosSinArreglo: 0, documentosArregloVacio: 0, items: 0, itemsNoObjeto: 0, itemsConId: 0, documentosConIdRepetido: 0, monto: {} },
    documentosConTotalCeroOInvalido: 0,
    documentosConImporteNegativo: 0,
  };
  // Resumen derivado por documento con rango válido (no el documento)
  const validos = [];

  function procesar(d) {
    r.documentos += 1;
    sumarPresencia(r.presencia, d);
    const ini = registrarFecha(r.fechaInicio, d.fechaInicio, ctx);
    const fin = registrarFecha(r.fechaFin, d.fechaFin, ctx);
    registrarFecha(r.fechaGuardado, d.fechaGuardado, ctx);

    let estado;
    if (d.fechaInicio === undefined || d.fechaInicio === null || d.fechaInicio === "") estado = "falta_inicio";
    else if (d.fechaFin === undefined || d.fechaFin === null || d.fechaFin === "") estado = "falta_fin";
    else if (!ini.dia || !fin.dia) estado = "fecha_no_interpretable";
    else if (diaANumero(fin.dia) < diaANumero(ini.dia)) estado = "fin_antes_de_inicio";
    else estado = "valido";
    sumar(r.rango, estado);

    let negativo = false;
    let suma = 0;
    const ids = [];
    let idsCompletos = true;
    if (!Array.isArray(d.empleados)) {
      r.empleados.documentosSinArreglo += 1;
      idsCompletos = false;
    } else {
      if (d.empleados.length === 0) {
        r.empleados.documentosArregloVacio += 1;
        idsCompletos = false;
      }
      for (const e of d.empleados) {
        r.empleados.items += 1;
        if (!esObjetoPlano(e)) {
          r.empleados.itemsNoObjeto += 1;
          idsCompletos = false;
          continue;
        }
        const cat = clasificarImporte(e.monto);
        sumar(r.empleados.monto, cat);
        if (esNegativo(cat)) negativo = true;
        const n = valorNumerico(e.monto);
        if (n !== null) suma += n;
        if (typeof e.id === "string" && e.id !== "") {
          r.empleados.itemsConId += 1;
          ids.push(e.id);
        } else idsCompletos = false;
      }
      if (new Set(ids).size !== ids.length) r.empleados.documentosConIdRepetido += 1;
    }
    if (!(suma > 0)) r.documentosConTotalCeroOInvalido += 1;
    if (negativo) r.documentosConImporteNegativo += 1;

    if (estado === "valido") {
      const a = diaANumero(ini.dia);
      const b = diaANumero(fin.dia);
      const dias = b - a + 1;
      sumar(r.duracionDias, dias <= 7 ? "1-7" : dias <= 16 ? "8-16" : dias <= 31 ? "17-31" : "mas_de_31");
      if (ini.dia.slice(0, 7) !== fin.dia.slice(0, 7)) r.cruzanCambioDeMes += 1;
      validos.push({ a, b, ids: idsCompletos ? new Set(ids) : null });
    }
  }

  function finalizar() {
    // Solapamiento entre documentos: intervalos de días inclusivos [inicio, fin]
    const s = r.solapamiento;
    s.rangosValidos = validos.length;
    validos.sort((x, y) => x.a - y.a);
    const involucrados = new Set();
    for (let i = 0; i < validos.length; i++) {
      for (let j = i + 1; j < validos.length && validos[j].a <= validos[i].b; j++) {
        s.paresSolapados += 1;
        involucrados.add(i);
        involucrados.add(j);
        if (validos[i].a === validos[j].a && validos[i].b === validos[j].b) s.paresConRangoIdentico += 1;
        if (validos[i].ids && validos[j].ids) {
          s.paresComparablesPorEmpleado += 1;
          for (const id of validos[i].ids) if (validos[j].ids.has(id)) s.coincidenciasEmpleadoEnParesSolapados += 1;
        } else s.paresSinIdsCompletos += 1;
      }
    }
    s.documentosEnAlgunSolapamiento = involucrados.size;
    return r;
  }

  return { procesar, finalizar };
}

function acumuladorCierres(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.cierresDiarios),
    fecha: nuevaFecha(),
    fechaTimestamp: nuevaFecha(),
    origen: {},
    totalEgresosUSD: {},
    totalIngresosUSD: {},
    tasa: {},
    diasConMasDeUnCierre: 0,
    documentosEnDiasRepetidos: 0,
    documentosSinDiaInterpretable: 0,
  };
  const porDia = {};

  function procesar(d) {
    r.documentos += 1;
    sumarPresencia(r.presencia, d);
    const f = registrarFecha(r.fecha, d.fecha, ctx);
    registrarFecha(r.fechaTimestamp, d.fechaTimestamp, ctx);
    sumar(r.origen, d.observaciones === "Cierre automático" ? "observacion_cierre_automatico" : d.observaciones === undefined || d.observaciones === "" ? "sin_observaciones" : "otra_observacion");
    sumar(r.totalEgresosUSD, clasificarImporte(d.totalEgresosUSD));
    sumar(r.totalIngresosUSD, clasificarImporte(d.totalIngresosUSD));
    sumar(r.tasa, clasificarImporte(d.tasa));
    if (f.dia) sumar(porDia, f.dia);
    else r.documentosSinDiaInterpretable += 1;
  }

  function finalizar() {
    for (const n of Object.values(porDia)) {
      if (n > 1) {
        r.diasConMasDeUnCierre += 1;
        r.documentosEnDiasRepetidos += n;
      }
    }
    return r;
  }

  return { procesar, finalizar };
}

function acumuladorCajaChica(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.cajaChicaMovimientos),
    fecha: nuevaFecha(),
    divisa: {},
    tipo: {},
    monto: {},
    montoBs: {},
    bs: { movimientos: 0, sinImporteBsUtilizable: 0, sinDatoDeConversion: 0, conMontoDistintoDeCero: 0 },
    documentosConImporteNegativo: 0,
  };

  function procesar(d) {
    r.documentos += 1;
    sumarPresencia(r.presencia, d);
    registrarFecha(r.fecha, d.fecha, ctx);
    const divisa = d.divisa === undefined ? "ausente" : d.divisa === "USD" || d.divisa === "Bs" ? d.divisa : "otro_no_catalogado";
    sumar(r.divisa, divisa);
    sumar(r.tipo, d.tipo === undefined ? "ausente" : d.tipo === "Egreso" ? "Egreso" : "otro_no_catalogado");
    const catM = clasificarImporte(d.monto);
    const catB = clasificarImporte(d.montoBs);
    sumar(r.monto, catM);
    sumar(r.montoBs, catB);
    if (esNegativo(catM) || esNegativo(catB)) r.documentosConImporteNegativo += 1;
    if (divisa === "Bs" || esPositivoUtilizable(d.montoBs)) {
      r.bs.movimientos += 1;
      if (!esPositivoUtilizable(d.montoBs)) r.bs.sinImporteBsUtilizable += 1;
      if (!esPositivoUtilizable(d.tasa) && !esPositivoUtilizable(d.tasaFactura) && !esPositivoUtilizable(d.usdEquiv)) r.bs.sinDatoDeConversion += 1;
      const m = valorNumerico(d.monto);
      if (m !== null && m !== 0) r.bs.conMontoDistintoDeCero += 1;
    }
  }

  return { procesar, finalizar: () => r };
}

function entregadoSegunApp(v) {
  // Igual que isVehiculoDelivered() de src/lib/reportesUtils.js
  const estado = String(v.status || v.estado || "").trim().toLowerCase();
  return estado.includes("entreg") || estado.includes("reparad") || estado.includes("complet");
}

function acumuladorVehiculos(ctx) {
  const r = {
    documentos: 0,
    presencia: presenciaInicial(CAMPOS_POR_COLECCION.vehiculos),
    status: {},
    statusDesconocidosDistintos: 0,
    fechaEntrega: nuevaFecha(),
    arrivalTime: nuevaFecha(),
    precio: {},
    precioBs: {},
    entregadosSegunHeuristicaApp: 0,
    entregadosSinFechaUtilizable: 0,
    enEstadoDefaultFacturar: 0,
    estadoDefaultFacturar: {
      configDisponible: ctx.configEstadosDisponible,
      cantidad: ctx.estadosFacturar.length,
      reconocidoPorHeuristica: ctx.estadosFacturar.map((n) => entregadoSegunApp({ status: n })),
    },
  };
  const desconocidos = new Set();
  const facturar = new Set(ctx.estadosFacturar);

  function procesar(v) {
    r.documentos += 1;
    sumarPresencia(r.presencia, v);
    const cat = categorizar(v.status !== undefined ? v.status : v.estado, ctx.catalogoEstados);
    sumar(r.status, cat.cat);
    if (cat.desconocido !== null) desconocidos.add(cat.desconocido);
    registrarFecha(r.fechaEntrega, v.fechaEntrega, ctx);
    registrarFecha(r.arrivalTime, v.arrivalTime, ctx);
    sumar(r.precio, clasificarImporte(v.precio));
    sumar(r.precioBs, clasificarImporte(v.precioBs));
    if (typeof v.status === "string" && facturar.has(v.status)) r.enEstadoDefaultFacturar += 1;
    if (entregadoSegunApp(v)) {
      r.entregadosSegunHeuristicaApp += 1;
      const tieneFecha = [v.fechaEntrega, v.deliveredAt, v.updatedAt].some((x) => clasificarFecha(x).dia);
      if (!tieneFecha) r.entregadosSinFechaUtilizable += 1;
    }
  }

  function finalizar() {
    r.statusDesconocidosDistintos = desconocidos.size;
    return r;
  }

  return { procesar, finalizar };
}

const ACUMULADORES = {
  ingresosMovimientos: acumuladorIngresos,
  egresos: acumuladorEgresos,
  nominas: acumuladorNominas,
  cierresDiarios: acumuladorCierres,
  cajaChicaMovimientos: acumuladorCajaChica,
  vehiculos: acumuladorVehiculos,
};

/**
 * Crea el acumulador de una colección analizada. El contexto (catálogos de
 * metodosPago y estadosServicio) debe estar completo antes de crearlo.
 */
function crearAcumulador(nombre, ctx) {
  const fabrica = ACUMULADORES[nombre];
  if (!fabrica) throw new Error(`Colección no analizable: ${nombre}`);
  return fabrica(ctx);
}

/** Categoría del modo del factor de conversión; nunca su valor. */
function clasificarModoFactor(datos) {
  if (!esObjetoPlano(datos)) return "documento_no_disponible";
  const modo = datos.modo;
  if (modo === undefined) return "ausente(se_interpreta_manual)";
  return ["manual", "bcv_usd", "bcv_eur"].includes(modo) ? modo : "otro_no_catalogado";
}

/** Estado global: el informe solo es válido si todas las requeridas se analizaron. */
function evaluarEstado(cobertura) {
  const motivos = [];
  for (const nombre of COLECCIONES_REQUERIDAS) {
    const c = cobertura[nombre];
    if (!c || c.estado !== "analizada") motivos.push(`${nombre}:${c ? c.estado : "no_disponible"}${c && c.error ? `:${c.error}` : ""}`);
  }
  for (const nombre of COLECCIONES_AUXILIARES) {
    const c = cobertura[nombre];
    if (c && c.estado === "error") motivos.push(`${nombre}:error${c.error ? `:${c.error}` : ""}`);
  }
  return { estado: motivos.length ? "INCOMPLETO" : "VALIDO", motivos };
}

// ---------------------------------------------------------------------------
// Orquestación (respaldo local)
// ---------------------------------------------------------------------------

function perfilarRespaldo(carpeta, { ahora = new Date() } = {}) {
  const respaldo = cargarRespaldo(carpeta);
  const ctx = construirContexto(respaldo.colecciones, ahora.getUTCFullYear());

  const cobertura = {};
  const resultados = {};
  for (const nombre of [...COLECCIONES_ANALIZADAS, ...COLECCIONES_AUXILIARES]) {
    const col = respaldo.colecciones[nombre];
    cobertura[nombre] = {
      estado: col.estado,
      enResumen: col.enResumen,
      ...(col.error ? { error: col.error } : {}),
      ...(col.codigo ? { codigo: col.codigo } : {}),
      ...(col.estado === "analizada"
        ? {
            entradas: col.entradas,
            documentosInvalidos: col.documentosInvalidos,
            conSubcolecciones: col.conSubcolecciones,
            coincideConResumen: col.coincideConResumen,
          }
        : {}),
    };
    if (ACUMULADORES[nombre] && col.estado === "analizada") {
      const acumulador = crearAcumulador(nombre, ctx);
      for (const datos of col.docs) acumulador.procesar(datos);
      resultados[nombre] = acumulador.finalizar();
    }
  }

  return {
    origen: "respaldo_local",
    ...evaluarEstado(cobertura),
    fechaRespaldo: respaldo.resumenFecha,
    cobertura,
    otrasColecciones: respaldo.otrasColecciones,
    contexto: {
      configMetodosPagoDisponible: ctx.configMetodosDisponible,
      metodosConMonedaConfigurada: ctx.monedaPorMetodo.size,
      configEstadosServicioDisponible: ctx.configEstadosDisponible,
    },
    configuracion: perfilarConfiguracion(carpeta, respaldo.colecciones.configuracion),
    resultados,
  };
}

/** Solo tipo/categoría de dos documentos de configuración conocidos; nunca valores. */
function perfilarConfiguracion(carpeta, col) {
  if (col.estado !== "analizada") return { estado: col.estado };
  const lectura = leerJSON(path.join(carpeta, "configuracion.json"));
  const entradas = Array.isArray(lectura.valor) ? lectura.valor : [];
  const buscar = (id) => entradas.find((e) => esObjetoPlano(e) && e.id === id && esObjetoPlano(e.datos));
  const caja = buscar("configuracionCajaChica");
  const factor = buscar("factorConversion");
  return {
    estado: "analizada",
    fondoCajaChica: caja ? clasificarImporte(caja.datos.fondoCajaChica) : "documento_no_disponible",
    modoFactorConversion: clasificarModoFactor(factor ? factor.datos : undefined),
  };
}

// ---------------------------------------------------------------------------
// Informe de texto
// ---------------------------------------------------------------------------

function pct(n, d) {
  if (!d) return `${n} de ${d} (—)`;
  return `${n} de ${d} (${((n / d) * 100).toFixed(1)}%)`;
}

function lineasMapa(mapa, denominador, sangria = "    ") {
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${sangria}${k}: ${pct(n, denominador)}`);
}

function bloquePresencia(presenciaTabla, denominador) {
  const out = [`  Presencia y tipo de campos (denominador: ${denominador} documentos):`];
  for (const [campo, mapa] of Object.entries(presenciaTabla)) {
    const partes = Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`);
    out.push(`    ${campo}: ${partes.join(", ")}`);
  }
  return out;
}

function bloqueFecha(titulo, f, denominador) {
  return [
    `  ${titulo} (denominador: ${denominador}):`,
    ...lineasMapa(f.categorias, denominador, "    "),
    `    fuera de rango plausible (<${ANIO_MINIMO_PLAUSIBLE} o > año actual + 1): ${pct(f.fueraDeRangoPlausible, denominador)}`,
  ];
}

function lineaCobertura(nombre, c) {
  if (c.origen === "firestore") {
    if (c.estado === "analizada") {
      return `  ${nombre}: ${c.leidos} documentos leídos (count() previo: ${c.contados === null ? "no aplica, lectura por ID" : c.contados}); subcolecciones no consultadas`;
    }
    if (c.estado === "sin_documentos") return `  ${nombre}: SIN DOCUMENTOS O INEXISTENTE (Firestore no distingue ambos casos)`;
    if (c.estado === "error") return `  ${nombre}: ERROR ${c.error}${c.codigo ? ` (${c.codigo})` : ""}; resultados descartados`;
    if (c.estado === "no_leida") return `  ${nombre}: NO LEÍDA (proceso detenido antes)`;
    return `  ${nombre}: ${c.estado}`;
  }
  if (c.estado === "no_disponible") return `  ${nombre}: NO DISPONIBLE (no hay archivo${c.enResumen ? "; sí figura en resumen.json" : ""})`;
  if (c.estado === "error") return `  ${nombre}: ERROR ${c.error}${c.codigo ? ` (${c.codigo})` : ""}; no analizada`;
  return `  ${nombre}: ${c.entradas} entradas, ${c.documentosInvalidos} con estructura inválida, ${c.conSubcolecciones} con subcolecciones; ` +
    `conteo vs resumen.json: ${c.coincideConResumen === null ? "no comparable" : c.coincideConResumen ? "coincide" : "NO coincide"}`;
}

function formatearInforme(p) {
  const L = [];
  const valido = p.estado === "VALIDO";
  L.push("PERFIL AGREGADO DE FIRESTORE");
  L.push(valido ? "ESTADO: VÁLIDO" : "ESTADO: INCOMPLETO — NO USAR COMO INFORME VÁLIDO");
  if (!valido) L.push(`Motivos: ${p.motivos.join("; ")}`);
  if (p.origen === "firestore") {
    L.push(`Origen: lectura directa de Firestore, proyecto verificado: ${p.proyecto}`);
    L.push(`Fecha de lectura (día en hora de Caracas): ${p.fechaLectura}`);
  } else {
    L.push(`Fecha del respaldo (resumen.json, día en hora de Caracas): ${p.fechaRespaldo || "no interpretable"}`);
  }
  L.push("Salida solo agregada: sin IDs, nombres, teléfonos, referencias, observaciones ni importes individuales.");
  L.push("");
  L.push("COBERTURA");
  for (const [nombre, c] of Object.entries(p.cobertura)) L.push(lineaCobertura(nombre, c));
  if (p.origen === "firestore") {
    L.push("  Otras colecciones: no consultadas (lectura limitada a la lista permitida)");
  } else if (p.otrasColecciones.nombres.length || p.otrasColecciones.noMostradas) {
    L.push(`  Otras colecciones no analizadas: ${p.otrasColecciones.nombres.join(", ") || "-"}${p.otrasColecciones.noMostradas ? ` (+${p.otrasColecciones.noMostradas} con nombre no mostrado)` : ""}`);
  }
  L.push(`  Config. de métodos de pago: ${p.contexto.configMetodosPagoDisponible ? `sí (${p.contexto.metodosConMonedaConfigurada} con moneda)` : "no"}; ` +
    `estados de servicio: ${p.contexto.configEstadosServicioDisponible ? "sí" : "no"}`);
  if (p.configuracion.estado === "analizada") {
    L.push(`  configuracion: fondoCajaChica=${p.configuracion.fondoCajaChica}; modo factor=${p.configuracion.modoFactorConversion}`);
  }

  const r = p.resultados;
  if (r.ingresosMovimientos) {
    const i = r.ingresosMovimientos;
    const N = i.documentos;
    L.push("", `INGRESOS (ingresosMovimientos) — ${N} documentos válidos`);
    L.push(...bloquePresencia(i.presencia, N));
    L.push(...bloqueFecha("fecha", i.fecha, N));
    L.push(`  tipo (denominador: ${N}):`, ...lineasMapa(i.tipo, N));
    L.push(`  Variante de formasPago (denominador: ${N}):`, ...lineasMapa(i.varianteFormasPago, N));
    L.push(`  Variantes de esquema antiguo (un documento puede tener varias; denominador: ${N}):`, ...lineasMapa(i.variantesLegado, N));
    L.push(`  Sin formasPago con items: ${pct(i.sinFormasPago.total, N)}`);
    L.push(`    importe USD en raíz (montoUSD ó monto; denominador: ${i.sinFormasPago.total}):`, ...lineasMapa(i.sinFormasPago.importeRaizUSD, i.sinFormasPago.total, "      "));
    L.push(`    montoBs en raíz (denominador: ${i.sinFormasPago.total}):`, ...lineasMapa(i.sinFormasPago.importeRaizBs, i.sinFormasPago.total, "      "));
    const fp = i.formasPago;
    L.push(`  Formas de pago: ${fp.items} items (${fp.itemsNoObjeto} no son objeto)`);
    L.push(`    método normalizado (denominador: ${fp.items} items):`, ...lineasMapa(fp.metodo, fp.items, "      "));
    L.push(`    métodos no catalogados distintos: ${fp.metodosDesconocidosDistintos}`);
    L.push(`    escrituras distintas por método (mayúsculas/acentos): ${Object.entries(fp.variantesEscrituraPorMetodo).map(([k, n]) => `${k} ${n}`).join(", ") || "-"}`);
    L.push(`    moneda según la configuración actual (denominador: ${fp.items}):`, ...lineasMapa(fp.moneda, fp.items, "      "));
    L.push(`    origen de la moneda (denominador: ${fp.items}):`, ...lineasMapa(fp.origenMoneda, fp.items, "      "));
    L.push(`    Items en Bs: ${fp.bs.items}`);
    L.push(`      fuente del importe (denominador: ${fp.bs.items}):`, ...lineasMapa(fp.bs.fuenteImporte, fp.bs.items, "        "));
    L.push(`      tipo de importe (denominador: ${fp.bs.items}):`, ...lineasMapa(fp.bs.importe, fp.bs.items, "        "));
    L.push(`      conversión histórica (denominador: ${fp.bs.items}):`, ...lineasMapa(fp.bs.conversion, fp.bs.items, "        "));
    L.push(`      usdEquiv presente pero no utilizable: ${pct(fp.bs.usdEquivNoUtilizable, fp.bs.items)}`);
    L.push(`    Items en USD: ${fp.usd.items}`);
    L.push(`      fuente del importe (denominador: ${fp.usd.items}):`, ...lineasMapa(fp.usd.fuenteImporte, fp.usd.items, "        "));
    L.push(`      tipo de importe (denominador: ${fp.usd.items}):`, ...lineasMapa(fp.usd.importe, fp.usd.items, "        "));
    L.push(`      con montoBs además: ${pct(fp.usd.conMontoBs, fp.usd.items)}`);
    L.push(`  Documentos con algún pago en Bs sin conversión histórica: ${pct(i.documentosConBsSinConversion, N)}`);
    L.push(`    de ellos, con cuentaPorCobrarId: ${pct(i.documentosConBsSinConversionYCuentaPorCobrar, i.documentosConBsSinConversion)}`);
    L.push(`  Documentos con algún importe negativo (para revisión): ${pct(i.documentosConImporteNegativo, N)}`);
  }

  if (r.egresos) {
    const e = r.egresos;
    const N = e.documentos;
    L.push("", `EGRESOS (egresos) — ${N} documentos válidos`);
    L.push(...bloquePresencia(e.presencia, N));
    L.push(...bloqueFecha("fecha", e.fecha, N));
    const nfs = Object.values(e.fechaStr.categorias).reduce((a, b) => a + b, 0);
    L.push(...bloqueFecha("fechaStr (solo documentos que lo tienen)", e.fechaStr, nfs));
    L.push(`  Día de 'fecha' (hora Caracas) distinto del día de 'fechaStr': ${pct(e.fechaVsFechaStr.diaDistinto, e.fechaVsFechaStr.comparables)} comparables`);
    L.push(`  montoUSD (denominador: ${N}):`, ...lineasMapa(e.importeUSD, N));
    L.push(`  montoBs (denominador: ${N}):`, ...lineasMapa(e.importeBs, N));
    L.push(`  monedaFactura (denominador: ${N}):`, ...lineasMapa(e.monedaFactura, N));
    L.push(`  montoUSD y montoBs ambos positivos: ${pct(e.ambosMontosPositivos, N)}`);
    L.push(`  importe solo en items: ${pct(e.soloImporteEnItems, N)}; sin importe utilizable: ${pct(e.sinImporteUtilizable, N)}`);
    L.push(`  monedaFactura incoherente con los montos: ${pct(e.monedaFacturaIncoherente, N)}`);
    L.push(`  Documentos con algún importe negativo (para revisión): ${pct(e.documentosConImporteNegativo, N)}`);
    L.push(`  Variante (por evidencia en campos; denominador: ${N}):`, ...lineasMapa(e.variantes, N));
    for (const [v, d] of Object.entries(e.porVariante)) {
      L.push(`    ${v}: ${d.documentos} docs; con Bs ${pct(d.conBs, d.documentos)}; con items ${d.conItems}; con fechaStr ${d.conFechaStr}`);
      const tasas = Object.entries(d.tasa).filter(([k]) => k !== "no_aplica_sin_bs").map(([k, n]) => `${k} ${pct(n, d.conBs)}`);
      L.push(`      tasa para los docs en Bs (denominador: ${d.conBs}): ${tasas.join("; ") || "-"}`);
    }
  }

  if (r.nominas) {
    const n = r.nominas;
    const N = n.documentos;
    const s = n.solapamiento;
    L.push("", `NÓMINAS (nominas) — ${N} documentos válidos`);
    L.push(...bloquePresencia(n.presencia, N));
    L.push(...bloqueFecha("fechaInicio", n.fechaInicio, N));
    L.push(...bloqueFecha("fechaFin", n.fechaFin, N));
    L.push(...bloqueFecha("fechaGuardado", n.fechaGuardado, N));
    L.push(`  Estado del rango (denominador: ${N}):`, ...lineasMapa(n.rango, N));
    L.push(`  Duración en días de los rangos válidos (denominador: ${s.rangosValidos}):`, ...lineasMapa(n.duracionDias, s.rangosValidos));
    L.push(`  Rangos que cruzan un cambio de mes: ${pct(n.cruzanCambioDeMes, s.rangosValidos)}`);
    L.push("  Solapamiento — criterio: POR DOCUMENTO, intervalos de días inclusivos [fechaInicio, fechaFin]:");
    L.push(`    pares de documentos solapados: ${s.paresSolapados} (de ellos con rango idéntico: ${s.paresConRangoIdentico})`);
    L.push(`    documentos en al menos un solapamiento: ${pct(s.documentosEnAlgunSolapamiento, s.rangosValidos)} con rango válido`);
    L.push(`    por empleado (campo empleados[].id guardado en la nómina): ${s.paresComparablesPorEmpleado} pares comparables, ` +
      `${s.paresSinIdsCompletos} pares sin ids completos (no comparables); ${s.coincidenciasEmpleadoEnParesSolapados} coincidencias de id`);
    const em = n.empleados;
    L.push(`  empleados: ${em.items} items; ${em.documentosSinArreglo} docs sin arreglo; ${em.documentosArregloVacio} docs con arreglo vacío; ` +
      `items con id ${pct(em.itemsConId, em.items)}; docs con id repetido ${em.documentosConIdRepetido}`);
    L.push(`  empleados[].monto (denominador: ${em.items} items):`, ...lineasMapa(em.monto, em.items));
    L.push(`  Documentos con suma de empleados[].monto cero o no interpretable: ${pct(n.documentosConTotalCeroOInvalido, N)}`);
    L.push(`  Documentos con algún importe negativo (para revisión): ${pct(n.documentosConImporteNegativo, N)}`);
  }

  if (r.cierresDiarios) {
    const c = r.cierresDiarios;
    const N = c.documentos;
    L.push("", `CIERRES (cierresDiarios) — ${N} documentos válidos`);
    L.push(...bloquePresencia(c.presencia, N));
    L.push(...bloqueFecha("fecha", c.fecha, N));
    L.push(...bloqueFecha("fechaTimestamp", c.fechaTimestamp, N));
    L.push(`  Origen según observaciones (denominador: ${N}):`, ...lineasMapa(c.origen, N));
    L.push(`  totalEgresosUSD (denominador: ${N}):`, ...lineasMapa(c.totalEgresosUSD, N));
    L.push(`  totalIngresosUSD (denominador: ${N}):`, ...lineasMapa(c.totalIngresosUSD, N));
    L.push(`  tasa (denominador: ${N}):`, ...lineasMapa(c.tasa, N));
    L.push(`  Días con más de un cierre: ${c.diasConMasDeUnCierre} (documentos implicados: ${c.documentosEnDiasRepetidos}); sin día interpretable: ${c.documentosSinDiaInterpretable}`);
  }

  if (r.cajaChicaMovimientos) {
    const c = r.cajaChicaMovimientos;
    const N = c.documentos;
    L.push("", `CAJA CHICA (cajaChicaMovimientos) — ${N} documentos válidos (solo movimientos pendientes: la reposición los borra)`);
    L.push(...bloquePresencia(c.presencia, N));
    L.push(...bloqueFecha("fecha", c.fecha, N));
    L.push(`  divisa (denominador: ${N}):`, ...lineasMapa(c.divisa, N));
    L.push(`  tipo (denominador: ${N}):`, ...lineasMapa(c.tipo, N));
    L.push(`  monto (denominador: ${N}):`, ...lineasMapa(c.monto, N));
    L.push(`  montoBs (denominador: ${N}):`, ...lineasMapa(c.montoBs, N));
    L.push(`  Movimientos en Bs: ${c.bs.movimientos}; sin montoBs utilizable ${pct(c.bs.sinImporteBsUtilizable, c.bs.movimientos)}; ` +
      `sin dato de conversión ${pct(c.bs.sinDatoDeConversion, c.bs.movimientos)}; con monto ≠ 0 ${pct(c.bs.conMontoDistintoDeCero, c.bs.movimientos)}`);
    L.push(`  Documentos con algún importe negativo (para revisión): ${pct(c.documentosConImporteNegativo, N)}`);
  }

  if (r.vehiculos) {
    const v = r.vehiculos;
    const N = v.documentos;
    L.push("", `VEHÍCULOS (vehiculos) — ${N} documentos válidos`);
    L.push(...bloquePresencia(v.presencia, N));
    L.push(`  status normalizado (denominador: ${N}):`, ...lineasMapa(v.status, N));
    L.push(`  status no catalogados distintos: ${v.statusDesconocidosDistintos}`);
    L.push(...bloqueFecha("fechaEntrega", v.fechaEntrega, N));
    L.push(...bloqueFecha("arrivalTime", v.arrivalTime, N));
    L.push(`  precio (denominador: ${N}):`, ...lineasMapa(v.precio, N));
    L.push(`  precioBs (denominador: ${N}):`, ...lineasMapa(v.precioBs, N));
    L.push(`  Entregados según la heurística de Reportes (entreg/reparad/complet): ${pct(v.entregadosSegunHeuristicaApp, N)}`);
    L.push(`    de ellos sin fecha de entrega utilizable: ${pct(v.entregadosSinFechaUtilizable, v.entregadosSegunHeuristicaApp)}`);
    const ef = v.estadoDefaultFacturar;
    L.push(`  Estado final de facturación configurado: ${ef.configDisponible ? `${ef.cantidad} estado(s); reconocido(s) por la heurística: ${ef.reconocidoPorHeuristica.map((b) => (b ? "sí" : "no")).join(", ") || "-"}` : "config no disponible"}`);
    L.push(`  Vehículos en ese estado: ${pct(v.enEstadoDefaultFacturar, N)}`);
  }

  if (p.lecturas) {
    const l = p.lecturas;
    L.push("", "LECTURAS (estimación local; la facturación real de Firestore puede diferir)");
    L.push(`  estimadas en preflight: ${l.estimadas}; margen de seguridad: ${l.margen}; total con margen: ${l.estimadas + l.margen}; límite autorizado: ${l.limite}`);
    L.push(`  contadas localmente durante la lectura: ${l.contadas}`);
  }

  L.push("", "LIMITACIONES");
  L.push("  - Anomalía ≠ error financiero demostrado. Una tasa ausente no se reconstruye; un importe negativo se clasifica para revisión.");
  L.push("  - La moneda de cada forma de pago se deduce con la configuración ACTUAL de metodosPago, igual que la app; no hay moneda histórica.");
  L.push("  - El texto con coma decimal se marca como ambiguo y no se convierte.");
  L.push("  - Fechas dd/mm/aaaa se interpretan como día/mes (convención es-VE de la app); los días en hora de Caracas usan UTC-4 fijo (antes de 2016 era UTC-4:30).");
  L.push("  - Las variantes de egresos se infieren por campos presentes (p. ej. 'divisa' sin 'tipo'); son indicios, no prueba de origen.");
  L.push("  - El solapamiento de nóminas es por documento; por empleado solo cuando todos los items tienen empleados[].id. No se atribuyen duplicados.");
  L.push("  - Caja chica solo contiene movimientos no repuestos; los repuestos ya son egresos.");
  L.push(valido ? "FIN DEL INFORME (VÁLIDO)" : "FIN DEL INFORME (INCOMPLETO — NO USAR COMO INFORME VÁLIDO)");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const args = argv.slice(2);
  const comoJSON = args.includes("--json");
  const [ruta] = args.filter((a) => !a.startsWith("--"));
  if (!ruta) {
    process.stderr.write("Uso: node scripts/perfilador-respaldo/perfilador.js <ruta-absoluta-carpeta-respaldo> [--json]\n");
    return 2;
  }
  try {
    const perfil = perfilarRespaldo(ruta);
    process.stdout.write((comoJSON ? JSON.stringify(perfil, null, 2) : formatearInforme(perfil)) + "\n");
    return perfil.estado === "VALIDO" ? 0 : 3;
  } catch (e) {
    const mensaje = e instanceof ErrorRespaldo ? e.message : "Error inesperado al analizar el respaldo.";
    process.stderr.write(`${mensaje}\n`);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  COLECCIONES_ANALIZADAS,
  COLECCIONES_AUXILIARES,
  COLECCIONES_REQUERIDAS,
  CAMPOS_POR_COLECCION,
  perfilarRespaldo,
  formatearInforme,
  crearAcumulador,
  contextoVacio,
  agregarMetodoPago,
  agregarEstadoServicio,
  clasificarModoFactor,
  evaluarEstado,
  clasificarImporte,
  clasificarFecha,
  tipoCampo,
  main,
};
