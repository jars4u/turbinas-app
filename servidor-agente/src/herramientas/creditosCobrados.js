"use strict";

/**
 * Herramienta: creditos_cobrados
 * Historial de créditos ya pagados: cuando se cobra una cuenta por cobrar, la app
 * crea un ingreso con `cuentaPorCobrarId`, la fecha de cobro (`fecha`) y la fecha
 * original del servicio (`fechaServicio`), y borra la cuenta (ver
 * cobrarCuentaPorCobrar en src/lib/cuentasPorCobrarFirebase.js).
 * Importes con la misma regla que Reportes (totalizarIngreso): conversión
 * registrada en el cobro o, si no la hay, estimación con el factor actual.
 * Lee: ingresosMovimientos, metodosPago y configuracion/factorConversion.
 */
const { cargarReglasApp } = require("../reglasApp");
const { PROPIEDADES_PERIODO, resolverPeriodo, limitesEnMs } = require("./periodo");
const { r2, texto, diferenciaDias, diaLocal, PROPIEDADES_CLIENTE, filtroCliente, crearIdentidadClientes } = require("./utilidades");
const { factorManual } = require("./resumenFinanciero");

const NOMBRE = "creditos_cobrados";
const MAX_LISTA = 50;
const MAX_CLIENTES = 30;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Historial de créditos YA COBRADOS (cuentas por cobrar que el cliente pagó) en un periodo de fechas de cobro (por defecto, el mes " +
    "actual hasta hoy): cliente, servicio, vehículo, fecha del servicio, fecha de pago, días que tardó en pagar e importe en USD, más " +
    "totales por cliente. Cada cliente se identifica por su teléfono (últimos 4 dígitos); homonimo: true indica clientes distintos con el mismo nombre. " +
    "Puede filtrar por nombre y/o teléfono del cliente. Úsala para preguntas como cuándo pagó un cliente, cuánto tardan en pagar, " +
    "cuánto se cobró de créditos o el historial de deudas de un cliente (para todo el historial usa desde 2020-01-01). " +
    "Para deudas aún pendientes usa cuentas_por_cobrar.",
  esquema: {
    type: "object",
    properties: {
      ...PROPIEDADES_PERIODO,
      ...PROPIEDADES_CLIENTE,
    },
    additionalProperties: false,
  },
  datos: ["ingresosMovimientos (cobros de cuentas por cobrar)", "metodosPago", "configuracion/factorConversion"],
  roles: ["owner", "admin"],
};

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { periodo, error } = resolverPeriodo(argumentos, ahora());
  if (error) return { error };
  const filtro = filtroCliente(argumentos);
  const { finanzas, metodos } = await cargarReglasApp();
  const [ingresos, metodosPago, config] = await Promise.all([fuente.leerIngresos(), fuente.leerMetodosPago(), fuente.leerConfigFactor()]);
  if (metodosPago.docs.length > 0) metodos.setMetodosPagoCache(metodosPago.docs);
  const factorActual = finanzas.factorParaEstimacion(factorManual(config));
  const { inicioMs, finMs } = limitesEnMs(periodo);
  const creditos = ingresos.docs.filter((i) => i && i.cuentaPorCobrarId);
  const identidad = crearIdentidadClientes(creditos.map((i) => ({ nombre: i.customerName || i.cliente, telefono: i.customerPhone })));

  const cobros = [];
  let estimadoUSD = 0;
  let sinFecha = 0;
  for (const ingreso of creditos) {
    const cliente = texto(ingreso.customerName || ingreso.cliente) || "Sin nombre";
    if (filtro && !filtro.coincide(cliente, ingreso.customerPhone)) continue;
    const clave = identidad.clave(cliente, ingreso.customerPhone);
    const { fecha } = finanzas.fechaIngreso(ingreso);
    if (!fecha) {
      sinFecha += 1;
      continue;
    }
    if (fecha.getTime() < inicioMs || fecha.getTime() > finMs) continue;
    const t = finanzas.totalizarIngreso(ingreso, { factorActual });
    estimadoUSD += t.usdEstimado;
    const fechaCobro = diaLocal(fecha);
    const servicio = finanzas.leerFecha(ingreso.fechaServicio).fecha;
    const fechaServicio = servicio ? diaLocal(servicio) : null;
    cobros.push({
      clave,
      cliente,
      telefono: identidad.telefono(clave),
      servicio: texto(ingreso.servicio, 60),
      vehiculo: texto(ingreso.vehiculo, 60),
      fechaServicio,
      fechaCobro,
      diasHastaCobro: fechaServicio ? diferenciaDias(fechaServicio, fechaCobro) : null,
      totalUSD: r2(t.usd),
      incluyeEstimacion: t.usdEstimado > 0,
    });
  }
  cobros.sort((a, b) => b.fechaCobro.localeCompare(a.fechaCobro));

  const conDias = cobros.filter((c) => c.diasHastaCobro !== null);
  const promedioDias = conDias.length ? Math.round(conDias.reduce((a, c) => a + c.diasHastaCobro, 0) / conDias.length) : null;
  const totalUSD = r2(cobros.reduce((a, c) => a + c.totalUSD, 0));

  const clientes = new Map();
  for (const c of cobros) {
    const { clave } = c;
    const fila = clientes.get(clave) || { cliente: c.cliente, telefono: c.telefono, homonimo: identidad.homonimo(clave), creditos: 0, totalUSD: 0, ultimoPago: null, dias: [] };
    fila.creditos += 1;
    fila.totalUSD += c.totalUSD;
    if (!fila.ultimoPago || c.fechaCobro > fila.ultimoPago) fila.ultimoPago = c.fechaCobro;
    if (c.diasHastaCobro !== null) fila.dias.push(c.diasHastaCobro);
    clientes.set(clave, fila);
  }
  const porCliente = [...clientes.values()]
    .map(({ dias, ...f }) => ({ ...f, totalUSD: r2(f.totalUSD), promedioDiasHastaCobro: dias.length ? Math.round(dias.reduce((a, d) => a + d, 0) / dias.length) : null }))
    .sort((a, b) => b.totalUSD - a.totalUSD);

  const notas = [
    "Solo incluye créditos registrados como cuenta por cobrar y cobrados desde la app; los servicios pagados en el momento no aparecen aquí.",
  ];
  if (filtro && cobros.length === 0) notas.push(`Ningún crédito cobrado en el periodo coincide con «${filtro.texto}».`);
  if (porCliente.some((c) => c.homonimo)) notas.push("Hay clientes distintos con el mismo nombre (homonimo): se distinguen por los últimos 4 dígitos del teléfono.");
  if (estimadoUSD > 0) notas.push(`${r2(estimadoUSD).toFixed(2)} USD son una estimación con el factor actual (${factorActual} Bs por USD): esos cobros en bolívares no guardaron su conversión.`);
  if (cobros.length > conDias.length) notas.push(`${cobros.length - conDias.length} cobro(s) no guardaron la fecha del servicio: no se sabe cuánto tardaron en pagarse.`);
  if (sinFecha > 0) notas.push(`${sinFecha} cobro(s) de créditos no tienen fecha válida y no se asignan a ningún periodo.`);
  if (cobros.length > MAX_LISTA) notas.push(`Se listan los ${MAX_LISTA} cobros más recientes de ${cobros.length}.`);
  if (ingresos.truncado) notas.push("Lectura truncada: los totales pueden estar incompletos.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): ingresosMovimientos con cuenta por cobrar",
      consultadoEn: ahora().toISOString(),
      periodo,
      filtro: filtro ? filtro.descripcion : null,
      totalesCompletos: sinFecha === 0 && !ingresos.truncado,
      cantidad: cobros.length,
      totalUSD,
      promedioDiasHastaCobro: promedioDias,
      porCliente: porCliente.slice(0, MAX_CLIENTES),
      cobros: cobros.slice(0, MAX_LISTA).map(({ clave, ...c }) => c),
      resumen: [
        { etiqueta: "Créditos cobrados", valor: cobros.length, tipo: "numero" },
        { etiqueta: "Total cobrado", valor: totalUSD, tipo: "usd" },
        ...(promedioDias !== null ? [{ etiqueta: "Días promedio hasta el pago", valor: promedioDias, tipo: "numero" }] : []),
        ...porCliente.slice(0, 5).map((c) => ({ etiqueta: `· ${c.cliente}${c.homonimo && c.telefono ? ` (tel. ${c.telefono})` : ""}`, valor: c.totalUSD, tipo: "usd" })),
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
