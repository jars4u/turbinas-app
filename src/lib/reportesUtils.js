import * as XLSX from "xlsx";

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

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pickPositive(...candidates) {
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 0;
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

export function parseMixedDate(value) {
  if (!value) return null;

  if (isValidDate(value)) {
    return new Date(value.getTime());
  }

  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return isValidDate(converted) ? converted : null;
  }

  if (typeof value?.seconds === "number") {
    const converted = new Date(value.seconds * 1000);
    return isValidDate(converted) ? converted : null;
  }

  if (typeof value === "number") {
    const converted = new Date(value);
    return isValidDate(converted) ? converted : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]), 12, 0, 0, 0);
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]), 12, 0, 0, 0);
  }

  const slashOrDashParts = trimmed.split(/[/-]/);
  if (slashOrDashParts.length === 3) {
    const [first, second, third] = slashOrDashParts.map(Number);
    if (String(slashOrDashParts[0]).length === 4) {
      return new Date(first, second - 1, third, 12, 0, 0, 0);
    }
    return new Date(third, second - 1, first, 12, 0, 0, 0);
  }

  const converted = new Date(trimmed);
  return isValidDate(converted) ? converted : null;
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

function getIngresoTotals(ingreso) {
  const formasPago = Array.isArray(ingreso?.formasPago) ? ingreso.formasPago : [];
  if (formasPago.length === 0) {
    const totalUSDDirect = normalizeNumber(ingreso?.montoUSD || ingreso?.monto);
    const totalBs = normalizeNumber(ingreso?.montoBs);
    const totalUSDFromBs = pickPositive(
      ingreso?.usdEquiv,
      totalBs > 0 ? totalBs / pickPositive(ingreso?.factorConversion) : 0
    );
    return {
      totalUSD: totalUSDDirect + totalUSDFromBs,
      totalUSDDirect,
      totalUSDFromBs,
      totalBs,
    };
  }

  return formasPago.reduce(
    (acc, formaPago) => {
      const metodo = String(formaPago?.formaPago || "").trim().toLowerCase();
      if (metodo === "pago movil" || metodo === "pago móvil") {
        const montoBs = normalizeNumber(formaPago?.montoBs || formaPago?.monto);
        const usdEquiv = pickPositive(formaPago?.usdEquiv);
        const factorConversion = pickPositive(formaPago?.factorConversion);

        acc.totalBs += montoBs;
        if (usdEquiv > 0) {
          acc.totalUSDFromBs += usdEquiv;
          acc.totalUSD += usdEquiv;
        } else if (montoBs > 0 && factorConversion > 0) {
          const convertedUsd = montoBs / factorConversion;
          acc.totalUSDFromBs += convertedUsd;
          acc.totalUSD += convertedUsd;
        }
        return acc;
      }

      const directUsd = normalizeNumber(formaPago?.monto || formaPago?.montoUSD || formaPago?.usdEquiv);
      acc.totalUSDDirect += directUsd;
      acc.totalUSD += directUsd;
      return acc;
    },
    { totalUSD: 0, totalUSDDirect: 0, totalUSDFromBs: 0, totalBs: 0 }
  );
}

function getEgresoTotals(egreso) {
  const montoUSD = normalizeNumber(egreso?.montoUSD);
  const montoBs = normalizeNumber(egreso?.montoBs);
  const tasaFactura = pickPositive(egreso?.tasaFactura);

  if (montoUSD > 0 || montoBs > 0) {
    const totalUSDFromBs = montoBs > 0 && tasaFactura > 0 ? montoBs / tasaFactura : 0;
    return {
      totalUSD: montoUSD + totalUSDFromBs,
      totalUSDDirect: montoUSD,
      totalUSDFromBs,
      totalBs: montoBs,
    };
  }

  const items = Array.isArray(egreso?.items) ? egreso.items : [];
  const totalItems = items.reduce((acc, item) => {
    const totalItem = normalizeNumber(item?.totalItem);
    if (totalItem > 0) return acc + totalItem;
    const cantidad = normalizeNumber(item?.cantidad);
    const precioUnitario = normalizeNumber(item?.precioUnitario);
    return acc + cantidad * precioUnitario;
  }, 0);

  const moneda = String(egreso?.monedaFactura || "USD").trim().toUpperCase();
  if (moneda === "BS") {
    const totalUSDFromBs = totalItems > 0 && tasaFactura > 0 ? totalItems / tasaFactura : 0;
    return {
      totalUSD: totalUSDFromBs,
      totalUSDDirect: 0,
      totalUSDFromBs,
      totalBs: totalItems,
    };
  }

  return {
    totalUSD: totalItems,
    totalUSDDirect: totalItems,
    totalUSDFromBs: 0,
    totalBs: 0,
  };
}

