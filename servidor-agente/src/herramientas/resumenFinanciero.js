"use strict";

/**
 * Herramienta: resumen_financiero
 *
 * Calcula con las MISMAS reglas que la pantalla de Reportes (buildReportData de
 * src/lib/reportesUtils.js y src/lib/finanzas.js), sin reimplementarlas:
 *   - Ingresos: cobros registrados en ingresosMovimientos. Cada pago en Bs usa la
 *     conversión guardada en el cobro; si no la tiene, se estima con el factor
 *     manual actual (decisión de negocio) y se informa aparte.
 *   - Egresos por categoría (facturas, gastos del día, caja chica, otros); los Bs
 *     sin tasa registrada quedan pendientes y los ambiguos se excluyen.
 *   - Nómina atribuible al periodo y neto.
 * Lee: ingresosMovimientos, egresos, nominas, metodosPago y configuracion/factorConversion.
 * No incluye anulaciones ni reembolsos: la app no los registra.
 */
const { PROPIEDADES_PERIODO, resolverPeriodo } = require("./periodo");
const { cargarReglasApp } = require("../reglasApp");
const { r2, texto, top } = require("./utilidades");

const NOMBRE = "resumen_financiero";

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Resumen financiero de Turbinas App para un periodo (por defecto, del día 1 del mes actual hasta hoy, hora de Venezuela), " +
    "calculado con las mismas reglas que la pantalla de Reportes: ingresos cobrados en USD (separando cobros en dólares, " +
    "conversiones registradas desde bolívares y estimaciones con el factor actual), ingresos por método de pago, principales " +
    "clientes, egresos por categoría, nómina y neto. Úsala para preguntas sobre dinero que entró o salió, ventas, gastos, " +
    "utilidad o lo que pagó un cliente en un periodo.",
  esquema: { type: "object", properties: PROPIEDADES_PERIODO, additionalProperties: false },
  datos: ["ingresosMovimientos", "egresos", "nominas", "metodosPago", "configuracion/factorConversion"],
  roles: ["owner", "admin"],
};

