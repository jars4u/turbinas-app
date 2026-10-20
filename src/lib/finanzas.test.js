/* Reglas financieras compartidas: conversiones, egresos, fechas, nóminas, entregas y calidad de datos */
import {
  CATEGORIA_EGRESO,
  CRITERIO_NOMINA_ENTRE_PERIODOS,
  INCIDENCIA,
  ORIGEN,
  atribuirNomina,
  clasificarEgreso,
  convertirEgreso,
  convertirPagoIngreso,
  crearCriterioEntrega,
  deduplicarPorId,
  factorParaEstimacion,
  fechaEgreso,
  fechaEntrega,
  leerFecha,
  leerImporte,
  resumirCompletitud,
  totalizarIngreso,
  totalNomina,
} from "./finanzas";

const congelar = (obj) => {
  Object.values(obj).forEach((v) => v && typeof v === "object" && congelar(v));
  return Object.freeze(obj);
};

const dia = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0);
const rango = (a, b) => ({ inicio: new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0), fin: new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999) });

describe("1. pagos en Bs con conversión histórica válida", () => {
  test("usdEquiv registrado tiene prioridad y no se recalcula con el factor actual", () => {
    const p = convertirPagoIngreso({ formaPago: "pago movil", montoBs: 4000, usdEquiv: 100, factorConversion: 40 }, { factorActual: 80 });
    expect(p).toMatchObject({ moneda: "BS", importeOriginal: 4000, usd: 100, origen: ORIGEN.HISTORICA, factorAplicado: 40 });
  });

  test("solo factorConversion registrado: Bs / factor histórico", () => {
    const p = convertirPagoIngreso({ formaPago: "PAGO MÓVIL", monto: "3000", factorConversion: 30 }, { factorActual: 80 });
    expect(p).toMatchObject({ importeOriginal: 3000, usd: 100, origen: ORIGEN.HISTORICA, factorAplicado: 30 });
  });

  test("egreso en Bs con tasaFactura o con la tasa registrada en la operación", () => {
    expect(convertirEgreso({ tipo: "factura", montoUSD: 0, montoBs: 4100, tasaFactura: 41 }, { factorActual: 80 })).toMatchObject({ usd: 100, origen: ORIGEN.HISTORICA, bs: 4100 });
    expect(convertirEgreso({ divisa: "Bs", montoUSD: 0, montoBs: 4050, tasa: 40.5 }, { factorActual: 80 })).toMatchObject({ usd: 100, origen: ORIGEN.HISTORICA, categoria: CATEGORIA_EGRESO.CAJA_CHICA });
  });
});

describe("2. pagos sin conversión histórica: estimación reconstruida", () => {
  test("se estima con el factor manual actual y queda identificado como estimación", () => {
    const p = convertirPagoIngreso({ formaPago: "pago movil", monto: "4500" }, { factorActual: 45 });
    expect(p).toMatchObject({ usd: 100, origen: ORIGEN.ESTIMACION, factorAplicado: 45, importeOriginal: 4500 });
    const t = totalizarIngreso({ formasPago: [{ formaPago: "pago movil", monto: "4500" }, { formaPago: "efectivo", monto: "20" }] }, { factorActual: 45 });
    expect(t).toMatchObject({ usd: 120, usdEstimado: 100, usdDirecto: 20, usdHistorico: 0, bs: 4500 });
  });

  test("sin factor manual utilizable no hay USD ni se inventa un factor", () => {
    const p = convertirPagoIngreso({ formaPago: "pago movil", montoBs: 4500 }, { factorActual: null });
    expect(p).toMatchObject({ usd: null, origen: ORIGEN.SIN_CONVERSION, importeOriginal: 4500 });
    expect(p.incidencias).toContain(INCIDENCIA.SIN_FACTOR_PARA_ESTIMAR);
    const t = totalizarIngreso({ formasPago: [{ formaPago: "pago movil", montoBs: 4500 }] });
    expect(t).toMatchObject({ usd: 0, bs: 4500, bsSinConversion: 4500 });
  });

  test("factorParaEstimacion usa el valor manual y descarta el 1 por defecto", () => {
    expect(factorParaEstimacion({ modo: "manual", valorManual: 45, factor: 45 })).toBe(45);
    expect(factorParaEstimacion({ modo: "bcv_usd", valorManual: 45, factor: 39 })).toBe(45);
    expect(factorParaEstimacion({ valorManual: 1 })).toBeNull();
    expect(factorParaEstimacion(null)).toBeNull();
  });
});

