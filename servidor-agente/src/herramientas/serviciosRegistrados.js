"use strict";

/**
 * Herramienta: servicios_del_periodo
 * Servicios (vehículos) que llegaron al taller en un periodo (arrivalTime) y los
 * entregados en ese periodo (fechaEntrega), con el criterio único de entrega de
 * la app (crearCriterioEntrega: estados finales configurados y equivalentes).
 * El `precio` es el precio del servicio, no un cobro: los cobros están en
 * resumen_financiero.
 *
 * Es la ÚNICA fuente para contar servicios. Además de los totales del periodo:
 *   - agruparPor 'mes': recibidos, entregados y principales clientes de cada mes;
 *   - clientesConMasServiciosEnUnMes: ranking (cliente, mes, servicios) ya calculado,
 *     para preguntas como "¿qué cliente trajo más servicios en un mes?";
 *   - cliente/telefono: los servicios de ese cliente, mes por mes y con detalle.
 */
const { cargarReglasApp } = require("../reglasApp");
const { PROPIEDADES_PERIODO, resolverPeriodo, limitesEnMs } = require("./periodo");
const {
  r2,
  texto,
  top,
  diaCaracas,
  nombreMes,
  mesesDelPeriodo,
  sinMesesInicialesVacios,
  PROPIEDADES_CLIENTE,
  filtroCliente,
  crearIdentidadClientes,
} = require("./utilidades");

const NOMBRE = "servicios_del_periodo";
const MAX_DETALLE_CLIENTE = 40;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Servicios de Turbinas App en un periodo (por defecto, el mes actual hasta hoy, hora de Venezuela): cuántos vehículos llegaron " +
    "al taller, qué servicios fueron los más frecuentes, sus estados actuales, los clientes con más servicios y cuántos se " +
    "entregaron en el periodo. Es la única herramienta para CONTAR SERVICIOS (un cobro no es un servicio). " +
    "Con agruparPor 'mes' devuelve además cada mes por separado. Si el periodo abarca varios meses devuelve " +
    "clientesConMasServiciosEnUnMes: el ranking de cliente y mes con más servicios en UN SOLO mes (para todo el historial usa " +
    "desde 2020-01-01). Con cliente y/o telefono devuelve los servicios de ese cliente mes por mes y con su detalle. " +
    "Cada cliente se identifica por su teléfono (últimos 4 dígitos). Los precios son de referencia: para dinero cobrado usa resumen_financiero.",
  esquema: {
    type: "object",
    properties: {
      ...PROPIEDADES_PERIODO,
      agruparPor: { type: "string", enum: ["periodo", "mes"], description: "periodo (por defecto): solo totales del periodo. mes: además, recibidos, entregados y principales clientes de cada mes." },
      ...PROPIEDADES_CLIENTE,
    },
    additionalProperties: false,
  },
  datos: ["vehiculos (campos de servicio, cliente, estado, precio y fechas)", "estadosServicio"],
  roles: ["owner", "admin"],
};

function contar(mapa, clave, extra = {}) {
  const fila = mapa.get(clave) || { nombre: clave, cantidad: 0, ...Object.fromEntries(Object.keys(extra).map((k) => [k, 0])) };
  fila.cantidad += 1;
  for (const [k, v] of Object.entries(extra)) fila[k] += v;
  mapa.set(clave, fila);
}

