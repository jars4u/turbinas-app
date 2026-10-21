"use strict";

/**
 * Herramienta: cuentas_por_cobrar
 * Servicios entregados que el cliente aún no ha pagado (créditos pendientes): la
 * colección cuentasPorCobrar solo contiene deudas pendientes (al cobrarse se
 * borran y se crea el ingreso, ver src/lib/cuentasPorCobrarFirebase.js). Los
 * créditos ya cobrados están en la herramienta creditos_cobrados.
 * Importe: `precio` (USD) del servicio; `precioBs` es el precio de referencia en
 * bolívares registrado y no se suma al de dólares.
 */
const { cargarReglasApp } = require("../reglasApp");
const { hoyCaracas } = require("./periodo");
const { r2, texto, diaCaracas, diferenciaDias, PROPIEDADES_CLIENTE, filtroCliente, crearIdentidadClientes } = require("./utilidades");

const NOMBRE = "cuentas_por_cobrar";
const MAX_LISTA = 50;
const MAX_CLIENTES = 30;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Cuentas por cobrar PENDIENTES de Turbinas App (créditos: servicios entregados que los clientes aún no han pagado). Devuelve el " +
    "total adeudado en USD, la deuda agrupada por cliente (cuántos servicios, cuánto y desde cuándo) y la lista de deudas con cliente, " +
    "servicio, vehículo, placa, fecha del servicio, días pendiente e importe. Cada cliente se identifica por su teléfono (se muestran los últimos 4 dígitos): " +
    "homonimo: true indica clientes distintos con el mismo nombre. Puede filtrar por nombre y/o teléfono del cliente y ordenar por antigüedad o monto. " +
    "Úsala para preguntas sobre quién debe, cuánto debe un cliente, desde cuándo o deudas atrasadas. Para créditos ya pagados usa creditos_cobrados.",
  esquema: {
    type: "object",
    properties: {
      ...PROPIEDADES_CLIENTE,
      ordenarPor: { type: "string", enum: ["antiguedad", "monto"], description: "Orden de la lista: antiguedad (por defecto, las más antiguas primero) o monto (mayor primero)." },
    },
    additionalProperties: false,
  },
  datos: ["cuentasPorCobrar"],
  roles: ["owner", "admin"],
};

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { finanzas } = await cargarReglasApp();
  const { docs, truncado } = await fuente.leerCuentasPorCobrar();
  const hoy = hoyCaracas(ahora());
  const filtro = filtroCliente(argumentos);
  const identidad = crearIdentidadClientes(docs.map((d) => ({ nombre: d.customerName || d.cliente, telefono: d.customerPhone })));

  let totalUSD = 0;
  let totalBs = 0;
  let sinPrecio = 0;
  const cuentas = [];
  for (const d of docs) {
    const cliente = texto(d.customerName || d.cliente) || "Sin nombre";
    if (filtro && !filtro.coincide(cliente, d.customerPhone)) continue;
    const clave = identidad.clave(cliente, d.customerPhone);
    const usd = finanzas.leerImporte(d.precio);
    const bs = finanzas.leerImporte(d.precioBs);
    if (usd.estado === "valido") totalUSD += usd.valor;
    else sinPrecio += 1;
    if (bs.estado === "valido") totalBs += bs.valor;
    const registro = diaCaracas(Number(d.fechaRegistro) || Number(d.arrivalTime));
    cuentas.push({
      clave,
      cliente,
      telefono: identidad.telefono(clave),
      servicio: texto(d.servicio, 60),
      vehiculo: texto(d.vehiculo, 60),
      placa: texto(d.placa, 15),
      precioUSD: usd.estado === "valido" ? r2(usd.valor) : null,
      precioBs: bs.estado === "valido" ? r2(bs.valor) : null,
      registradaEl: registro,
      diasPendiente: registro ? diferenciaDias(registro, hoy) : null,
    });
  }
  if (argumentos.ordenarPor === "monto") cuentas.sort((a, b) => (b.precioUSD ?? -1) - (a.precioUSD ?? -1));
  else cuentas.sort((a, b) => (b.diasPendiente ?? -1) - (a.diasPendiente ?? -1));
  const conDias = cuentas.filter((c) => c.diasPendiente !== null);
  const masAntigua = conDias.reduce((max, c) => Math.max(max, c.diasPendiente), -1);

  // Deuda por cliente (identificado por teléfono)
  const clientes = new Map();
  for (const c of cuentas) {
    const { clave } = c;
    const fila = clientes.get(clave) || { cliente: c.cliente, telefono: c.telefono, homonimo: identidad.homonimo(clave), servicios: 0, totalUSD: 0, deudaMasAntiguaDias: null, desde: null };
    fila.servicios += 1;
    fila.totalUSD += c.precioUSD || 0;
    if (c.diasPendiente !== null && (fila.deudaMasAntiguaDias === null || c.diasPendiente > fila.deudaMasAntiguaDias)) {
      fila.deudaMasAntiguaDias = c.diasPendiente;
      fila.desde = c.registradaEl;
    }
    clientes.set(clave, fila);
  }
  const porCliente = [...clientes.values()].map((f) => ({ ...f, totalUSD: r2(f.totalUSD) })).sort((a, b) => b.totalUSD - a.totalUSD);

  const notas = ["Importe adeudado según el precio en USD del servicio; el precio en Bs es referencia y no se suma."];
  if (filtro && cuentas.length === 0) notas.push(`Ningún cliente con deuda pendiente coincide con «${filtro.texto}»: no tiene cuentas por cobrar (o el nombre o teléfono está escrito distinto).`);
  if (porCliente.some((c) => c.homonimo)) notas.push("Hay clientes distintos con el mismo nombre (homonimo): se distinguen por los últimos 4 dígitos del teléfono.");
  if (sinPrecio > 0) notas.push(`${sinPrecio} cuenta(s) no tienen un precio en USD válido y no suman al total.`);
  if (cuentas.length > MAX_LISTA) notas.push(`Se listan ${MAX_LISTA} de ${cuentas.length} cuentas.`);
  if (porCliente.length > MAX_CLIENTES) notas.push(`Se listan los ${MAX_CLIENTES} clientes con más deuda de ${porCliente.length}.`);
  if (truncado) notas.push("Lectura truncada: puede haber más cuentas de las mostradas.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): cuentasPorCobrar",
      consultadoEn: ahora().toISOString(),
      filtro: filtro ? filtro.descripcion : null,
      cantidad: cuentas.length,
      clientesConDeuda: porCliente.length,
      totalUSD: r2(totalUSD),
      precioReferenciaBs: r2(totalBs),
      masAntiguaDias: masAntigua >= 0 ? masAntigua : null,
      promedioDiasPendiente: conDias.length ? Math.round(conDias.reduce((a, c) => a + c.diasPendiente, 0) / conDias.length) : null,
      porCliente: porCliente.slice(0, MAX_CLIENTES),
      cuentas: cuentas.slice(0, MAX_LISTA).map(({ clave, ...c }) => c),
      resumen: [
        { etiqueta: "Cuentas pendientes", valor: cuentas.length, tipo: "numero" },
        { etiqueta: "Total adeudado", valor: r2(totalUSD), tipo: "usd" },
        ...porCliente.slice(0, 5).map((c) => ({ etiqueta: `· ${c.cliente}${c.homonimo && c.telefono ? ` (tel. ${c.telefono})` : ""}`, valor: c.totalUSD, tipo: "usd" })),
        { etiqueta: "Más antigua (días)", valor: masAntigua >= 0 ? masAntigua : 0, tipo: "numero" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