describe("3. importes originales preservados y sin doble conversión", () => {
  test("no modifica el registro y conserva el importe original", () => {
    const ingreso = congelar({ montoBs: 99999, formasPago: [{ formaPago: "pago movil", montoBs: 4000, usdEquiv: 100 }, { formaPago: "zelle", monto: 50 }] });
    const antes = JSON.stringify(ingreso);
    const t = totalizarIngreso(ingreso, { factorActual: 45 });
    expect(JSON.stringify(ingreso)).toBe(antes);
    expect(t.pagos.map((p) => p.importeOriginal)).toEqual([4000, 50]);
    // usdEquiv se usa tal cual (no se vuelve a dividir) y el montoBs de la raíz (precio) no suma
    expect(t).toMatchObject({ usd: 150, usdHistorico: 100, usdDirecto: 50, bs: 4000 });
  });

  test("el montoBs de la raíz sin formas de pago es una incidencia, no un pago", () => {
    const t = totalizarIngreso({ formaPago: "zelle", monto: 30, montoBs: 1200 }, { factorActual: 40 });
    expect(t).toMatchObject({ usd: 30, bs: 0 });
    expect(t.incidencias).toContain(INCIDENCIA.MONTO_BS_RAIZ_NO_ES_PAGO);
  });
});

describe("4. categorías de egresos sin duplicar movimientos", () => {
  test("clasificación por evidencia de campos", () => {
    expect(clasificarEgreso({ tipo: "factura" })).toBe(CATEGORIA_EGRESO.FACTURA);
    expect(clasificarEgreso({ tipo: "gastoDia" })).toBe(CATEGORIA_EGRESO.GASTO_DIA);
    expect(clasificarEgreso({ divisa: "USD", montoUSD: 5 })).toBe(CATEGORIA_EGRESO.CAJA_CHICA);
    expect(clasificarEgreso({ montoUSD: 5 })).toBe(CATEGORIA_EGRESO.OTRO);
  });

  test("deduplicarPorId conserva un solo registro por id y no descarta los que no tienen id", () => {
    const lista = [{ id: "a", montoUSD: 1 }, { id: "a", montoUSD: 1 }, { montoUSD: 2 }, { montoUSD: 2 }];
    expect(deduplicarPorId(lista)).toHaveLength(3);
  });

  test("totalNomina suma empleados[].monto", () => {
    expect(totalNomina({ empleados: [{ monto: 100 }, { monto: "50" }] })).toEqual({ usd: 150, incidencias: [] });
  });
});

describe("5. egresos con ambas monedas de semántica ambigua", () => {
  test("se marca como ambiguo, no suma y expone ambos candidatos", () => {
    const c = convertirEgreso({ montoUSD: 50, montoBs: 2000, tasa: 40 }, { factorActual: 45 });
    expect(c).toMatchObject({ ambiguo: true, usd: null, importeUSDOriginal: 50, importeBsOriginal: 2000 });
    expect(c.candidatos).toEqual({ mismoGastoUSD: 50, gastosDistintosUSD: 100 });
    expect(c.incidencias).toContain(INCIDENCIA.EGRESO_DOBLE_MONEDA_AMBIGUO);
  });

  test("sin tasa ni factor, el candidato de gastos distintos queda desconocido", () => {
    const c = convertirEgreso({ montoUSD: 50, montoBs: 2000 }, { factorActual: null });
    expect(c.candidatos).toEqual({ mismoGastoUSD: 50, gastosDistintosUSD: null });
  });
});

