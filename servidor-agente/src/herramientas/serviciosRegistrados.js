"use strict";

/**
 * Herramienta: servicios_del_periodo
 * Servicios (vehículos) que llegaron al taller en un periodo (arrivalTime) y los
 * entregados en ese periodo (fechaEntrega), con el criterio único de entrega de
 * la app (crearCriterioEntrega: estados finales configurados y equivalentes).
 * El `precio` es el precio del servicio, no un cobro: los cobros están en
 * resumen_financiero.
 */
const { cargarReglasApp } = require("../reglasApp");
const { PROPIEDADES_PERIODO, resolverPeriodo, limitesEnMs } = require("./periodo");
const { r2, texto, top, crearIdentidadClientes } = require("./utilidades");

const NOMBRE = "servicios_del_periodo";

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Servicios de Turbinas App en un periodo (por defecto, el mes actual hasta hoy, hora de Venezuela): cuántos vehículos llegaron " +
    "al taller, qué servicios fueron los más frecuentes, sus estados actuales, los clientes con más servicios y cuántos se " +
    "entregaron en el periodo. Úsala para preguntas sobre volumen de trabajo, servicios más solicitados o entregas. Los precios " +
    "son de referencia: para dinero cobrado usa resumen_financiero.",
  esquema: { type: "object", properties: PROPIEDADES_PERIODO, additionalProperties: false },
  datos: ["vehiculos (campos de servicio, cliente, estado, precio y fechas)", "estadosServicio"],
  roles: ["owner", "admin"],
};

function contar(mapa, clave, extra = {}) {
  const fila = mapa.get(clave) || { nombre: clave, cantidad: 0, ...Object.fromEntries(Object.keys(extra).map((k) => [k, 0])) };
  fila.cantidad += 1;
  for (const [k, v] of Object.entries(extra)) fila[k] += v;
  mapa.set(clave, fila);
}

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { periodo, error } = resolverPeriodo(argumentos, ahora());
  if (error) return { error };
  const { finanzas } = await cargarReglasApp();
  const { inicioMs, finMs } = limitesEnMs(periodo);
  const [registrados, entregadosLectura, estados] = await Promise.all([
    fuente.leerVehiculosRegistrados(inicioMs, finMs),
    fuente.leerVehiculosEntregados(inicioMs, finMs),
    fuente.leerEstadosServicio(),
  ]);
  const criterio = finanzas.crearCriterioEntrega(estados);

  const porServicio = new Map();
  const porEstado = new Map();
  const porCliente = new Map();
  // Clientes identificados por teléfono: dos clientes con el mismo nombre son distintos
  const identidad = crearIdentidadClientes(registrados.docs.map((v) => ({ nombre: v.customerName, telefono: v.customerPhone })));
  let precioReferencia = 0;
  for (const v of registrados.docs) {
    const precio = finanzas.leerImporte(v.precio);
    const usd = precio.estado === "valido" ? precio.valor : 0;
    precioReferencia += usd;
    contar(porServicio, (texto(v.servicio, 60) || "SIN SERVICIO").toUpperCase(), { precioUSD: usd });
    contar(porEstado, texto(v.status || v.estado, 40) || "sin estado");
    const cliente = texto(v.customerName);
    if (cliente) {
      const clave = identidad.clave(cliente, v.customerPhone);
      const fila = porCliente.get(clave) || { nombre: cliente.toUpperCase(), telefono: identidad.telefono(clave), homonimo: identidad.homonimo(clave), cantidad: 0 };
      fila.cantidad += 1;
      porCliente.set(clave, fila);
    }
  }

  const entregados = entregadosLectura.docs.filter((v) => criterio.esEntregado(v));
  const entregadosPorServicio = new Map();
  for (const v of entregados) contar(entregadosPorServicio, (texto(v.servicio, 60) || "SIN SERVICIO").toUpperCase());

  const notas = ["Los precios son de referencia del servicio, no cobros. Para dinero cobrado se usa resumen_financiero."];
  if (registrados.truncado || entregadosLectura.truncado) notas.push("Lectura truncada: los conteos pueden estar incompletos.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): vehiculos y estadosServicio",
      consultadoEn: ahora().toISOString(),
      periodo,
      registrados: {
        cantidad: registrados.docs.length,
        precioReferenciaUSD: r2(precioReferencia),
        porServicio: top(porServicio, "cantidad").map((f) => ({ servicio: f.nombre, cantidad: f.cantidad, precioReferenciaUSD: r2(f.precioUSD) })),
        porEstadoActual: top(porEstado, "cantidad", 15).map((f) => ({ estado: f.nombre, cantidad: f.cantidad })),
        principalesClientes: top(porCliente, "cantidad").map((f) => ({ cliente: f.nombre, telefono: f.telefono, homonimo: f.homonimo, servicios: f.cantidad })),
      },
      entregados: {
        cantidad: entregados.length,
        porServicio: top(entregadosPorServicio, "cantidad").map((f) => ({ servicio: f.nombre, cantidad: f.cantidad })),
      },
      resumen: [
        { etiqueta: "Servicios recibidos", valor: registrados.docs.length, tipo: "numero" },
        { etiqueta: "Servicios entregados", valor: entregados.length, tipo: "numero" },
        { etiqueta: "Precio de referencia (recibidos)", valor: r2(precioReferencia), tipo: "usd" },
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