/** Instante en ms de un campo de fecha de vehículo (número o texto numérico); null si no es válido. */
function instante(valor) {
  const ms = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Mes AAAA-MM (hora de Venezuela) de un campo de fecha; null si no tiene fecha válida. */
function mesDe(valor) {
  const ms = instante(valor);
  return ms === null ? null : diaCaracas(ms).slice(0, 7);
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
  // Servicios de cada cliente en cada mes: clave `${mes}|${claveCliente}`
  const porClienteYMes = new Map();
  // Recibidos de cada mes y sus clientes
  const recibidosPorMes = new Map();
  let sinFechaValida = 0;
  // Clientes identificados por teléfono: dos clientes con el mismo nombre son distintos
  const identidad = crearIdentidadClientes(registrados.docs.map((v) => ({ nombre: v.customerName, telefono: v.customerPhone })));
  const filaCliente = (clave, cliente) => ({ cliente: cliente.toUpperCase(), telefono: identidad.telefono(clave), homonimo: identidad.homonimo(clave) });

  let precioReferencia = 0;
  for (const v of registrados.docs) {
    const precio = finanzas.leerImporte(v.precio);
    const usd = precio.estado === "valido" ? precio.valor : 0;
    precioReferencia += usd;
    contar(porServicio, (texto(v.servicio, 60) || "SIN SERVICIO").toUpperCase(), { precioUSD: usd });
    contar(porEstado, texto(v.status || v.estado, 40) || "sin estado");

    const mes = mesDe(v.arrivalTime);
    if (mes) {
      const delMes = recibidosPorMes.get(mes) || { recibidos: 0, clientes: new Map() };
      delMes.recibidos += 1;
      recibidosPorMes.set(mes, delMes);
    } else {
      sinFechaValida += 1;
    }

    const cliente = texto(v.customerName);
    if (!cliente) continue;
    const clave = identidad.clave(cliente, v.customerPhone);
    const fila = porCliente.get(clave) || { ...filaCliente(clave, cliente), cantidad: 0 };
    fila.cantidad += 1;
    porCliente.set(clave, fila);
    if (mes) {
      const claveMes = `${mes}|${clave}`;
      const filaMes = porClienteYMes.get(claveMes) || { ...filaCliente(clave, cliente), mes, servicios: 0 };
      filaMes.servicios += 1;
      porClienteYMes.set(claveMes, filaMes);
      const delMes = recibidosPorMes.get(mes);
      delMes.clientes.set(clave, (delMes.clientes.get(clave) || 0) + 1);
    }
  }

  const entregados = entregadosLectura.docs.filter((v) => criterio.esEntregado(v));
  const entregadosPorServicio = new Map();
  const entregadosPorMes = new Map();
  for (const v of entregados) {
    contar(entregadosPorServicio, (texto(v.servicio, 60) || "SIN SERVICIO").toUpperCase());
    const mes = mesDe(v.fechaEntrega);
    if (mes) entregadosPorMes.set(mes, (entregadosPorMes.get(mes) || 0) + 1);
  }

  const variosMeses = periodo.desde.slice(0, 7) !== periodo.hasta.slice(0, 7);
  const conMes = (f) => ({ cliente: f.cliente, telefono: f.telefono, homonimo: f.homonimo, mes: f.mes, nombreMes: nombreMes(f.mes), servicios: f.servicios });

  // Ranking de un solo mes: cada fila es un cliente en un mes concreto
  const clientesConMasServiciosEnUnMes = variosMeses
    ? [...porClienteYMes.values()].sort((a, b) => b.servicios - a.servicios || a.mes.localeCompare(b.mes)).slice(0, 10).map(conMes)
    : null;

  // Cada mes por separado (agruparPor 'mes')
  const meses = argumentos.agruparPor === "mes"
    ? sinMesesInicialesVacios(
        mesesDelPeriodo(periodo).map(({ mes }) => {
          const delMes = recibidosPorMes.get(mes) || { recibidos: 0, clientes: new Map() };
          const principales = [...delMes.clientes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([clave]) => {
              const f = porClienteYMes.get(`${mes}|${clave}`);
              return { cliente: f.cliente, telefono: f.telefono, homonimo: f.homonimo, servicios: f.servicios };
            });
          return { mes, nombre: nombreMes(mes), recibidos: delMes.recibidos, entregados: entregadosPorMes.get(mes) || 0, principalesClientes: principales };
        }),
        (m) => m.recibidos === 0 && m.entregados === 0
      )
    : null;
  const mesConMasRecibidos = meses && meses.length ? meses.reduce((a, b) => (b.recibidos > a.recibidos ? b : a)) : null;

  // Servicios de un cliente concreto
  const filtro = filtroCliente(argumentos);
  let serviciosCliente = null;
  if (filtro) {
    const lista = registrados.docs
      .filter((v) => texto(v.customerName) && filtro.coincide(texto(v.customerName), v.customerPhone))
      .map((v) => {
        const clave = identidad.clave(texto(v.customerName), v.customerPhone);
        const ms = instante(v.arrivalTime);
        return {
          clave,
          cliente: texto(v.customerName).toUpperCase(),
          telefono: identidad.telefono(clave),
          fecha: ms === null ? null : diaCaracas(ms),
          vehiculo: texto(v.vehiculo, 60),
          servicio: texto(v.servicio, 60),
          estado: texto(v.status || v.estado, 40),
        };
      })
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const porClave = new Map();
    const porMesCliente = new Map();
    for (const s of lista) {
      const fila = porClave.get(s.clave) || { cliente: s.cliente, telefono: s.telefono, homonimo: identidad.homonimo(s.clave), servicios: 0 };
      fila.servicios += 1;
      porClave.set(s.clave, fila);
      if (s.fecha) {
        const mes = s.fecha.slice(0, 7);
        porMesCliente.set(mes, (porMesCliente.get(mes) || 0) + 1);
      }
    }
    const porMes = [...porMesCliente.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, servicios]) => ({ mes, nombre: nombreMes(mes), servicios }));
    serviciosCliente = {
      ...filtro.descripcion,
      clientes: [...porClave.values()].sort((a, b) => b.servicios - a.servicios).slice(0, 10),
      servicios: lista.length,
      porMes,
      mesConMasServicios: porMes.length ? porMes.reduce((a, b) => (b.servicios > a.servicios ? b : a)) : null,
      detalle: lista.slice(0, MAX_DETALLE_CLIENTE).map(({ clave, ...s }) => s),
    };
  }

  const notas = [
    "Los precios son de referencia del servicio, no cobros. Para dinero cobrado se usa resumen_financiero.",
    "clientesConMasServiciosEnTodoElPeriodo suma TODO el periodo consultado; no es el dato de un solo mes.",
  ];
  if (variosMeses) notas.push("Para el máximo de servicios de un cliente en UN SOLO mes, usa clientesConMasServiciosEnUnMes.");
  if (registrados.truncado || entregadosLectura.truncado) notas.push("Lectura truncada: los conteos pueden estar incompletos.");
  if (sinFechaValida > 0) notas.push(`${sinFechaValida} servicio(s) no tienen fecha de llegada válida y no se asignan a ningún mes.`);
  if (serviciosCliente && serviciosCliente.servicios === 0) notas.push(`Ningún servicio del periodo es de un cliente que coincida con «${filtro.texto}».`);
  if (serviciosCliente && serviciosCliente.clientes.length > 1) notas.push(`«${filtro.texto}» corresponde a ${serviciosCliente.clientes.length} clientes distintos (distinto teléfono): el total los suma; el detalle está por cliente.`);
  if (serviciosCliente && serviciosCliente.servicios > MAX_DETALLE_CLIENTE) notas.push(`El detalle muestra los ${MAX_DETALLE_CLIENTE} servicios más recientes; los conteos por mes incluyen todos.`);

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
        clientesConMasServiciosEnTodoElPeriodo: top(porCliente, "cantidad").map((f) => ({ cliente: f.cliente, telefono: f.telefono, homonimo: f.homonimo, servicios: f.cantidad })),
      },
      entregados: {
        cantidad: entregados.length,
        porServicio: top(entregadosPorServicio, "cantidad").map((f) => ({ servicio: f.nombre, cantidad: f.cantidad })),
      },
      ...(clientesConMasServiciosEnUnMes ? { clientesConMasServiciosEnUnMes } : {}),
      ...(meses ? { meses, mesConMasRecibidos } : {}),
      ...(serviciosCliente ? { serviciosCliente } : {}),
      resumen: [
        { etiqueta: "Servicios recibidos", valor: registrados.docs.length, tipo: "numero" },
        { etiqueta: "Servicios entregados", valor: entregados.length, tipo: "numero" },
        { etiqueta: "Precio de referencia (recibidos)", valor: r2(precioReferencia), tipo: "usd" },
        ...(clientesConMasServiciosEnUnMes && clientesConMasServiciosEnUnMes.length
          ? [{
              etiqueta: `Más servicios en un solo mes: ${clientesConMasServiciosEnUnMes[0].cliente}${clientesConMasServiciosEnUnMes[0].telefono ? `, tel. ${clientesConMasServiciosEnUnMes[0].telefono}` : ""} (${clientesConMasServiciosEnUnMes[0].nombreMes})`,
              valor: clientesConMasServiciosEnUnMes[0].servicios,
              tipo: "numero",
            }]
          : []),
        ...(serviciosCliente ? [{ etiqueta: `Servicios de «${filtro.texto}»`, valor: serviciosCliente.servicios, tipo: "numero" }] : []),
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
