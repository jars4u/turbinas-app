// Reglas financieras compartidas (Reportes, Resumen contable y gráficos mensuales).
//
// Funciones puras: no leen ni escriben Firestore y nunca modifican los registros
// que reciben. Cada resultado conserva el importe original y declara de dónde sale
// su equivalente en USD:
//   - "directo_usd": el pago ya estaba en divisa.
//   - "historica": conversión registrada en la propia operación (usdEquiv,
//     factorConversion, tasaFactura o tasa).
//   - "estimacion_reconstruida": pago de INGRESO en Bs sin conversión registrada,
//     convertido con el factor manual actual (decisión de negocio). Es una estimación.
//     No se aplica a egresos: sin tasa registrada quedan pendientes de conversión.
//   - "sin_conversion": no hay forma de convertirlo; no suma en USD.
// Los datos defectuosos (NaN, texto no numérico, fechas inválidas o ausentes) se
// devuelven como incidencias y nunca se convierten en cifras válidas.
import { esMetodoBs, normalizarMetodo } from "./metodosPago.js";

export const ORIGEN = {
  DIRECTO_USD: "directo_usd",
  HISTORICA: "historica",
  ESTIMACION: "estimacion_reconstruida",
  SIN_CONVERSION: "sin_conversion",
};

export const INCIDENCIA = {
  IMPORTE_INVALIDO: "importe_invalido",
  IMPORTE_AUSENTE: "importe_ausente",
  CONVERSION_HISTORICA_INVALIDA: "conversion_historica_invalida",
  SIN_FACTOR_PARA_ESTIMAR: "sin_factor_para_estimar",
  FORMAS_PAGO_INVALIDAS: "formas_pago_invalidas",
  MONTO_BS_RAIZ_NO_ES_PAGO: "montoBs_raiz_no_es_pago",
  EGRESO_DOBLE_MONEDA_AMBIGUO: "egreso_doble_moneda_ambiguo",
  EGRESO_BS_PENDIENTE_CONVERSION: "egreso_bs_pendiente_conversion",
  FECHA_AUSENTE: "fecha_ausente",
  FECHA_INVALIDA: "fecha_invalida",
  NOMINA_SIN_PERIODO: "nomina_sin_periodo",
  NOMINA_PENDIENTE_CRITERIO: "nomina_pendiente_criterio",
  ENTREGADO_SIN_FECHA: "entregado_sin_fecha",
};

export const CATEGORIA_EGRESO = {
  FACTURA: "factura",
  GASTO_DIA: "gasto_dia",
  CAJA_CHICA: "caja_chica",
  NOMINA: "nomina",
  OTRO: "otro",
};

// ---------------------------------------------------------------------------
// Importes
// ---------------------------------------------------------------------------

const RE_NUMERO_TEXTO = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Lee un importe sin adivinar: número finito o texto numérico con punto decimal.
 * Distingue ausente (undefined, null, "") de inválido (NaN, Infinity, "10,5", "abc").
 */
export function leerImporte(valor) {
  if (valor === undefined || valor === null) return { estado: "ausente", valor: null };
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? { estado: "valido", valor } : { estado: "invalido", valor: null };
  }
  if (typeof valor === "string") {
    const t = valor.trim();
    if (t === "") return { estado: "ausente", valor: null };
    return RE_NUMERO_TEXTO.test(t) ? { estado: "valido", valor: Number(t) } : { estado: "invalido", valor: null };
  }
  return { estado: "invalido", valor: null };
}

function positivo(valor) {
  const l = leerImporte(valor);
  return l.estado === "valido" && l.valor > 0 ? l.valor : null;
}

/**
 * Factor con el que se reconstruyen las conversiones faltantes: el factor MANUAL
 * configurado. normalizarConfig() usa 1 cuando no hay configuración, así que 1 o
 * menos se considera "sin factor" en lugar de convertir Bs a USD 1:1.
 */
