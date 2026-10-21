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
const { r2, texto, diferenciaDias, coincideNombre, normalizar } = require("./utilidades");

const NOMBRE = "cuentas_por_pagar";
const MAX_LISTA = 50;
const DIAS_PROXIMOS = 7;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Cuentas por pagar pendientes de Turbinas App (facturas de proveedores sin pagar): total en USD, facturas vencidas, las que " +
    "vencen en los próximos días (7 por defecto), la deuda agrupada por proveedor y la lista ordenada por vencimiento con proveedor, " +
    "documento, concepto, fecha de vencimiento e importe. Puede filtrar por proveedor. Úsala para preguntas sobre deudas con " +
    "proveedores, cuánto se le debe a un proveedor, pagos pendientes o vencimientos. Las facturas ya pagadas son egresos (resumen_financiero).",
  esquema: {
    type: "object",
    properties: {
      proveedor: { type: "string", maxLength: 60, description: "Nombre o parte del nombre del proveedor para filtrar (no distingue acentos ni mayúsculas)." },
      diasProximos: { type: "integer", minimum: 1, maximum: 365, description: "Ventana de 'vencen pronto' en días desde hoy. Por defecto, 7." },
    },
    additionalProperties: false,
  },
  datos: ["cuentasPorPagar"],
  roles: ["owner", "admin"],
};

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { finanzas } = await cargarReglasApp();
  const { docs: todas, truncado } = await fuente.leerCuentasPorPagar();
  const hoy = hoyCaracas(ahora());
  const busqueda = texto(argumentos.proveedor, 60);
  const diasProximos = argumentos.diasProximos || DIAS_PROXIMOS;
  const docs = busqueda ? todas.filter((d) => coincideNombre(texto(d.proveedor) || "", busqueda)) : todas;

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
  const proximas = facturas.filter((f) => f.diasParaVencer !== null && f.diasParaVencer >= 0 && f.diasParaVencer <= diasProximos);
  const pendientes = facturas.filter((f) => f.pendienteConversion);
  const ambiguas = facturas.filter((f) => f.ambiguo);

  const proveedores = new Map();
  for (const f of facturas) {
    const clave = normalizar(f.proveedor);
    const fila = proveedores.get(clave) || { proveedor: f.proveedor, facturas: 0, totalUSD: 0, vencidas: 0, proximoVencimiento: null };
    fila.facturas += 1;
    fila.totalUSD += f.usd || 0;
    if (f.diasParaVencer !== null && f.diasParaVencer < 0) fila.vencidas += 1;
    if (f.vencimiento && f.diasParaVencer >= 0 && (!fila.proximoVencimiento || f.vencimiento < fila.proximoVencimiento)) fila.proximoVencimiento = f.vencimiento;
    proveedores.set(clave, fila);
  }
  const porProveedor = [...proveedores.values()].map((p) => ({ ...p, totalUSD: r2(p.totalUSD) })).sort((a, b) => b.totalUSD - a.totalUSD);

  const notas = [];
  if (busqueda && facturas.length === 0) notas.push(`Ningún proveedor con facturas pendientes coincide con «${busqueda}».`);
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
      filtro: busqueda ? { proveedor: busqueda } : null,
      cantidad: facturas.length,
      totalUSD: suma(facturas),
      vencidas: { cantidad: vencidas.length, usd: suma(vencidas) },
      vencenPronto: { dias: diasProximos, cantidad: proximas.length, usd: suma(proximas) },
      porProveedor: porProveedor.slice(0, MAX_LISTA),
      facturas: facturas.slice(0, MAX_LISTA),
      resumen: [
        { etiqueta: "Facturas pendientes", valor: facturas.length, tipo: "numero" },
        { etiqueta: "Total por pagar", valor: suma(facturas), tipo: "usd" },
        { etiqueta: "Vencidas", valor: suma(vencidas), tipo: "usd" },
        { etiqueta: `Vencen en ${diasProximos} días`, valor: suma(proximas), tipo: "usd" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