function factorManual(config) {
  if (!config) return null;
  const manual = Number(config.valorManual);
  if (manual > 0) return { valorManual: manual };
  const valor = Number(config.valor);
  return valor > 0 ? { valorManual: valor } : null;
}

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { periodo, error } = resolverPeriodo(argumentos, ahora());
  if (error) return { error };

  const { finanzas, reportes, metodos } = await cargarReglasApp();
  const [ingresos, egresos, nominas, metodosPago, config] = await Promise.all([
    fuente.leerIngresos(),
    fuente.leerEgresos(),
    fuente.leerNominas(),
    fuente.leerMetodosPago(),
    fuente.leerConfigFactor(),
  ]);
  // La moneda de cada método sale de la configuración, igual que en la app
  if (metodosPago.docs.length > 0) metodos.setMetodosPagoCache(metodosPago.docs);
  const factorActual = finanzas.factorParaEstimacion(factorManual(config));

  const reporte = reportes.buildReportData({
    ingresos: ingresos.docs,
    egresos: egresos.docs,
    nominas: nominas.docs,
    vehiculos: [],
    estadosServicio: [],
    factorActual,
    fechaInicio: periodo.desde,
    fechaFin: periodo.hasta,
    presetKey: "custom",
  });
  const s = reporte.summary;

  // Desglose por método de pago y por cliente, con la misma conversión por pago
  const porMetodo = new Map();
  const clientes = new Map();
  for (const item of reporte.detail.ingresos) {
    const t = finanzas.totalizarIngreso(item.raw, { factorActual });
    for (const pago of t.pagos) {
      const clave = pago.metodo || "sin_metodo";
      const fila = porMetodo.get(clave) || { metodo: pago.metodo ? metodos.nombreMetodo(pago.metodo) : "Sin método", moneda: pago.moneda, usd: 0, bs: 0, pagos: 0 };
      fila.usd += pago.usd || 0;
      if (pago.moneda === "BS") fila.bs += pago.importeOriginal || 0;
      fila.pagos += 1;
      porMetodo.set(clave, fila);
    }
    const cliente = texto(item.raw.customerName || item.raw.cliente);
    if (cliente) {
      const clave = cliente.toUpperCase();
      const fila = clientes.get(clave) || { cliente: clave, usd: 0, cobros: 0 };
      fila.usd += item.totalUSD;
      fila.cobros += 1;
      clientes.set(clave, fila);
    }
  }

  const usdConversionRegistrada = s.ingresosUSDFromBs - s.ingresosUSDEstimado;
  const c = s.completitud;
  const notas = [
    "Ingresos = cobros registrados en Turbinas App. No incluye anulaciones ni reembolsos (la app no los registra; un cobro eliminado no aparece).",
    "El neto no incluye cuentas por cobrar ni por pagar pendientes.",
  ];
  if (s.ingresosUSDEstimado > 0) {
    notas.push(
      `${s.calidad.ingresosConEstimacion} cobro(s) en bolívares no guardaron su conversión: se estimaron ${r2(s.ingresosUSDEstimado)} USD con el factor actual de la app (${factorActual} Bs por USD). Es una estimación.`
    );
  }
  if (s.calidad.ingresosConBsSinConversion > 0) {
    notas.push(`${s.calidad.ingresosConBsSinConversion} cobro(s) en bolívares (${r2(s.calidad.ingresosBsSinConversion)} Bs) no se pudieron convertir porque no hay factor actual configurado.`);
  }
  if (c.ambiguos.cantidad > 0) {
    notas.push(`${c.ambiguos.cantidad} egreso(s) tienen importe en USD y en Bs a la vez y no se suman: al menos ${r2(c.ambiguos.minimoUSD)} USD y ${r2(c.ambiguos.bsSinClasificar)} Bs sin clasificar.`);
  }
  if (c.pendientesConversion.egresos > 0) notas.push(`${c.pendientesConversion.egresos} egreso(s) en bolívares no tienen tasa registrada y no suman en USD.`);
  if (c.pendientesCriterio.cantidad > 0) {
    notas.push(`${c.pendientesCriterio.cantidad} nómina(s) por ${r2(c.pendientesCriterio.usd)} USD cruzan un cambio de mes o el límite del periodo y no se suman (criterio pendiente de decisión).`);
  }
  if (c.sinPeriodo.ingresos + c.sinPeriodo.egresos + c.sinPeriodo.nominas > 0) {
    notas.push(`${c.sinPeriodo.ingresos + c.sinPeriodo.egresos + c.sinPeriodo.nominas} registro(s) sin fecha válida no se pueden asignar a ningún periodo.`);
  }
  if (metodosPago.docs.length === 0) notas.push("No se encontró la configuración de métodos de pago: se usó la moneda predeterminada de cada método.");
  const truncadas = [["ingresos", ingresos], ["egresos", egresos], ["nóminas", nominas]].filter(([, l]) => l.truncado).map(([n]) => n);
  if (truncadas.length) notas.push(`Lectura truncada en: ${truncadas.join(", ")}. Los totales pueden estar incompletos.`);

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore), con las reglas de la pantalla de Reportes",
      consultadoEn: ahora().toISOString(),
      periodo,
      totalesCompletos: c.completo && truncadas.length === 0,
      ingresos: {
        totalUSD: r2(s.ingresosUSD),
        cobradosEnDolaresUSD: r2(s.ingresosUSDDirect),
        desdeBolivaresConConversionRegistradaUSD: r2(usdConversionRegistrada),
        estimadosConFactorActualUSD: r2(s.ingresosUSDEstimado),
        factorActual: factorActual,
        bolivaresCobrados: r2(s.ingresosBs),
        cobros: reporte.detail.ingresos.length,
        porMetodo: [...porMetodo.values()].map((f) => ({ ...f, usd: r2(f.usd), bs: r2(f.bs) })).sort((a, b) => b.usd - a.usd),
        principalesClientes: top(clientes, "usd").map((f) => ({ ...f, usd: r2(f.usd) })),
      },
      egresos: {
        totalUSD: r2(s.egresosUSD),
        porCategoria: Object.fromEntries(Object.entries(s.egresosPorCategoria).filter(([k]) => k !== "nomina").map(([k, v]) => [k, { ...v, usd: r2(v.usd), bs: r2(v.bs) }])),
        bolivares: r2(s.egresosBs),
      },
      nominaUSD: r2(s.nominaUSD),
      netoUSD: r2(s.netoUSD),
      resumen: [
        { etiqueta: "Ingresos", valor: r2(s.ingresosUSD), tipo: "usd" },
        { etiqueta: "· cobrados en dólares", valor: r2(s.ingresosUSDDirect), tipo: "usd" },
        { etiqueta: "· desde bolívares (conversión registrada)", valor: r2(usdConversionRegistrada), tipo: "usd" },
        { etiqueta: "· estimados con factor actual", valor: r2(s.ingresosUSDEstimado), tipo: "usd" },
        { etiqueta: "Egresos", valor: r2(s.egresosUSD), tipo: "usd" },
        { etiqueta: "Nómina", valor: r2(s.nominaUSD), tipo: "usd" },
        { etiqueta: "Neto", valor: r2(s.netoUSD), tipo: "usd" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