function getVehiculoDeliveryDate(vehiculo) {
  return (
    parseMixedDate(vehiculo?.fechaEntrega) ||
    parseMixedDate(vehiculo?.deliveredAt) ||
    parseMixedDate(vehiculo?.updatedAt) ||
    null
  );
}

function isVehiculoDelivered(vehiculo) {
  const estado = String(vehiculo?.status || vehiculo?.estado || "").trim().toLowerCase();
  return estado.includes("entreg") || estado.includes("reparad") || estado.includes("complet");
}

function getNominaPeriod(nomina) {
  const start = parseMixedDate(nomina?.fechaInicio);
  const end = parseMixedDate(nomina?.fechaFin) || parseMixedDate(nomina?.fechaGuardado);
  return {
    start: start || end,
    end: end || start,
  };
}

function getNominaTotal(nomina) {
  const empleados = Array.isArray(nomina?.empleados) ? nomina.empleados : [];
  const totalEmpleados = empleados.reduce((acc, empleado) => acc + normalizeNumber(empleado?.monto), 0);
  if (totalEmpleados > 0) return totalEmpleados;
  return normalizeNumber(nomina?.total || nomina?.totalNomina || nomina?.montoTotal);
}

function overlapsRange(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
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

export function buildReportData({
  ingresos = [],
  egresos = [],
  vehiculos = [],
  nominas = [],
  fechaInicio,
  fechaFin,
  presetKey = "month",
}) {
  const { start, end } = resolveDateRange({ fechaInicio, fechaFin, presetKey });
  const granularity = inferGranularity(start, end);

  const ingresosFiltrados = ingresos
    .map((ingreso) => ({
      raw: ingreso,
      date: parseMixedDate(ingreso?.fechaRaw || ingreso?.fecha),
      ...getIngresoTotals(ingreso),
    }))
    .filter((ingreso) => ingreso.date && ingreso.date >= start && ingreso.date <= end);

  const egresosFiltrados = egresos
    .map((egreso) => ({
      raw: egreso,
      date: parseMixedDate(egreso?.fechaStr || egreso?.fecha),
      ...getEgresoTotals(egreso),
    }))
    .filter((egreso) => egreso.date && egreso.date >= start && egreso.date <= end);

  const serviciosFiltrados = vehiculos
    .map((vehiculo) => ({
      raw: vehiculo,
      date: getVehiculoDeliveryDate(vehiculo),
      isDelivered: isVehiculoDelivered(vehiculo),
    }))
    .filter((vehiculo) => vehiculo.isDelivered && vehiculo.date && vehiculo.date >= start && vehiculo.date <= end);

  const nominasFiltradas = nominas
    .map((nomina) => {
      const period = getNominaPeriod(nomina);
      return {
        raw: nomina,
        date: period.end || period.start,
        rangeStart: period.start,
        rangeEnd: period.end,
        totalUSD: getNominaTotal(nomina),
      };
    })
    .filter((nomina) => nomina.rangeStart && nomina.rangeEnd && overlapsRange(nomina.rangeStart, nomina.rangeEnd, start, end));

  const bucketRecords = [
    ...ingresosFiltrados.map((item) => ({ type: "ingreso", ...item })),
    ...egresosFiltrados.map((item) => ({ type: "egreso", ...item })),
    ...serviciosFiltrados.map((item) => ({ type: "servicio", ...item })),
    ...nominasFiltradas.map((item) => ({ type: "nomina", ...item })),
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

  const summary = {
    ingresosUSD: ingresosFiltrados.reduce((acc, item) => acc + item.totalUSD, 0),
    ingresosUSDDirect: ingresosFiltrados.reduce((acc, item) => acc + item.totalUSDDirect, 0),
    ingresosUSDFromBs: ingresosFiltrados.reduce((acc, item) => acc + item.totalUSDFromBs, 0),
    ingresosBs: ingresosFiltrados.reduce((acc, item) => acc + item.totalBs, 0),
    egresosUSD: egresosFiltrados.reduce((acc, item) => acc + item.totalUSD, 0),
    egresosUSDDirect: egresosFiltrados.reduce((acc, item) => acc + item.totalUSDDirect, 0),
    egresosUSDFromBs: egresosFiltrados.reduce((acc, item) => acc + item.totalUSDFromBs, 0),
    egresosBs: egresosFiltrados.reduce((acc, item) => acc + item.totalBs, 0),
    serviciosEntregados: serviciosFiltrados.length,
    nominaUSD: nominasFiltradas.reduce((acc, item) => acc + item.totalUSD, 0),
  };
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

export function exportReportToExcel(reportData, fileName = null) {
  if (!reportData) return;

  const workbook = XLSX.utils.book_new();
  const safeName = fileName || `reporte-${reportData.range?.fechaInicio || "inicio"}-${reportData.range?.fechaFin || "fin"}.xlsx`;

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      "Rango": reportData.range?.label || "-",
      "Agrupación": reportData.granularity,
      "Ingresos USD": formatCurrencyUSD(reportData.summary?.ingresosUSD),
      "Ingresos USD directos": formatCurrencyUSD(reportData.summary?.ingresosUSDDirect),
      "Ingresos USD desde Bs": formatCurrencyUSD(reportData.summary?.ingresosUSDFromBs),
      "Ingresos Bs": formatCurrencyBs(reportData.summary?.ingresosBs),
      "Egresos USD": formatCurrencyUSD(reportData.summary?.egresosUSD),
      "Egresos USD directos": formatCurrencyUSD(reportData.summary?.egresosUSDDirect),
      "Egresos USD desde Bs": formatCurrencyUSD(reportData.summary?.egresosUSDFromBs),
      "Egresos Bs": formatCurrencyBs(reportData.summary?.egresosBs),
      "Servicios entregados": reportData.summary?.serviciosEntregados || 0,
      "Nómina USD": formatCurrencyUSD(reportData.summary?.nominaUSD),
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
      "Total Bs": formatCurrencyBs(item.totalBs),
    }))
  );

  const egresosSheet = XLSX.utils.json_to_sheet(
    (reportData.detail?.egresos || []).map((item) => ({
      Fecha: formatDisplayDate(item.date),
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

  const nominasSheet = XLSX.utils.json_to_sheet(
    (reportData.detail?.nominas || []).map((item) => ({
      Inicio: formatDisplayDate(item.rangeStart),
      Fin: formatDisplayDate(item.rangeEnd),
      Empleados: Array.isArray(item.raw?.empleados) ? item.raw.empleados.length : 0,
      "Total USD": formatCurrencyUSD(item.totalUSD),
    }))
  );

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
  XLSX.utils.book_append_sheet(workbook, seriesSheet, "Serie");
  XLSX.utils.book_append_sheet(workbook, ingresosSheet, "Ingresos");
  XLSX.utils.book_append_sheet(workbook, egresosSheet, "Egresos");
  XLSX.utils.book_append_sheet(workbook, serviciosSheet, "Servicios");
  XLSX.utils.book_append_sheet(workbook, nominasSheet, "Nomina");

  XLSX.writeFile(workbook, safeName);
}