export function factorParaEstimacion(detalleFactor) {
  const manual = Number(detalleFactor && detalleFactor.valorManual);
  return Number.isFinite(manual) && manual > 1 ? manual : null;
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const EPOCH_MS_MIN = Date.UTC(2000, 0, 1);
const EPOCH_MS_MAX = Date.UTC(2100, 0, 1);

function fechaLocalMediodia(y, m, d) {
  const fecha = new Date(y, m - 1, d, 12, 0, 0, 0);
  const valida = fecha.getFullYear() === y && fecha.getMonth() === m - 1 && fecha.getDate() === d;
  return valida ? fecha : null;
}

function resultadoFecha(fecha, formato) {
  return fecha && !Number.isNaN(fecha.getTime())
    ? { estado: "valida", fecha, formato }
    : { estado: "invalida", fecha: null, formato };
}

/**
 * Normaliza las representaciones de fecha que existen en Firestore:
 * Timestamp (o {seconds}), Date, milisegundos, "DD/MM/YYYY", "D-M-YYYY",
 * "YYYY-MM-DD" e ISO con hora. Las fechas de solo día quedan a mediodía local,
 * igual que el resto de la app. Una fecha imposible (31/02) es inválida.
 */
export function leerFecha(valor) {
  if (valor === undefined || valor === null || valor === "") return { estado: "ausente", fecha: null, formato: null };
  if (valor instanceof Date) return resultadoFecha(new Date(valor.getTime()), "date");
  if (typeof valor === "object") {
    if (typeof valor.toDate === "function") {
      try {
        return resultadoFecha(valor.toDate(), "timestamp");
      } catch (_) {
        return { estado: "invalida", fecha: null, formato: "timestamp" };
      }
    }
    if (typeof valor.seconds === "number") return resultadoFecha(new Date(valor.seconds * 1000), "timestamp");
    return { estado: "invalida", fecha: null, formato: "objeto" };
  }
  if (typeof valor === "number") {
    return valor >= EPOCH_MS_MIN && valor <= EPOCH_MS_MAX
      ? resultadoFecha(new Date(valor), "epoch_ms")
      : { estado: "invalida", fecha: null, formato: "numero" };
  }
  if (typeof valor !== "string") return { estado: "invalida", fecha: null, formato: typeof valor };

  const t = valor.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return resultadoFecha(fechaLocalMediodia(Number(m[1]), Number(m[2]), Number(m[3])), "aaaa-mm-dd");
  m = t.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/);
  if (m) return resultadoFecha(fechaLocalMediodia(Number(m[4]), Number(m[3]), Number(m[1])), "dd/mm/aaaa");
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return resultadoFecha(new Date(t), "iso");
  return { estado: "invalida", fecha: null, formato: "texto" };
}

/** Primera fecha válida entre varios campos; si ninguna lo es, la incidencia correspondiente. */
export function primeraFechaValida(...valores) {
  let hayInvalida = false;
  for (const valor of valores) {
    const f = leerFecha(valor);
    if (f.estado === "valida") return { fecha: f.fecha, incidencia: null };
    if (f.estado === "invalida") hayInvalida = true;
  }
  return { fecha: null, incidencia: hayInvalida ? INCIDENCIA.FECHA_INVALIDA : INCIDENCIA.FECHA_AUSENTE };
}

export function formatearFechaDMY(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return "";
  return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
}

function inicioDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
}

function finDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

// ---------------------------------------------------------------------------
// Ingresos
// ---------------------------------------------------------------------------

/**
 * Equivalente en USD de una forma de pago de un ingreso.
 * - Divisa: monto → montoUSD → usdEquiv (primer campo presente).
 * - Bs: montoBs (o monto si montoBs no existe). Conversión: usdEquiv registrado,
 *   luego factorConversion registrado y, solo si faltan ambos, estimación con el
 *   factor manual actual.
 */
