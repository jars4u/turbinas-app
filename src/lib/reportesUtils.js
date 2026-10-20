import {
  CATEGORIA_EGRESO,
  ORIGEN,
  atribuirNomina,
  convertirEgreso,
  crearCriterioEntrega,
  deduplicarPorId,
  fechaEgreso,
  fechaEntrega,
  fechaIngreso,
  leerFecha,
  resumirCompletitud,
  totalizarIngreso,
} from "./finanzas.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORT_PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "last7", label: "7 días" },
  { key: "last30", label: "30 días" },
  { key: "month", label: "Mes actual" },
  { key: "last3months", label: "3 meses" },
  { key: "last6months", label: "6 meses" },
  { key: "last12months", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function toStartOfDay(date) {
  if (!isValidDate(date)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function toEndOfDay(date) {
  if (!isValidDate(date)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function formatLocalYMD(date) {
  if (!isValidDate(date)) return "";
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date) {
  if (!isValidDate(date)) return "-";
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function parseLocalYMDNoon(value) {
  if (!value || typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

// Delegado en la regla única de fechas: una fecha imposible o desconocida es null
export function parseMixedDate(value) {
  return leerFecha(value).fecha;
}

export function getDateRangeFromPreset(presetKey, now = new Date()) {
  const current = toStartOfDay(now) || new Date();
  const end = toEndOfDay(current);
  const start = new Date(current.getTime());

  switch (presetKey) {
    case "today":
      return { start, end, presetKey };
    case "last7":
      start.setDate(start.getDate() - 6);
      return { start, end, presetKey };
    case "last30":
      start.setDate(start.getDate() - 29);
      return { start, end, presetKey };
    case "month":
      return {
        start: new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0, 0),
        end,
        presetKey,
      };
    case "last3months":
      return {
        start: new Date(current.getFullYear(), current.getMonth() - 2, 1, 0, 0, 0, 0),
        end,
        presetKey,
      };
    case "last6months":
      return {
        start: new Date(current.getFullYear(), current.getMonth() - 5, 1, 0, 0, 0, 0),
        end,
        presetKey,
      };
    case "last12months":
      return {
        start: new Date(current.getFullYear(), current.getMonth() - 11, 1, 0, 0, 0, 0),
        end,
        presetKey,
      };
    default:
      return {
        start: new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0, 0),
        end,
        presetKey: "month",
      };
  }
}

export function resolveDateRange({ fechaInicio, fechaFin, presetKey = "month", now = new Date() }) {
  const fallback = getDateRangeFromPreset(presetKey, now);
  const parsedStart = parseLocalYMDNoon(fechaInicio);
  const parsedEnd = parseLocalYMDNoon(fechaFin);
  const start = toStartOfDay(parsedStart || fallback.start);
  const end = toEndOfDay(parsedEnd || fallback.end);

  if (!start || !end) {
    return fallback;
  }

  if (start.getTime() <= end.getTime()) {
    return { start, end, presetKey };
  }

  return { start: toStartOfDay(end), end: toEndOfDay(start), presetKey };
}

export function inferGranularity(start, end) {
  const safeStart = toStartOfDay(start);
  const safeEnd = toEndOfDay(end);
  if (!safeStart || !safeEnd) return "day";
  const diffDays = Math.max(1, Math.floor((safeEnd.getTime() - safeStart.getTime()) / DAY_MS) + 1);
  if (diffDays <= 31) return "day";
  if (diffDays <= 120) return "week";
  return "month";
}

function capitalizeLabel(value) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getWeekStart(date) {
  const safeDate = toStartOfDay(date);
  if (!safeDate) return null;
  const day = safeDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(safeDate.getTime());
  start.setDate(start.getDate() + diff);
  return toStartOfDay(start);
}

function getBucketInfo(date, granularity) {
  if (!isValidDate(date)) {
    return { key: "sin-fecha", label: "Sin fecha", sortTime: 0 };
  }

  if (granularity === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: capitalizeLabel(
        start.toLocaleDateString("es-VE", { month: "short", year: "numeric" })
      ),
      sortTime: start.getTime(),
    };
  }

  if (granularity === "week") {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      key: `${formatLocalYMD(weekStart)}:${formatLocalYMD(weekEnd)}`,
      label: `${formatDisplayDate(weekStart)} - ${formatDisplayDate(weekEnd)}`,
      sortTime: weekStart.getTime(),
    };
  }

  const dayStart = toStartOfDay(date);
  return {
    key: formatLocalYMD(dayStart),
    label: formatDisplayDate(dayStart),
    sortTime: dayStart.getTime(),
  };
}

function createEmptyBucket({ key, label, sortTime }) {
  return {
    key,
    label,
    sortTime,
    ingresosUSD: 0,
    ingresosUSDDirect: 0,
    ingresosUSDFromBs: 0,
    ingresosBs: 0,
    egresosUSD: 0,
    egresosUSDDirect: 0,
    egresosUSDFromBs: 0,
    egresosBs: 0,
    serviciosEntregados: 0,
    nominaUSD: 0,
    netoUSD: 0,
    netoUSDDirect: 0,
    netoUSDFromBs: 0,
    netoBs: 0,
  };
}

function buildBuckets(records, granularity, extractor) {
  const bucketMap = new Map();

  records.forEach((record) => {
    const bucketInfo = getBucketInfo(record.date, granularity);
    if (!bucketMap.has(bucketInfo.key)) {
      bucketMap.set(bucketInfo.key, createEmptyBucket(bucketInfo));
    }

    const current = bucketMap.get(bucketInfo.key);
    extractor(current, record);
    current.netoUSD = current.ingresosUSD - current.egresosUSD - current.nominaUSD;
    current.netoUSDDirect = current.ingresosUSDDirect - current.egresosUSDDirect - current.nominaUSD;
    current.netoUSDFromBs = current.ingresosUSDFromBs - current.egresosUSDFromBs;
    current.netoBs = current.ingresosBs - current.egresosBs;
  });

  return Array.from(bucketMap.values()).sort((a, b) => a.sortTime - b.sortTime);
}

function sumBy(list, campo) {
  return list.reduce((acc, item) => acc + (item[campo] || 0), 0);
}

/**
 * Datos del reporte con las reglas de src/lib/finanzas.js.
 * - Ingresos: USD directo + conversión histórica + estimación reconstruida (aparte
 *   en ingresosUSDEstimado). Sin fecha válida no se imputan a ningún período.
 * - Egresos: todas las categorías (facturas, gastos del día, caja chica, otros).
 *   Los Bs solo se convierten con la tasa registrada; sin ella quedan pendientes
 *   de conversión. Los ambiguos (USD y Bs a la vez) quedan fuera del total.
 * - summary.completitud indica si el total es parcial y qué quedó fuera.
 * - Nómina: las que caen enteras en el rango suman completas; las que cruzan un
 *   cambio de mes o el límite del rango se prorratean por días y se marcan como
 *   prorrateadas (ver CRITERIO_NOMINA_ENTRE_PERIODOS).
 * - Servicios: criterio de entrega único; sin fecha de entrega no se imputan.
 */
export function buildReportData({
  ingresos = [],
  egresos = [],
  vehiculos = [],
  nominas = [],
  estadosServicio = [],
  factorActual = null,
  fechaInicio,
  fechaFin,
  presetKey = "month",
}) {
  const { start, end } = resolveDateRange({ fechaInicio, fechaFin, presetKey });
  const granularity = inferGranularity(start, end);
  const enRango = (date) => date >= start && date <= end;

  const calidad = {
    ingresosSinFecha: 0,
    egresosSinFecha: 0,
    nominasSinPeriodo: 0,
    serviciosEntregadosSinFecha: 0,
    ingresosConEstimacion: 0,
    ingresosConBsSinConversion: 0,
    ingresosBsSinConversion: 0,
    egresosPendientesConversion: 0,
    egresosBsPendienteConversion: 0,
    egresosImporteInvalido: 0,
    incidencias: {},
  };
  const registrar = (codigos) => {
    codigos.forEach((c) => {
      calidad.incidencias[c] = (calidad.incidencias[c] || 0) + 1;
    });
  };

  const ingresosFiltrados = [];
  ingresos.forEach((ingreso) => {
    const { fecha, incidencia } = fechaIngreso(ingreso);
    if (!fecha) {
      calidad.ingresosSinFecha += 1;
      registrar([incidencia]);
      return;
    }
    if (!enRango(fecha)) return;
    const t = totalizarIngreso(ingreso, { factorActual });
    registrar(t.incidencias);
    if (t.usdEstimado !== 0) calidad.ingresosConEstimacion += 1;
    if (t.bsSinConversion !== 0) {
      calidad.ingresosConBsSinConversion += 1;
      calidad.ingresosBsSinConversion += t.bsSinConversion;
    }
    ingresosFiltrados.push({
      raw: ingreso,
      date: fecha,
      totalUSD: t.usd,
      totalUSDDirect: t.usdDirecto,
      totalUSDFromBs: t.usdHistorico + t.usdEstimado,
      totalUSDEstimado: t.usdEstimado,
      totalBs: t.bs,
      incidencias: t.incidencias,
    });
  });

  const egresosFiltrados = [];
  const egresosAmbiguos = [];
  deduplicarPorId(egresos).forEach((egreso) => {
    const { fecha, incidencia } = fechaEgreso(egreso);
    if (!fecha) {
      calidad.egresosSinFecha += 1;
      registrar([incidencia]);
      return;
    }
    if (!enRango(fecha)) return;
    // Egresos: solo tasa registrada; sin ella quedan pendientes de conversión
    const c = convertirEgreso(egreso);
    registrar(c.incidencias);
    if (c.ambiguo) {
      egresosAmbiguos.push({
        raw: egreso,
        date: fecha,
        categoria: c.categoria,
        importeUSDOriginal: c.importeUSDOriginal,
        importeBsOriginal: c.importeBsOriginal,
        candidatos: c.candidatos,
      });
      return;
    }
    if (c.pendienteConversion) {
      calidad.egresosPendientesConversion += 1;
      calidad.egresosBsPendienteConversion += c.bs;
    } else if (c.usd === null) {
      calidad.egresosImporteInvalido += 1;
    }
    const usd = c.usd || 0;
    egresosFiltrados.push({
      raw: egreso,
      date: fecha,
      categoria: c.categoria,
      totalUSD: usd,
      totalUSDDirect: c.origen === ORIGEN.DIRECTO_USD ? usd : 0,
      totalUSDFromBs: c.origen === ORIGEN.HISTORICA ? usd : 0,
      pendienteConversion: c.pendienteConversion,
      totalBs: c.bs,
      incidencias: c.incidencias,
    });
  });

  const criterioEntrega = crearCriterioEntrega(estadosServicio);
  const serviciosFiltrados = [];
  vehiculos.forEach((vehiculo) => {
    if (!criterioEntrega.esEntregado(vehiculo)) return;
    const { fecha, incidencia } = fechaEntrega(vehiculo);
    if (!fecha) {
      calidad.serviciosEntregadosSinFecha += 1;
      registrar([incidencia]);
      return;
    }
    if (enRango(fecha)) serviciosFiltrados.push({ raw: vehiculo, date: fecha, isDelivered: true });
  });

  const nominasFiltradas = [];
  let nominaNoDesglosadaUSD = 0;
  nominas.forEach((nomina) => {
    const a = atribuirNomina(nomina, { inicio: start, fin: end });
    if (a.estado === "sin_periodo") {
      calidad.nominasSinPeriodo += 1;
      registrar(a.incidencias);
      return;
    }
    if (a.estado === "fuera") return;
    registrar(a.incidencias);
    // En la serie solo se ubica si los días atribuidos caen en un mismo intervalo
    const mismoIntervalo = getBucketInfo(a.tramo.inicio, granularity).key === getBucketInfo(a.tramo.fin, granularity).key;
    if (!mismoIntervalo) nominaNoDesglosadaUSD += a.usd || 0;
    const prorrateada = a.estado === "prorrateada";
    nominasFiltradas.push({
      raw: nomina,
      date: a.tramo.fin,
      rangeStart: a.periodo.inicio,
      rangeEnd: a.periodo.fin,
      totalUSD: a.usd || 0,
      enSerie: mismoIntervalo,
      prorrateada,
      ...(prorrateada ? { motivo: a.motivo, totalNominaUSD: a.usdTotal || 0, diasEnRango: a.diasEnRango, diasTotales: a.diasTotales } : {}),
    });
  });

  const bucketRecords = [
    ...ingresosFiltrados.map((item) => ({ type: "ingreso", ...item })),
    ...egresosFiltrados.map((item) => ({ type: "egreso", ...item })),
    ...serviciosFiltrados.map((item) => ({ type: "servicio", ...item })),
    ...nominasFiltradas.filter((item) => item.enSerie).map((item) => ({ type: "nomina", ...item })),
  ];

  const series = buildBuckets(bucketRecords, granularity, (bucket, record) => {
    if (record.type === "ingreso") {
      bucket.ingresosUSD += record.totalUSD;
      bucket.ingresosUSDDirect += record.totalUSDDirect;
      bucket.ingresosUSDFromBs += record.totalUSDFromBs;
      bucket.ingresosBs += record.totalBs;
      return;
    }
    if (record.type === "egreso") {
      bucket.egresosUSD += record.totalUSD;
      bucket.egresosUSDDirect += record.totalUSDDirect;
      bucket.egresosUSDFromBs += record.totalUSDFromBs;
      bucket.egresosBs += record.totalBs;
      return;
    }
    if (record.type === "servicio") {
      bucket.serviciosEntregados += 1;
      return;
    }
    bucket.nominaUSD += record.totalUSD;
  });

  const egresosPorCategoria = {};
  [CATEGORIA_EGRESO.FACTURA, CATEGORIA_EGRESO.GASTO_DIA, CATEGORIA_EGRESO.CAJA_CHICA, CATEGORIA_EGRESO.OTRO].forEach((categoria) => {
    const lista = egresosFiltrados.filter((e) => e.categoria === categoria);
    egresosPorCategoria[categoria] = { usd: sumBy(lista, "totalUSD"), bs: sumBy(lista, "totalBs"), cantidad: lista.length };
  });
  const nominaUSD = sumBy(nominasFiltradas, "totalUSD");
  egresosPorCategoria[CATEGORIA_EGRESO.NOMINA] = { usd: nominaUSD, bs: 0, cantidad: nominasFiltradas.length };

  const summary = {
    ingresosUSD: sumBy(ingresosFiltrados, "totalUSD"),
    ingresosUSDDirect: sumBy(ingresosFiltrados, "totalUSDDirect"),
    ingresosUSDFromBs: sumBy(ingresosFiltrados, "totalUSDFromBs"),
    ingresosUSDEstimado: sumBy(ingresosFiltrados, "totalUSDEstimado"),
    ingresosBs: sumBy(ingresosFiltrados, "totalBs"),
    egresosUSD: sumBy(egresosFiltrados, "totalUSD"),
    egresosUSDDirect: sumBy(egresosFiltrados, "totalUSDDirect"),
    egresosUSDFromBs: sumBy(egresosFiltrados, "totalUSDFromBs"),
    egresosBs: sumBy(egresosFiltrados, "totalBs"),
    egresosPorCategoria,
    // Solo lo que no depende de la interpretación (ver resumirCompletitud)
    egresosAmbiguos: {
      cantidad: egresosAmbiguos.length,
      minimoUSD: sumBy(egresosAmbiguos, "importeUSDOriginal"),
      bsSinClasificar: sumBy(egresosAmbiguos, "importeBsOriginal"),
    },
    serviciosEntregados: serviciosFiltrados.length,
    nominaUSD,
    nominaNoDesglosadaUSD,
    nominaProrrateadaUSD: sumBy(nominasFiltradas.filter((n) => n.prorrateada), "totalUSD"),
    nominasProrrateadas: nominasFiltradas.filter((n) => n.prorrateada).length,
    calidad,
  };
  summary.totalEgresosConsolidadoUSD = summary.egresosUSD + summary.nominaUSD;
  summary.completitud = resumirCompletitud({
    egresosAmbiguos,
    nominasProrrateadas: nominasFiltradas.filter((n) => n.prorrateada).map((n) => ({ usd: n.totalUSD, usdTotal: n.totalNominaUSD })),
    ingresosPendientesConversion: { cantidad: calidad.ingresosConBsSinConversion, bs: calidad.ingresosBsSinConversion },
    egresosPendientesConversion: { cantidad: calidad.egresosPendientesConversion, bs: calidad.egresosBsPendienteConversion },
    sinPeriodo: {
      ingresos: calidad.ingresosSinFecha,
      egresos: calidad.egresosSinFecha,
      nominas: calidad.nominasSinPeriodo,
      servicios: calidad.serviciosEntregadosSinFecha,
    },
    usdEstimado: summary.ingresosUSDEstimado,
  });
  summary.netoUSD = summary.ingresosUSD - summary.egresosUSD - summary.nominaUSD;
  summary.netoUSDDirect = summary.ingresosUSDDirect - summary.egresosUSDDirect - summary.nominaUSD;
  summary.netoUSDFromBs = summary.ingresosUSDFromBs - summary.egresosUSDFromBs;
  summary.netoBs = summary.ingresosBs - summary.egresosBs;

  return {
    range: {
      start,
      end,
      fechaInicio: formatLocalYMD(start),
      fechaFin: formatLocalYMD(end),
      label: `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`,
      totalDays: Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1),
    },
    granularity,
    summary,
    series,
    detail: {
      ingresos: ingresosFiltrados,
      egresos: egresosFiltrados,
      egresosAmbiguos,
      servicios: serviciosFiltrados,
      nominas: nominasFiltradas,
    },
  };
}

function formatCurrencyUSD(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrencyBs(value) {
  return Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function exportReportToExcel(reportData, fileName = null) {
  if (!reportData) return;
  // xlsx se carga solo al exportar para no inflar el bundle inicial
  const XLSX = await import("xlsx");

  const workbook = XLSX.utils.book_new();
  const safeName = fileName || `reporte-${reportData.range?.fechaInicio || "inicio"}-${reportData.range?.fechaFin || "fin"}.xlsx`;

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      "Rango": reportData.range?.label || "-",
      "Agrupación": reportData.granularity,
      "Ingresos USD": formatCurrencyUSD(reportData.summary?.ingresosUSD),
      "Ingresos USD directos": formatCurrencyUSD(reportData.summary?.ingresosUSDDirect),
      "Ingresos USD desde Bs": formatCurrencyUSD(reportData.summary?.ingresosUSDFromBs),
      "Ingresos USD estimados (factor manual actual)": formatCurrencyUSD(reportData.summary?.ingresosUSDEstimado),
      "Ingresos Bs": formatCurrencyBs(reportData.summary?.ingresosBs),
      "Egresos USD": formatCurrencyUSD(reportData.summary?.egresosUSD),
      "Egresos USD directos": formatCurrencyUSD(reportData.summary?.egresosUSDDirect),
      "Egresos USD desde Bs": formatCurrencyUSD(reportData.summary?.egresosUSDFromBs),
      "Egresos Bs": formatCurrencyBs(reportData.summary?.egresosBs),
      "Estado del total": reportData.summary?.completitud?.completo ? "Completo" : "Parcial (no reconciliado)",
      "Egresos ambiguos excluidos": reportData.summary?.egresosAmbiguos?.cantidad || 0,
      "Ambiguos: mínimo USD registrado": formatCurrencyUSD(reportData.summary?.egresosAmbiguos?.minimoUSD),
      "Ambiguos: Bs sin clasificar": formatCurrencyBs(reportData.summary?.egresosAmbiguos?.bsSinClasificar),
      "Registros pendientes de conversión": reportData.summary?.completitud?.pendientesConversion?.cantidad || 0,
      "Bs pendientes de conversión": formatCurrencyBs(reportData.summary?.completitud?.pendientesConversion?.bs),
      "Registros sin período": reportData.summary?.completitud?.sinPeriodo?.total || 0,
      "Servicios entregados": reportData.summary?.serviciosEntregados || 0,
      "Nómina USD": formatCurrencyUSD(reportData.summary?.nominaUSD),
      "Nómina prorrateada USD (incluida)": formatCurrencyUSD(reportData.summary?.nominaProrrateadaUSD),
      "Neto USD": formatCurrencyUSD(reportData.summary?.netoUSD),
      "Neto USD directo": formatCurrencyUSD(reportData.summary?.netoUSDDirect),
      "Neto USD desde Bs": formatCurrencyUSD(reportData.summary?.netoUSDFromBs),
      "Neto Bs": formatCurrencyBs(reportData.summary?.netoBs),
    },
  ]);

  const seriesSheet = XLSX.utils.json_to_sheet(
    (reportData.series || []).map((item) => ({
      Periodo: item.label,
      "Ingresos USD": formatCurrencyUSD(item.ingresosUSD),
      "Ingresos USD directos": formatCurrencyUSD(item.ingresosUSDDirect),
      "Ingresos USD desde Bs": formatCurrencyUSD(item.ingresosUSDFromBs),
      "Ingresos Bs": formatCurrencyBs(item.ingresosBs),
      "Egresos USD": formatCurrencyUSD(item.egresosUSD),
      "Egresos USD directos": formatCurrencyUSD(item.egresosUSDDirect),
      "Egresos USD desde Bs": formatCurrencyUSD(item.egresosUSDFromBs),
      "Egresos Bs": formatCurrencyBs(item.egresosBs),
      "Servicios entregados": item.serviciosEntregados,
      "Nómina USD": formatCurrencyUSD(item.nominaUSD),
      "Neto USD": formatCurrencyUSD(item.netoUSD),
      "Neto USD directo": formatCurrencyUSD(item.netoUSDDirect),
      "Neto USD desde Bs": formatCurrencyUSD(item.netoUSDFromBs),
      "Neto Bs": formatCurrencyBs(item.netoBs),
    }))
  );

  const ingresosSheet = XLSX.utils.json_to_sheet(
    (reportData.detail?.ingresos || []).map((item) => ({
      Fecha: formatDisplayDate(item.date),
      Cliente: item.raw?.cliente || item.raw?.customerName || "-",
      Descripción: item.raw?.descripcion || item.raw?.servicio || "-",
      "Total USD": formatCurrencyUSD(item.totalUSD),
      "USD directos": formatCurrencyUSD(item.totalUSDDirect),
      "USD desde Bs": formatCurrencyUSD(item.totalUSDFromBs),
      "USD estimados": formatCurrencyUSD(item.totalUSDEstimado),
      "Total Bs": formatCurrencyBs(item.totalBs),
    }))
  );

  const egresosSheet = XLSX.utils.json_to_sheet(
    (reportData.detail?.egresos || []).map((item) => ({
      Fecha: formatDisplayDate(item.date),
      Categoría: item.categoria,
      Proveedor: item.raw?.proveedor || "-",
      Documento: item.raw?.numeroDocumento || item.raw?.descripcion || "-",
      "Total USD": formatCurrencyUSD(item.totalUSD),
      "USD directos": formatCurrencyUSD(item.totalUSDDirect),
      "USD desde Bs": formatCurrencyUSD(item.totalUSDFromBs),
      "Total Bs": formatCurrencyBs(item.totalBs),
    }))
  );

  const serviciosSheet = XLSX.utils.json_to_sheet(
    (reportData.detail?.servicios || []).map((item) => ({
      Fecha: formatDisplayDate(item.date),
      Cliente: item.raw?.customerName || "-",
      Vehículo: item.raw?.vehiculo || item.raw?.vehicleType || "-",
      Servicio: item.raw?.servicio || "-",
      Estado: item.raw?.status || item.raw?.estado || "-",
    }))
  );

  const nominasSheet = XLSX.utils.json_to_sheet([
    ...(reportData.detail?.nominas || []).map((item) => ({
      Inicio: formatDisplayDate(item.rangeStart),
      Fin: formatDisplayDate(item.rangeEnd),
      Empleados: Array.isArray(item.raw?.empleados) ? item.raw.empleados.length : 0,
      "Total USD": formatCurrencyUSD(item.totalUSD),
      Estado: item.prorrateada
        ? `Prorrateada: ${item.diasEnRango} de ${item.diasTotales} días en el rango (total de la nómina ${formatCurrencyUSD(item.totalNominaUSD)})`
        : "Incluida",
    })),
  ]);

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
  XLSX.utils.book_append_sheet(workbook, seriesSheet, "Serie");
  XLSX.utils.book_append_sheet(workbook, ingresosSheet, "Ingresos");
  XLSX.utils.book_append_sheet(workbook, egresosSheet, "Egresos");
  XLSX.utils.book_append_sheet(workbook, serviciosSheet, "Servicios");
  XLSX.utils.book_append_sheet(workbook, nominasSheet, "Nomina");

  XLSX.writeFile(workbook, safeName);
}
