"use strict";

/**
 * Herramienta: cuentas_por_pagar
 * Facturas de proveedores pendientes de pago (colección cuentasPorPagar; al
 * pagarse se borran y se registran como egreso, ver CuentasPorPagar.js).
 * La conversión a USD usa la regla de egresos de la app (convertirEgreso): solo
 * con la tasa registrada en la factura; sin ella queda pendiente de conversión.
 */
const { cargarReglasApp } = require("../reglasApp");
const { hoyCaracas } = require("./periodo");
const { r2, texto, diferenciaDias } = require("./utilidades");

const NOMBRE = "cuentas_por_pagar";
const MAX_LISTA = 50;
const DIAS_PROXIMOS = 7;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Cuentas por pagar pendientes de Turbinas App (facturas de proveedores sin pagar): total en USD, facturas vencidas, las que " +
    "vencen en los próximos 7 días y la lista ordenada por vencimiento con proveedor, documento e importe. Úsala para preguntas " +
    "sobre deudas con proveedores, pagos pendientes o vencimientos.",
  esquema: { type: "object", properties: {}, additionalProperties: false },
  datos: ["cuentasPorPagar"],
  roles: ["owner", "admin"],
};

async function ejecutar(_argumentos, { fuente, ahora = () => new Date() }) {
  const { finanzas } = await cargarReglasApp();
  const { docs, truncado } = await fuente.leerCuentasPorPagar();
  const hoy = hoyCaracas(ahora());

  const facturas = docs.map((d) => {
    const c = finanzas.convertirEgreso(d);
    const venc = finanzas.leerFecha(d.vencimiento);
    const vencimiento = venc.fecha
      ? `${venc.fecha.getFullYear()}-${String(venc.fecha.getMonth() + 1).padStart(2, "0")}-${String(venc.fecha.getDate()).padStart(2, "0")}`
      : null;
    return {
      proveedor: texto(d.proveedor) || "Sin proveedor",
      documento: texto(d.documento, 40),
      concepto: texto(d.concepto || d.descripcion, 80),
      usd: c.ambiguo ? null : c.usd === null ? null : r2(c.usd),
      bs: c.bs ? r2(c.bs) : null,
      pendienteConversion: c.pendienteConversion,
      ambiguo: c.ambiguo,
      importeUSDRegistrado: c.ambiguo ? r2(c.importeUSDOriginal) : undefined,
      vencimiento,
      diasParaVencer: vencimiento ? diferenciaDias(hoy, vencimiento) : null,
    };
  });
  facturas.sort((a, b) => (a.vencimiento || "9999").localeCompare(b.vencimiento || "9999"));

  const suma = (lista) => r2(lista.reduce((acc, f) => acc + (f.usd || 0), 0));
  const vencidas = facturas.filter((f) => f.diasParaVencer !== null && f.diasParaVencer < 0);
  const proximas = facturas.filter((f) => f.diasParaVencer !== null && f.diasParaVencer >= 0 && f.diasParaVencer <= DIAS_PROXIMOS);
  const pendientes = facturas.filter((f) => f.pendienteConversion);
  const ambiguas = facturas.filter((f) => f.ambiguo);

  const notas = [];
  if (pendientes.length) {
    notas.push(`${pendientes.length} factura(s) en bolívares (${r2(pendientes.reduce((a, f) => a + (f.bs || 0), 0))} Bs) no tienen tasa registrada y no suman en USD.`);
  }
  if (ambiguas.length) notas.push(`${ambiguas.length} factura(s) tienen importe en USD y en Bs a la vez y no se suman (no se sabe si son el mismo importe).`);
  const sinVencimiento = facturas.filter((f) => !f.vencimiento).length;
  if (sinVencimiento) notas.push(`${sinVencimiento} factura(s) no tienen fecha de vencimiento válida.`);
  if (facturas.length > MAX_LISTA) notas.push(`Se listan las ${MAX_LISTA} con vencimiento más cercano de ${facturas.length}.`);
  if (truncado) notas.push("Lectura truncada: puede haber más facturas de las mostradas.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): cuentasPorPagar",
      consultadoEn: ahora().toISOString(),
      cantidad: facturas.length,
      totalUSD: suma(facturas),
      vencidas: { cantidad: vencidas.length, usd: suma(vencidas) },
      vencenProximos7Dias: { cantidad: proximas.length, usd: suma(proximas) },
      facturas: facturas.slice(0, MAX_LISTA),
      resumen: [
        { etiqueta: "Facturas pendientes", valor: facturas.length, tipo: "numero" },
        { etiqueta: "Total por pagar", valor: suma(facturas), tipo: "usd" },
        { etiqueta: "Vencidas", valor: suma(vencidas), tipo: "usd" },
        { etiqueta: "Vencen en 7 días", valor: suma(proximas), tipo: "usd" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