export function convertirPagoIngreso(fp, { factorActual = null, metodos } = {}) {
  const incidencias = [];
  const metodo = normalizarMetodo(fp && fp.formaPago);
  const moneda = esMetodoBs(fp && fp.formaPago, metodos) ? "BS" : "USD";
  const base = { metodo, moneda, importeOriginal: null, usd: null, origen: ORIGEN.SIN_CONVERSION, factorAplicado: null, incidencias };

  if (moneda === "USD") {
    const campo = ["monto", "montoUSD", "usdEquiv"].find((c) => leerImporte(fp && fp[c]).estado !== "ausente");
    if (!campo) {
      incidencias.push(INCIDENCIA.IMPORTE_AUSENTE);
      return base;
    }
    const importe = leerImporte(fp[campo]);
    if (importe.estado !== "valido") {
      incidencias.push(INCIDENCIA.IMPORTE_INVALIDO);
      return base;
    }
    return { ...base, importeOriginal: importe.valor, usd: importe.valor, origen: ORIGEN.DIRECTO_USD };
  }

  // Si montoBs existe pero es inválido no se sustituye por otro campo
  const campoBs = leerImporte(fp && fp.montoBs).estado !== "ausente" ? "montoBs" : "monto";
  const importe = leerImporte(fp && fp[campoBs]);
  if (importe.estado === "ausente") {
    incidencias.push(INCIDENCIA.IMPORTE_AUSENTE);
    return base;
  }
  if (importe.estado === "invalido") {
    incidencias.push(INCIDENCIA.IMPORTE_INVALIDO);
    return base;
  }
  const bs = importe.valor;
  const conImporte = { ...base, importeOriginal: bs };

  const usdEquiv = leerImporte(fp.usdEquiv);
  const factorRegistrado = leerImporte(fp.factorConversion);
  if (usdEquiv.estado === "invalido" || factorRegistrado.estado === "invalido") {
    incidencias.push(INCIDENCIA.CONVERSION_HISTORICA_INVALIDA);
  }
  if (usdEquiv.estado === "valido" && usdEquiv.valor > 0) {
    return { ...conImporte, usd: usdEquiv.valor, origen: ORIGEN.HISTORICA, factorAplicado: positivo(fp.factorConversion) };
  }
  if (factorRegistrado.estado === "valido" && factorRegistrado.valor > 0) {
    return { ...conImporte, usd: bs / factorRegistrado.valor, origen: ORIGEN.HISTORICA, factorAplicado: factorRegistrado.valor };
  }
  if (positivo(factorActual)) {
    return { ...conImporte, usd: bs / factorActual, origen: ORIGEN.ESTIMACION, factorAplicado: factorActual };
  }
  incidencias.push(INCIDENCIA.SIN_FACTOR_PARA_ESTIMAR);
  return conImporte;
}

/**
 * Formas de pago de un ingreso, incluido el esquema antiguo de forma de pago
 * suelta en la raíz. El montoBs de la raíz NO es un pago: lo escribe el editor
 * de servicios como precio en Bs (ServicioEditor.js), así que nunca se suma.
 */
function formasPagoDeIngreso(ingreso, incidencias) {
  const fp = ingreso && ingreso.formasPago;
  if (Array.isArray(fp) && fp.length > 0) return fp;
  if (fp !== undefined && !Array.isArray(fp)) incidencias.push(INCIDENCIA.FORMAS_PAGO_INVALIDAS);
  if (leerImporte(ingreso && ingreso.montoBs).estado !== "ausente") incidencias.push(INCIDENCIA.MONTO_BS_RAIZ_NO_ES_PAGO);
  if (ingreso && ingreso.formaPago) return [{ formaPago: ingreso.formaPago, monto: ingreso.monto, montoBs: undefined, usdEquiv: ingreso.usdEquiv, factorConversion: ingreso.factorConversion }];
  const usdRaiz = leerImporte(ingreso && ingreso.montoUSD).estado !== "ausente" ? ingreso.montoUSD : ingreso && ingreso.monto;
  if (leerImporte(usdRaiz).estado !== "ausente") return [{ formaPago: undefined, monto: usdRaiz }];
  return [];
}