describe("6. fechas DD/MM/YYYY, YYYY-MM-DD y Timestamp", () => {
  test("YYYY-MM-DD no se reinterpreta como DD/MM/YYYY", () => {
    expect(leerFecha("2026-10-05")).toEqual({ estado: "valida", fecha: dia(2026, 10, 5), formato: "aaaa-mm-dd" });
    expect(leerFecha("05/10/2026")).toEqual({ estado: "valida", fecha: dia(2026, 10, 5), formato: "dd/mm/aaaa" });
    expect(leerFecha("5-10-2026").fecha).toEqual(dia(2026, 10, 5));
  });

  test("Timestamp, {seconds}, Date y milisegundos", () => {
    const ms = new Date(2026, 9, 5, 18, 30).getTime();
    expect(leerFecha({ toDate: () => new Date(ms) }).fecha.getTime()).toBe(ms);
    expect(leerFecha({ seconds: ms / 1000, nanoseconds: 0 }).fecha.getTime()).toBe(ms);
    expect(leerFecha(new Date(ms)).fecha.getTime()).toBe(ms);
    expect(leerFecha(ms)).toMatchObject({ estado: "valida", formato: "epoch_ms" });
  });

  test("egreso: Timestamp y, si falta, fechaStr", () => {
    expect(fechaEgreso({ fechaStr: "07/10/2026" }).fecha).toEqual(dia(2026, 10, 7));
    expect(fechaEgreso({ fecha: "07/10/2026" }).fecha).toEqual(dia(2026, 10, 7));
  });
});

describe("7. nóminas que cruzan de mes", () => {
  const cruzaMes = { fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ monto: 300 }] };

  test("el criterio es prorrateo por días", () => {
    expect(CRITERIO_NOMINA_ENTRE_PERIODOS).toBe("prorrateo_por_dias");
  });

  test("se prorratea por días: 3 de 5 a septiembre y 2 de 5 a octubre, sin perder ni duplicar", () => {
    const sep = atribuirNomina(cruzaMes, rango(dia(2026, 9, 1), dia(2026, 9, 30)));
    const oct = atribuirNomina(cruzaMes, rango(dia(2026, 10, 1), dia(2026, 10, 31)));
    expect(sep).toMatchObject({ estado: "prorrateada", motivo: "cruza_cambio_de_mes", usd: 180, usdTotal: 300, diasEnRango: 3, diasTotales: 5 });
    expect(oct).toMatchObject({ estado: "prorrateada", motivo: "cruza_cambio_de_mes", usd: 120, usdTotal: 300, diasEnRango: 2, diasTotales: 5 });
    expect(sep.usd + oct.usd).toBe(300);
    for (const a of [sep, oct]) expect(a.incidencias).toContain(INCIDENCIA.NOMINA_PRORRATEADA);
  });

  test("si el rango cubre todo su período, suma completa aunque cruce de mes", () => {
    expect(atribuirNomina(cruzaMes, rango(dia(2026, 9, 1), dia(2026, 10, 31)))).toMatchObject({ estado: "dentro", usd: 300 });
  });

  test("dentro del rango suma completa; cortada por el rango se prorratea", () => {
    const semana = { fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [{ monto: 200 }] };
    expect(atribuirNomina(semana, rango(dia(2026, 10, 1), dia(2026, 10, 31)))).toMatchObject({ estado: "dentro", usd: 200 });
    expect(atribuirNomina(semana, rango(dia(2026, 10, 7), dia(2026, 10, 31)))).toMatchObject({ estado: "prorrateada", motivo: "cruza_limite_del_rango", usd: 120, diasEnRango: 3 });
    expect(atribuirNomina(semana, rango(dia(2026, 11, 1), dia(2026, 11, 30)))).toMatchObject({ estado: "fuera" });
  });

  test("sin período válido no se usa fechaGuardado como sustituto", () => {
    const a = atribuirNomina({ fechaFin: "2026-10-09", fechaGuardado: { seconds: 1791000000 }, empleados: [{ monto: 1 }] }, rango(dia(2026, 10, 1), dia(2026, 10, 31)));
    expect(a.estado).toBe("sin_periodo");
  });
});

