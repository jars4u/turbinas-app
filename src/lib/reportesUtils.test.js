/* buildReportData con la capa financiera central + regresión de las utilidades de fecha */
import {
  buildReportData,
  getDateRangeFromPreset,
  inferGranularity,
  parseMixedDate,
  resolveDateRange,
} from "./reportesUtils";

const ts = (y, m, d, h = 12) => ({ toDate: () => new Date(y, m - 1, d, h, 0, 0) });
const octubre = { fechaInicio: "2026-10-01", fechaFin: "2026-10-31", presetKey: "custom" };

describe("10. regresión de utilidades existentes", () => {
  test("presets y rango personalizado (incluye intercambio si vienen al revés)", () => {
    const ahora = new Date(2026, 9, 19, 15);
    const mes = getDateRangeFromPreset("month", ahora);
    expect(mes.start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(mes.end).toEqual(new Date(2026, 9, 19, 23, 59, 59, 999));
    expect(getDateRangeFromPreset("last7", ahora).start).toEqual(new Date(2026, 9, 13, 0, 0, 0, 0));
    const r = resolveDateRange({ fechaInicio: "2026-10-31", fechaFin: "2026-10-01" });
    expect(r.start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  test("granularidad por longitud del rango", () => {
    expect(inferGranularity(new Date(2026, 9, 1), new Date(2026, 9, 31))).toBe("day");
    expect(inferGranularity(new Date(2026, 6, 1), new Date(2026, 9, 1))).toBe("week");
    expect(inferGranularity(new Date(2025, 9, 1), new Date(2026, 9, 1))).toBe("month");
  });

  test("parseMixedDate acepta los formatos válidos y rechaza fechas imposibles", () => {
    expect(parseMixedDate("2026-10-05")).toEqual(new Date(2026, 9, 5, 12));
    expect(parseMixedDate("05/10/2026")).toEqual(new Date(2026, 9, 5, 12));
    expect(parseMixedDate("31/02/2026")).toBeNull();
    expect(parseMixedDate(null)).toBeNull();
  });

  test("caso clásico: USD directo, Bs con conversión histórica y factura en Bs con tasaFactura", () => {
    const r = buildReportData({
      ...octubre,
      ingresos: [
        { fecha: "05/10/2026", fechaRaw: new Date(2026, 9, 5, 12), formasPago: [{ formaPago: "efectivo", monto: "100" }, { formaPago: "pago movil", montoBs: 4000, usdEquiv: 100, factorConversion: 40 }] },
      ],
      egresos: [{ id: "f1", tipo: "factura", fecha: ts(2026, 10, 6), fechaStr: "06/10/2026", montoUSD: 0, montoBs: 4100, tasaFactura: 41, monedaFactura: "Bs" }],
    });
    expect(r.summary).toMatchObject({
      ingresosUSD: 200, ingresosUSDDirect: 100, ingresosUSDFromBs: 100, ingresosUSDEstimado: 0, ingresosBs: 4000,
      egresosUSD: 100, egresosUSDDirect: 0, egresosUSDFromBs: 100, egresosBs: 4100,
      netoUSD: 100, netoUSDDirect: 100, netoUSDFromBs: 0, netoBs: -100,
    });
    expect(r.granularity).toBe("day");
    expect(r.series.map((b) => b.key)).toEqual(["2026-10-05", "2026-10-06"]);
    // Contrato que consume la interfaz
    for (const campo of ["ingresosUSD", "ingresosUSDDirect", "ingresosBs", "egresosUSD", "egresosUSDDirect", "egresosBs", "nominaUSD", "serviciosEntregados", "netoUSD", "netoUSDDirect", "netoBs"]) {
      expect(typeof r.summary[campo]).toBe("number");
    }
    expect(Object.keys(r.detail)).toEqual(expect.arrayContaining(["ingresos", "egresos", "servicios", "nominas"]));
  });
});

describe("integración de reglas en buildReportData", () => {
  test("consolida categorías y nómina sin duplicar movimientos ni sumar ambiguos", () => {
    const egresos = [
      { id: "f1", tipo: "factura", fecha: ts(2026, 10, 5), montoUSD: 100, montoBs: 0 },
      { id: "f1", tipo: "factura", fecha: ts(2026, 10, 5), montoUSD: 100, montoBs: 0 }, // misma lectura repetida
      { id: "g1", tipo: "gastoDia", fecha: ts(2026, 10, 6), montoUSD: 20, montoBs: 0 },
      { id: "c1", divisa: "USD", fecha: ts(2026, 10, 7), montoUSD: 5, montoBs: 0 }, // reposición de caja chica
      { id: "o1", fecha: "08/10/2026", montoUSD: 7, montoBs: 0 },
      { id: "a1", fecha: "09/10/2026", montoUSD: 50, montoBs: 2000, tasa: 40 }, // ambiguo
    ];
    const nominas = [{ fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [{ monto: 300 }] }];
    const r = buildReportData({ ...octubre, egresos, nominas });
    expect(r.summary.egresosPorCategoria).toEqual({
      factura: { usd: 100, bs: 0, cantidad: 1 },
      gasto_dia: { usd: 20, bs: 0, cantidad: 1 },
      caja_chica: { usd: 5, bs: 0, cantidad: 1 },
      otro: { usd: 7, bs: 0, cantidad: 1 },
      nomina: { usd: 300, bs: 0, cantidad: 1 },
    });
    expect(r.summary.egresosUSD).toBe(132);
    expect(r.summary.totalEgresosConsolidadoUSD).toBe(432);
    // Solo lo que no depende de la interpretación; USD y Bs no se suman entre sí
    expect(r.summary.egresosAmbiguos).toEqual({ cantidad: 1, minimoUSD: 50, bsSinClasificar: 2000 });
    expect(r.summary.completitud).toMatchObject({ completo: false, areas: { egresos: false, ingresos: true, nomina: true } });
    expect(r.detail.egresosAmbiguos).toHaveLength(1);
    expect(r.summary.netoUSD).toBe(-432);
  });

  test("estimaciones reconstruidas separadas y Bs sin factor sin USD", () => {
    const ingresos = [{ fecha: "05/10/2026", formasPago: [{ formaPago: "pago movil", monto: "4500" }] }];
    const conFactor = buildReportData({ ...octubre, ingresos, factorActual: 45 });
    expect(conFactor.summary).toMatchObject({ ingresosUSD: 100, ingresosUSDEstimado: 100, ingresosUSDFromBs: 100, ingresosBs: 4500 });
    expect(conFactor.summary.calidad.ingresosConEstimacion).toBe(1);
    const sinFactor = buildReportData({ ...octubre, ingresos, factorActual: null });
    expect(sinFactor.summary).toMatchObject({ ingresosUSD: 0, ingresosBs: 4500 });
    expect(sinFactor.summary.calidad.ingresosConBsSinConversion).toBe(1);
  });

  test("nómina que cruza de mes: ni en septiembre ni en octubre, siempre informada como pendiente", () => {
    const nominas = [{ fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ monto: 300 }] }];
    const sep = buildReportData({ fechaInicio: "2026-09-01", fechaFin: "2026-09-30", presetKey: "custom", nominas });
    const oct = buildReportData({ ...octubre, nominas });
    for (const r of [sep, oct]) {
      expect(r.summary).toMatchObject({ nominaUSD: 0, nominaPendienteUSD: 300, nominasPendientes: 1 });
      expect(r.series.reduce((acc, b) => acc + b.nominaUSD, 0)).toBe(0);
    }
    const trimestre = buildReportData({ fechaInicio: "2026-08-01", fechaFin: "2026-10-31", presetKey: "custom", nominas });
    expect(trimestre.summary.nominaUSD).toBe(0);
    expect(trimestre.summary.nominasPendientes).toBe(1);
  });

  test("nómina en la serie solo si cabe en un intervalo; si no, se informa como no desglosada", () => {
    const nominas = [{ fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [{ monto: 300 }] }];
    const diario = buildReportData({ ...octubre, nominas });
    expect(diario.summary.nominaUSD).toBe(300);
    expect(diario.summary.nominaNoDesglosadaUSD).toBe(300);
    expect(diario.series.reduce((acc, b) => acc + b.nominaUSD, 0)).toBe(0);
    const semanal = buildReportData({ fechaInicio: "2026-08-01", fechaFin: "2026-10-31", presetKey: "custom", nominas });
    expect(semanal.granularity).toBe("week");
    expect(semanal.summary.nominaNoDesglosadaUSD).toBe(0);
    expect(semanal.series.reduce((acc, b) => acc + b.nominaUSD, 0)).toBe(300);
  });

  test("servicios: estado configurado y equivalentes; sin fecha de entrega no se imputan", () => {
    const vehiculos = [
      { status: "pagado", fechaEntrega: new Date(2026, 9, 5, 18).getTime() },
      { status: "entregado", fechaEntrega: new Date(2026, 9, 6, 18).getTime() },
      { status: "entregado", fechaEntrega: null, arrivalTime: new Date(2026, 9, 6, 9).getTime() },
      { status: "por_cobrar", fechaEntrega: new Date(2026, 9, 6, 18).getTime() },
    ];
    const r = buildReportData({ ...octubre, vehiculos, estadosServicio: [{ nombre: "pagado", defaultFacturar: true }] });
    expect(r.summary.serviciosEntregados).toBe(2);
    expect(r.summary.calidad.serviciosEntregadosSinFecha).toBe(1);
  });

  test("registros con fecha inválida o importe NaN no se convierten en cifras", () => {
    const r = buildReportData({
      ...octubre,
      ingresos: [
        { fecha: "31/02/2026", formasPago: [{ formaPago: "efectivo", monto: 50 }] },
        { fecha: "05/10/2026", formasPago: [{ formaPago: "pago movil", montoBs: NaN }] },
      ],
      egresos: [{ id: "x", fecha: ts(2026, 10, 5), montoUSD: NaN, montoBs: 0 }],
    });
    expect(r.summary).toMatchObject({ ingresosUSD: 0, ingresosBs: 0, egresosUSD: 0 });
    expect(r.summary.calidad.ingresosSinFecha).toBe(1);
    expect(r.summary.calidad.egresosImporteInvalido).toBe(1);
    expect(r.summary.calidad.incidencias.importe_invalido).toBe(2);
  });
});

describe("egresos en Bs sin tasa y completitud de los totales", () => {
  test("el egreso en Bs sin tasa queda pendiente de conversión aunque haya factor manual", () => {
    const r = buildReportData({
      ...octubre,
      factorActual: 45,
      egresos: [
        { id: "g1", tipo: "gastoDia", fecha: ts(2026, 10, 6), montoUSD: 0, montoBs: 4500, tasaFactura: null, monedaFactura: "Bs" },
        { id: "f1", tipo: "factura", fecha: ts(2026, 10, 6), montoUSD: 0, montoBs: 4100, tasaFactura: 41, monedaFactura: "Bs" },
      ],
    });
    expect(r.summary).toMatchObject({ egresosUSD: 100, egresosBs: 8600 });
    expect(r.summary.calidad).toMatchObject({ egresosPendientesConversion: 1, egresosBsPendienteConversion: 4500 });
    expect(r.summary.completitud).toMatchObject({
      completo: false,
      areas: { egresos: false },
      pendientesConversion: { cantidad: 1, egresos: 1, ingresos: 0, bs: 4500 },
    });
  });

  test("sin exclusiones ni pendientes el total es completo; las estimaciones se señalan aparte", () => {
    const r = buildReportData({
      ...octubre,
      factorActual: 45,
      ingresos: [{ fecha: "05/10/2026", formasPago: [{ formaPago: "pago movil", monto: "4500" }] }],
      egresos: [{ id: "f1", tipo: "factura", fecha: ts(2026, 10, 6), montoUSD: 30, montoBs: 0 }],
    });
    expect(r.summary.completitud).toMatchObject({ completo: true, incluyeEstimaciones: true, usdEstimado: 100 });
  });

  test("nóminas pendientes y registros sin fecha vuelven parcial el total", () => {
    const r = buildReportData({
      ...octubre,
      ingresos: [{ fecha: "31/02/2026", formasPago: [{ formaPago: "efectivo", monto: 5 }] }],
      nominas: [{ fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ monto: 300 }] }],
    });
    expect(r.summary.completitud).toMatchObject({
      completo: false,
      areas: { ingresos: false, nomina: false },
      pendientesCriterio: { cantidad: 1, usd: 300 },
      sinPeriodo: { ingresos: 1, total: 1 },
    });
  });
});