/** Totales de un ingreso: USD (directo, histórico, estimado), Bs originales e incidencias. */
export function totalizarIngreso(ingreso, opciones = {}) {
  const incidencias = [];
  const pagos = formasPagoDeIngreso(ingreso, incidencias).map((fp) => convertirPagoIngreso(fp, opciones));
  const t = { usd: 0, usdDirecto: 0, usdHistorico: 0, usdEstimado: 0, bs: 0, bsSinConversion: 0, pagos, incidencias };
  for (const p of pagos) {
    incidencias.push(...p.incidencias);
    if (p.moneda === "BS" && p.importeOriginal !== null) t.bs += p.importeOriginal;
    if (p.usd === null) {
      if (p.moneda === "BS" && p.importeOriginal !== null) t.bsSinConversion += p.importeOriginal;
      continue;
    }
    t.usd += p.usd;
    if (p.origen === ORIGEN.DIRECTO_USD) t.usdDirecto += p.usd;
    else if (p.origen === ORIGEN.HISTORICA) t.usdHistorico += p.usd;
    else if (p.origen === ORIGEN.ESTIMACION) t.usdEstimado += p.usd;
  }
  return t;
}

/** Fecha de imputación de un ingreso (fecha del movimiento). */
export function fechaIngreso(ingreso) {
  return primeraFechaValida(ingreso && ingreso.fechaRaw, ingreso && ingreso.fecha);
}

// ---------------------------------------------------------------------------
// Egresos
// ---------------------------------------------------------------------------

/**
 * Categoría de un egreso según la evidencia de los campos que escribe cada flujo:
 * factura (tipo "factura"), gasto del día (tipo "gastoDia"), reposición de caja
 * chica (sin tipo y con "divisa", como escribe CajaChica.js) u otro.
 */
export function clasificarEgreso(egreso) {
  const tipo = egreso && egreso.tipo;
  if (tipo === "factura") return CATEGORIA_EGRESO.FACTURA;
  if (tipo === "gastoDia") return CATEGORIA_EGRESO.GASTO_DIA;
  if ((tipo === undefined || tipo === null || tipo === "") && egreso && egreso.divisa !== undefined) return CATEGORIA_EGRESO.CAJA_CHICA;
  return CATEGORIA_EGRESO.OTRO;
}

function totalItems(items) {
  let total = 0;
  let valido = false;
  let invalido = false;
  for (const it of Array.isArray(items) ? items : []) {
    const totalItem = leerImporte(it && it.totalItem);
    if (totalItem.estado === "valido" && totalItem.valor !== 0) {
      total += totalItem.valor;
      valido = true;
      continue;
    }
    const cantidad = leerImporte(it && it.cantidad);
    const precio = leerImporte(it && it.precioUnitario);
    if (cantidad.estado === "valido" && precio.estado === "valido") {
      total += cantidad.valor * precio.valor;
      valido = true;
    } else if (cantidad.estado === "invalido" || precio.estado === "invalido" || totalItem.estado === "invalido") {
      invalido = true;
    }
  }
  return { total, valido, invalido };
}

/**
 * Conversión de Bs de un egreso SOLO con la tasa registrada en la operación.
 * La estimación con el factor manual actual está aprobada para pagos de ingresos,
 * no para egresos: sin tasa válida el egreso queda pendiente de conversión.
 */
function convertirBsEgreso(bs, egreso) {
  const tasaFactura = positivo(egreso.tasaFactura);
  if (tasaFactura) return { usd: bs / tasaFactura, origen: ORIGEN.HISTORICA, factorAplicado: tasaFactura, pendienteConversion: false };
  // 'tasa' es la tasa registrada en la propia operación (reposición de caja chica)
  const tasa = positivo(egreso.tasa);
  if (tasa) return { usd: bs / tasa, origen: ORIGEN.HISTORICA, factorAplicado: tasa, pendienteConversion: false };
  return { usd: null, origen: ORIGEN.SIN_CONVERSION, factorAplicado: null, pendienteConversion: true };
}

/**
 * Equivalente en USD de un egreso. Si tiene importe en USD y en Bs a la vez no
 * se sabe si es el mismo gasto en dos monedas o dos importes distintos: se marca
 * como ambiguo y queda fuera de los totales (ver candidatos). Un egreso en Bs sin
 * tasa registrada queda pendiente de conversión (no se estima).
 */