describe("8. estados terminales configurados y equivalentes históricos", () => {
  const criterio = crearCriterioEntrega([
    { nombre: "pagado", defaultFacturar: true },
    { nombre: "Archivado", dejarDeMostrar: true },
    { nombre: "proceso" },
    { nombre: "por_cobrar" },
  ]);

  test("configuración oficial (defaultFacturar, dejarDeMostrar) normalizada", () => {
    expect(criterio.esEntregado({ status: "pagado" })).toBe(true);
    expect(criterio.esEntregado({ status: "PAGADO" })).toBe(true);
    expect(criterio.esEntregado({ status: "archivado" })).toBe(true);
    expect(criterio.terminalesConfigurados.sort()).toEqual(["archivado", "pagado"]);
  });

  test("equivalentes históricos y estados no terminales", () => {
    expect(criterio.esEntregado({ status: "Entregado" })).toBe(true);
    expect(criterio.esEntregado({ estado: "Reparado" })).toBe(true);
    expect(criterio.esEntregado({ status: "proceso" })).toBe(false);
    expect(criterio.esEntregado({ status: "por_cobrar" })).toBe(false);
    expect(criterio.esEntregado({})).toBe(false);
  });

  test("sin fecha de entrega verificable no se inventa (arrivalTime no cuenta)", () => {
    expect(fechaEntrega({ status: "entregado", arrivalTime: Date.now() })).toEqual({ fecha: null, incidencia: INCIDENCIA.ENTREGADO_SIN_FECHA });
    expect(fechaEntrega({ fechaEntrega: new Date(2026, 9, 5, 18).getTime() }).fecha).toEqual(new Date(2026, 9, 5, 18));
  });
});

describe("9. NaN, valores inválidos y fechas inválidas o ausentes", () => {
  test("leerImporte distingue ausente, válido e inválido", () => {
    expect(leerImporte(undefined).estado).toBe("ausente");
    expect(leerImporte(null).estado).toBe("ausente");
    expect(leerImporte("").estado).toBe("ausente");
    expect(leerImporte(NaN).estado).toBe("invalido");
    expect(leerImporte(Infinity).estado).toBe("invalido");
    expect(leerImporte("10,5").estado).toBe("invalido");
    expect(leerImporte("abc").estado).toBe("invalido");
    expect(leerImporte("12.5")).toEqual({ estado: "valido", valor: 12.5 });
  });

  test("montoBs NaN no se sustituye por monto ni se convierte en cifra", () => {
    const p = convertirPagoIngreso({ formaPago: "pago movil", montoBs: NaN, monto: 4000 }, { factorActual: 40 });
    expect(p).toMatchObject({ usd: null, importeOriginal: null });
    expect(p.incidencias).toContain(INCIDENCIA.IMPORTE_INVALIDO);
    expect(totalizarIngreso({ formasPago: [{ formaPago: "pago movil", montoBs: NaN }] }, { factorActual: 40 })).toMatchObject({ usd: 0, bs: 0 });
  });

  test("usdEquiv inválido se informa y se usa el siguiente dato histórico disponible", () => {
    const p = convertirPagoIngreso({ formaPago: "pago movil", montoBs: 4000, usdEquiv: NaN, factorConversion: 40 }, { factorActual: 45 });
    expect(p).toMatchObject({ usd: 100, origen: ORIGEN.HISTORICA });
    expect(p.incidencias).toContain(INCIDENCIA.CONVERSION_HISTORICA_INVALIDA);
  });

  test("egreso con importe inválido no suma", () => {
    const c = convertirEgreso({ montoUSD: NaN, montoBs: 0 }, { factorActual: 40 });
    expect(c.usd).toBeNull();
    expect(c.incidencias).toContain(INCIDENCIA.IMPORTE_INVALIDO);
  });

  test("fechas imposibles, texto y ausentes", () => {
    expect(leerFecha("31/02/2026").estado).toBe("invalida");
    expect(leerFecha("2026-13-01").estado).toBe("invalida");
    expect(leerFecha("ayer").estado).toBe("invalida");
    expect(leerFecha(undefined).estado).toBe("ausente");
    expect(leerFecha(null).estado).toBe("ausente");
    expect(leerFecha(5).estado).toBe("invalida");
    expect(fechaEgreso({ fecha: "31/02/2026" })).toEqual({ fecha: null, incidencia: INCIDENCIA.FECHA_INVALIDA });
    expect(fechaEgreso({})).toEqual({ fecha: null, incidencia: INCIDENCIA.FECHA_AUSENTE });
  });
});

