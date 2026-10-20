"use strict";

/**
 * Herramienta: cuentas_por_cobrar
 * Servicios entregados que el cliente aún no ha pagado: la colección
 * cuentasPorCobrar solo contiene deudas pendientes (al cobrarse se borran y se
 * crea el ingreso, ver src/lib/cuentasPorCobrarFirebase.js).
 * Importe: `precio` (USD) del servicio; `precioBs` es el precio de referencia en
 * bolívares registrado y no se suma al de dólares.
 */
const { cargarReglasApp } = require("../reglasApp");
const { hoyCaracas } = require("./periodo");
const { r2, texto, diaCaracas, diferenciaDias } = require("./utilidades");

const NOMBRE = "cuentas_por_cobrar";
const MAX_LISTA = 50;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Cuentas por cobrar pendientes de Turbinas App: servicios entregados que los clientes aún no han pagado. Devuelve el total " +
    "adeudado en USD, el precio de referencia en bolívares, la antigüedad de las deudas y la lista de las más antiguas con cliente, " +
    "servicio, vehículo e importe. Úsala para preguntas sobre quién debe, cuánto nos deben o deudas atrasadas.",
  esquema: { type: "object", properties: {}, additionalProperties: false },
  datos: ["cuentasPorCobrar"],
  roles: ["owner", "admin"],
};

async function ejecutar(_argumentos, { fuente, ahora = () => new Date() }) {
  const { finanzas } = await cargarReglasApp();
  const { docs, truncado } = await fuente.leerCuentasPorCobrar();
  const hoy = hoyCaracas(ahora());

  let totalUSD = 0;
  let totalBs = 0;
  let sinPrecio = 0;
  const cuentas = docs.map((d) => {
    const usd = finanzas.leerImporte(d.precio);
    const bs = finanzas.leerImporte(d.precioBs);
    if (usd.estado === "valido") totalUSD += usd.valor;
    else sinPrecio += 1;
    if (bs.estado === "valido") totalBs += bs.valor;
    const registro = diaCaracas(Number(d.fechaRegistro) || Number(d.arrivalTime));
    return {
      cliente: texto(d.customerName || d.cliente) || "Sin nombre",
      servicio: texto(d.servicio, 60),
      vehiculo: texto(d.vehiculo, 60),
      placa: texto(d.placa, 15),
      precioUSD: usd.estado === "valido" ? r2(usd.valor) : null,
      precioBs: bs.estado === "valido" ? r2(bs.valor) : null,
      registradaEl: registro,
      diasPendiente: registro ? diferenciaDias(registro, hoy) : null,
    };
  });
  cuentas.sort((a, b) => (b.diasPendiente ?? -1) - (a.diasPendiente ?? -1));
  const conDias = cuentas.filter((c) => c.diasPendiente !== null);

  const notas = ["Importe adeudado según el precio en USD del servicio; el precio en Bs es referencia y no se suma."];
  if (sinPrecio > 0) notas.push(`${sinPrecio} cuenta(s) no tienen un precio en USD válido y no suman al total.`);
  if (cuentas.length > MAX_LISTA) notas.push(`Se listan las ${MAX_LISTA} más antiguas de ${cuentas.length}.`);
  if (truncado) notas.push("Lectura truncada: puede haber más cuentas de las mostradas.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): cuentasPorCobrar",
      consultadoEn: ahora().toISOString(),
      cantidad: cuentas.length,
      totalUSD: r2(totalUSD),
      precioReferenciaBs: r2(totalBs),
      masAntiguaDias: conDias.length ? conDias[0].diasPendiente : null,
      promedioDiasPendiente: conDias.length ? Math.round(conDias.reduce((a, c) => a + c.diasPendiente, 0) / conDias.length) : null,
      cuentas: cuentas.slice(0, MAX_LISTA),
      resumen: [
        { etiqueta: "Cuentas pendientes", valor: cuentas.length, tipo: "numero" },
        { etiqueta: "Total adeudado", valor: r2(totalUSD), tipo: "usd" },
        { etiqueta: "Más antigua (días)", valor: conDias.length ? conDias[0].diasPendiente : 0, tipo: "numero" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