export function convertirEgreso(egreso) {
  const incidencias = [];
  const categoria = clasificarEgreso(egreso);
  const usdLeido = leerImporte(egreso && egreso.montoUSD);
  const bsLeido = leerImporte(egreso && egreso.montoBs);
  const r = {
    categoria,
    importeUSDOriginal: usdLeido.valor,
    importeBsOriginal: bsLeido.valor,
    usd: null,
    bs: 0,
    origen: ORIGEN.SIN_CONVERSION,
    factorAplicado: null,
    pendienteConversion: false,
    ambiguo: false,
    candidatos: null,
    incidencias,
  };
  if (usdLeido.estado === "invalido" || bsLeido.estado === "invalido") {
    incidencias.push(INCIDENCIA.IMPORTE_INVALIDO);
    return r;
  }
  const usd = usdLeido.valor || 0;
  const bs = bsLeido.valor || 0;

  if (usd !== 0 && bs !== 0) {
    const conv = convertirBsEgreso(bs, egreso);
    incidencias.push(INCIDENCIA.EGRESO_DOBLE_MONEDA_AMBIGUO);
    return {
      ...r,
      ambiguo: true,
      candidatos: { mismoGastoUSD: usd, gastosDistintosUSD: conv.usd === null ? null : usd + conv.usd },
    };
  }
  if (usd !== 0) return { ...r, usd, origen: ORIGEN.DIRECTO_USD };
  if (bs !== 0) {
    const conv = convertirBsEgreso(bs, egreso);
    if (conv.pendienteConversion) incidencias.push(INCIDENCIA.EGRESO_BS_PENDIENTE_CONVERSION);
    return { ...r, bs, ...conv };
  }

  // Sin montoUSD/montoBs: total de los items en la moneda de la factura
  const items = totalItems(egreso && egreso.items);
  if (items.invalido) {
    incidencias.push(INCIDENCIA.IMPORTE_INVALIDO);
    return r;
  }
  if (!items.valido) {
    if (usdLeido.estado === "ausente" && bsLeido.estado === "ausente") {
      incidencias.push(INCIDENCIA.IMPORTE_AUSENTE);
      return r;
    }
    return { ...r, usd: 0, origen: ORIGEN.DIRECTO_USD };
  }
  if (String((egreso && egreso.monedaFactura) || "USD").trim().toUpperCase() === "BS") {
    const conv = convertirBsEgreso(items.total, egreso);
    if (conv.pendienteConversion) incidencias.push(INCIDENCIA.EGRESO_BS_PENDIENTE_CONVERSION);
    return { ...r, bs: items.total, ...conv };
  }
  return { ...r, usd: items.total, origen: ORIGEN.DIRECTO_USD };
}

/** Fecha de imputación de un egreso: el Timestamp guardado y, si falta, fechaStr. */
export function fechaEgreso(egreso) {
  return primeraFechaValida(egreso && egreso.fecha, egreso && egreso.fechaStr);
}

/**
 * Elimina duplicados por id (p. ej. la misma colección leída por dos vías).
 * Los registros sin id se conservan: no hay regla fiable para identificarlos.
 */