describe("egresos en Bs sin tasa registrada: pendientes de conversión (no se estiman)", () => {
  test("no se usa el factor manual actual y queda una incidencia explícita", () => {
    const egreso = congelar({ tipo: "gastoDia", montoUSD: 0, montoBs: 3333, tasaFactura: null, monedaFactura: "Bs" });
    const c = convertirEgreso(egreso, { factorActual: 45 });
    expect(c).toMatchObject({ usd: null, bs: 3333, origen: ORIGEN.SIN_CONVERSION, pendienteConversion: true, importeBsOriginal: 3333 });
    expect(c.incidencias).toEqual([INCIDENCIA.EGRESO_BS_PENDIENTE_CONVERSION]);
  });

  test("con tasaFactura o tasa válida se convierte; con tasa inválida queda pendiente", () => {
    expect(convertirEgreso({ montoBs: 4000, tasaFactura: 40 })).toMatchObject({ usd: 100, pendienteConversion: false });
    expect(convertirEgreso({ divisa: "Bs", montoBs: 4000, tasa: "40" })).toMatchObject({ usd: 100, pendienteConversion: false });
    expect(convertirEgreso({ montoBs: 4000, tasaFactura: 0, tasa: NaN })).toMatchObject({ usd: null, pendienteConversion: true });
  });

  test("factura con importe solo en items en Bs y sin tasa también queda pendiente", () => {
    const c = convertirEgreso({ tipo: "factura", monedaFactura: "Bs", items: [{ cantidad: 2, precioUnitario: 500 }] });
    expect(c).toMatchObject({ usd: null, bs: 1000, pendienteConversion: true });
  });
});

describe("resumirCompletitud: total parcial frente a total completo", () => {
  test("sin exclusiones ni pendientes: completo", () => {
    expect(resumirCompletitud()).toMatchObject({ completo: true, incluyeEstimaciones: false, sinPeriodo: { total: 0 } });
  });

  test("ambiguos: mínimo en USD y Bs sin clasificar, nunca sumados entre sí", () => {
    const r = resumirCompletitud({ egresosAmbiguos: [{ importeUSDOriginal: 50, importeBsOriginal: 2000 }, { importeUSDOriginal: 10, importeBsOriginal: 400 }] });
    expect(r.ambiguos).toEqual({ cantidad: 2, minimoUSD: 60, bsSinClasificar: 2400 });
    expect(r).toMatchObject({ completo: false, areas: { egresos: false, ingresos: true, nomina: true, servicios: true } });
  });

  test("prorrateos, pendientes de conversión y sin período se separan por área", () => {
    const r = resumirCompletitud({
      nominasProrrateadas: [{ usd: 120, usdTotal: 300 }],
      ingresosPendientesConversion: { cantidad: 2, bs: 100 },
      egresosPendientesConversion: { cantidad: 1, bs: 50 },
      sinPeriodo: { servicios: 3 },
    });
    expect(r.prorrateos).toEqual({ cantidad: 1, usd: 120, usdTotal: 300 });
    expect(r.incluyeProrrateos).toBe(true);
    expect(r.pendientesConversion).toEqual({ ingresos: 2, egresos: 1, bs: 150, cantidad: 3 });
    expect(r.sinPeriodo).toEqual({ ingresos: 0, egresos: 0, nominas: 0, servicios: 3, total: 3 });
    // El prorrateo suma: no vuelve parcial la nómina
    expect(r.areas).toEqual({ ingresos: false, egresos: false, nomina: true, servicios: false });
  });

  test("las estimaciones no vuelven parcial el total, pero se señalan", () => {
    expect(resumirCompletitud({ usdEstimado: 25 })).toMatchObject({ completo: true, incluyeEstimaciones: true, usdEstimado: 25 });
  });
});