export function deduplicarPorId(registros) {
  const vistos = new Set();
  return (Array.isArray(registros) ? registros : []).filter((r) => {
    const id = r && r.id;
    if (id === undefined || id === null || id === "") return true;
    if (vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Nóminas
// ---------------------------------------------------------------------------

/**
 * DECISIÓN PENDIENTE DEL NEGOCIO: cómo imputar una nómina cuyo período cruza un
 * cambio de mes o el límite del rango consultado (prorrateo por días, fecha de
 * fin, fecha de pago...). Hasta que se decida, esas nóminas NO se suman a
 * ningún período: se informan aparte como "pendiente de criterio". Cambiar esta
 * regla es la única modificación necesaria cuando haya decisión.
 */
export const CRITERIO_NOMINA_ENTRE_PERIODOS = "pendiente";

/** Total de una nómina (suma de empleados[].monto); los importes inválidos son incidencias. */
export function totalNomina(nomina) {
  const incidencias = [];
  const empleados = Array.isArray(nomina && nomina.empleados) ? nomina.empleados : null;
  if (empleados && empleados.length > 0) {
    let usd = 0;
    for (const e of empleados) {
      const monto = leerImporte(e && e.monto);
      if (monto.estado === "valido") usd += monto.valor;
      else incidencias.push(monto.estado === "invalido" ? INCIDENCIA.IMPORTE_INVALIDO : INCIDENCIA.IMPORTE_AUSENTE);
    }
    return { usd, incidencias };
  }
  for (const campo of ["total", "totalNomina", "montoTotal"]) {
    const l = leerImporte(nomina && nomina[campo]);
    if (l.estado === "valido") return { usd: l.valor, incidencias };
    if (l.estado === "invalido") return { usd: null, incidencias: [INCIDENCIA.IMPORTE_INVALIDO] };
  }
  return { usd: null, incidencias: [INCIDENCIA.IMPORTE_AUSENTE] };
}

/**
 * Atribución de una nómina a un rango [inicio, fin]:
 * - "dentro": todo su período está en el rango y en un solo mes → se suma.
 * - "fuera": no toca el rango.
 * - "pendiente_criterio": cruza un cambio de mes o el límite del rango → no se suma.
 * - "sin_periodo": falta fechaInicio o fechaFin válidas → no se atribuye.
 * No se usa fechaGuardado como sustituto del período: no es evidencia de él.
 */
export function atribuirNomina(nomina, { inicio, fin }) {
  const total = totalNomina(nomina);
  const ini = leerFecha(nomina && nomina.fechaInicio);
  const fn = leerFecha(nomina && nomina.fechaFin);
  if (ini.estado !== "valida" || fn.estado !== "valida" || fn.fecha < ini.fecha) {
    return { estado: "sin_periodo", usd: total.usd, periodo: null, incidencias: [...total.incidencias, INCIDENCIA.NOMINA_SIN_PERIODO] };
  }
  const periodo = { inicio: inicioDia(ini.fecha), fin: finDia(fn.fecha) };
  if (periodo.fin < inicio || periodo.inicio > fin) return { estado: "fuera", usd: total.usd, periodo, incidencias: total.incidencias };
  const cruzaMes = periodo.inicio.getFullYear() !== periodo.fin.getFullYear() || periodo.inicio.getMonth() !== periodo.fin.getMonth();
  const dentroDelRango = periodo.inicio >= inicio && periodo.fin <= fin;
  if (cruzaMes || !dentroDelRango) {
    return {
      estado: "pendiente_criterio",
      motivo: cruzaMes ? "cruza_cambio_de_mes" : "cruza_limite_del_rango",
      usd: total.usd,
      periodo,
      incidencias: [...total.incidencias, INCIDENCIA.NOMINA_PENDIENTE_CRITERIO],
    };
  }
  return { estado: "dentro", usd: total.usd, periodo, incidencias: total.incidencias };
}

// ---------------------------------------------------------------------------
// Servicios entregados
// ---------------------------------------------------------------------------

/** Compara estados sin mayúsculas, acentos, espacios ni guiones ("Por cobrar" = "por_cobrar"). */
export function normalizarEstado(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
}

// Estados históricos equivalentes a "entregado" (regla que ya usaba Reportes)
const RE_ESTADO_ENTREGA_HISTORICO = /entreg|reparad|complet/;

/**
 * Criterio único de "servicio entregado":
 * - Estados terminales de la configuración oficial (estadosServicio): el estado
 *   de facturación (defaultFacturar) y los que dejan de mostrarse (dejarDeMostrar);
 *   ambos flujos registran fechaEntrega al aplicarse.
 * - Equivalentes históricos: entregado / reparado / completado.
 */
export function crearCriterioEntrega(estadosServicio = []) {
  const terminales = new Set();
  for (const e of Array.isArray(estadosServicio) ? estadosServicio : []) {
    if (e && (e.defaultFacturar || e.dejarDeMostrar) && e.nombre) terminales.add(normalizarEstado(e.nombre));
  }
  const esTerminal = (estado) => {
    const n = normalizarEstado(estado);
    return n !== "" && (terminales.has(n) || RE_ESTADO_ENTREGA_HISTORICO.test(n));
  };
  return {
    terminalesConfigurados: [...terminales],
    esTerminal,
    esEntregado: (vehiculo) => esTerminal((vehiculo && (vehiculo.status || vehiculo.estado)) || ""),
  };
}

/** Fecha de entrega verificable; nunca se inventa (arrivalTime no es fecha de entrega). */
export function fechaEntrega(vehiculo) {
  const r = primeraFechaValida(vehiculo && vehiculo.fechaEntrega, vehiculo && vehiculo.deliveredAt, vehiculo && vehiculo.updatedAt);
  return r.fecha ? r : { fecha: null, incidencia: INCIDENCIA.ENTREGADO_SIN_FECHA };
}

// ---------------------------------------------------------------------------
// Completitud de los totales
// ---------------------------------------------------------------------------

const sumar = (lista, fn) => lista.reduce((acc, x) => acc + (fn(x) || 0), 0);

/**
 * Qué quedó fuera de un total y por qué. Si algo queda fuera, el total es
 * PARCIAL y no está reconciliado.
 * - ambiguos: egresos con USD y Bs a la vez. Solo se informa lo que no depende de
 *   la interpretación: el USD registrado (mínimo) y los Bs originales sin
 *   clasificar. Nunca se suman entre sí: podrían ser el mismo gasto.
 * - pendientesCriterio: nóminas que esperan la decisión de imputación.
 * - pendientesConversion: registros en Bs que no se pudieron convertir.
 * - sinPeriodo: registros sin fecha verificable, no imputables a ningún período.
 * Las estimaciones con el factor manual sí suman, pero se señalan aparte.
 */
export function resumirCompletitud({
  egresosAmbiguos = [],
  nominasPendientes = [],
  ingresosPendientesConversion = { cantidad: 0, bs: 0 },
  egresosPendientesConversion = { cantidad: 0, bs: 0 },
  sinPeriodo = {},
  usdEstimado = 0,
} = {}) {
  const sp = {
    ingresos: sinPeriodo.ingresos || 0,
    egresos: sinPeriodo.egresos || 0,
    nominas: sinPeriodo.nominas || 0,
    servicios: sinPeriodo.servicios || 0,
  };
  sp.total = sp.ingresos + sp.egresos + sp.nominas + sp.servicios;
  const ambiguos = {
    cantidad: egresosAmbiguos.length,
    minimoUSD: sumar(egresosAmbiguos, (e) => e.importeUSDOriginal),
    bsSinClasificar: sumar(egresosAmbiguos, (e) => e.importeBsOriginal),
  };
  const pendientesCriterio = { cantidad: nominasPendientes.length, usd: sumar(nominasPendientes, (n) => n.usd) };
  const pendientesConversion = {
    ingresos: ingresosPendientesConversion.cantidad || 0,
    egresos: egresosPendientesConversion.cantidad || 0,
    bs: (ingresosPendientesConversion.bs || 0) + (egresosPendientesConversion.bs || 0),
  };
  pendientesConversion.cantidad = pendientesConversion.ingresos + pendientesConversion.egresos;
  const areas = {
    ingresos: pendientesConversion.ingresos === 0 && sp.ingresos === 0,
    egresos: ambiguos.cantidad === 0 && pendientesConversion.egresos === 0 && sp.egresos === 0,
    nomina: pendientesCriterio.cantidad === 0 && sp.nominas === 0,
    servicios: sp.servicios === 0,
  };
  return {
    completo: Object.values(areas).every(Boolean),
    areas,
    ambiguos,
    pendientesCriterio,
    pendientesConversion,
    sinPeriodo: sp,
    usdEstimado,
    incluyeEstimaciones: usdEstimado !== 0,
  };
}
