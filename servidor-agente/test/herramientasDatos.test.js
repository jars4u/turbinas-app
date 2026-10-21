"use strict";

// Herramientas de datos con las REGLAS REALES de la app (src/lib, cargadas por
// reglasApp.js) y datos SINTÉTICOS. Sin Firebase ni proveedor de IA.
const test = require("node:test");
const assert = require("node:assert/strict");
const { ejecutarHerramienta } = require("../src/herramientas");
const { resolverPeriodo, limitesEnMs } = require("../src/herramientas/periodo");
const { crearAgente } = require("../src/agente");
const { modeloSimulado } = require("./ayudas");

const AHORA = () => new Date("2026-10-20T15:00:00Z"); // 20/10/2026 11:00 en Venezuela
const ts = (iso) => ({ toDate: () => new Date(iso) });
const lectura = (docs, truncado = false) => async () => ({ docs, truncado });

function fuenteDatos(cambios = {}) {
  const llamadas = [];
  const registrar = (nombre, fn) => async (...args) => {
    llamadas.push(nombre);
    return fn(...args);
  };
  const base = {
    leerIngresos: lectura([
      { id: "i1", fecha: "05/10/2026", customerName: "CLIENTE A", formasPago: [{ formaPago: "efectivo", monto: "100" }] },
      { id: "i2", fecha: "06/10/2026", customerName: "Cliente B", formasPago: [{ formaPago: "pago movil", montoBs: 4000, usdEquiv: 100, factorConversion: 40 }] },
      { id: "i3", fecha: "07/10/2026", customerName: "cliente a", formasPago: [{ formaPago: "PAGO MOVIL", monto: "4500" }] },
      { id: "i4", fecha: "15/09/2026", customerName: "FUERA DEL MES", formasPago: [{ formaPago: "efectivo", monto: 999 }] },
      { id: "i5", fecha: "08/10/2026", formasPago: [{ formaPago: "punto de venta", montoBs: 900 }] },
    ]),
    leerEgresos: lectura([
      { id: "e1", tipo: "factura", fecha: ts("2026-10-10T16:00:00Z"), montoUSD: 50, montoBs: 0 },
      { id: "e2", tipo: "gastoDia", fecha: "11/10/2026", montoUSD: 0, montoBs: 450, tasaFactura: null, monedaFactura: "Bs" },
      { id: "e3", fecha: "12/10/2026", montoUSD: 10, montoBs: 400, tasa: 40 },
    ]),
    leerNominas: lectura([
      { id: "n1", fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [{ id: "x", monto: 200 }] },
      { id: "n2", fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ id: "x", monto: 300 }] },
    ]),
    leerMetodosPago: lectura([
      { clave: "efectivo", nombre: "Efectivo", moneda: "USD" },
      { clave: "pago movil", nombre: "Pago móvil", moneda: "BS" },
      { clave: "punto de venta", nombre: "Punto de venta", moneda: "BS" },
    ]),
    leerConfigFactor: async () => ({ modo: "manual", valorManual: 45 }),
    leerCuentasPorCobrar: lectura([
      { customerName: "Cliente X", servicio: "LAVADO", vehiculo: "SINTETICO", precio: 30, precioBs: 1200, fechaRegistro: Date.parse("2026-10-01T15:00:00Z") },
      { customerName: "Cliente Y", servicio: "TURBINA", precio: "abc", fechaRegistro: Date.parse("2026-09-20T15:00:00Z") },
      { cliente: "Cliente Z", servicio: "LAVADO", precio: 20, arrivalTime: Date.parse("2026-10-19T15:00:00Z") },
    ]),
    leerCuentasPorPagar: lectura([
      { proveedor: "PROV 1", documento: "F-1", montoUSD: 100, montoBs: 0, monedaFactura: "USD", vencimiento: "15/10/2026" },
      { proveedor: "PROV 2", documento: "F-2", montoUSD: 0, montoBs: 4100, monedaFactura: "Bs", tasaFactura: 41, vencimiento: "25/10/2026" },
      { proveedor: "PROV 3", documento: "F-3", montoUSD: 0, montoBs: 500, monedaFactura: "Bs", vencimiento: "10/11/2026" },
      { proveedor: "PROV 4", documento: "F-4", montoUSD: 10, montoBs: 400 },
    ]),
    leerVehiculosRegistrados: lectura([
      { servicio: "Lavado", status: "entregado", precio: 20, customerName: "Ana" },
      { servicio: "lavado ", status: "proceso", precio: "15", customerName: "ana" },
      { servicio: "Turbina", status: "por_cobrar" },
    ]),
    leerVehiculosEntregados: lectura([
      { status: "entregado", servicio: "Lavado" },
      { status: "pagado", servicio: "Turbina" },
      { status: "proceso", servicio: "Lavado" },
    ]),
    leerEstadosServicio: async () => [{ nombre: "pagado", defaultFacturar: true }, { nombre: "proceso" }],
  };
  const fuente = { llamadas };
  for (const [nombre, fn] of Object.entries({ ...base, ...cambios })) fuente[nombre] = registrar(nombre, fn);
  return fuente;
}

const ejecutar = (nombre, args, fuente = fuenteDatos()) => ejecutarHerramienta(nombre, args, { fuente, ahora: AHORA });

test("periodo: mes actual por defecto, hoy, borde de medianoche en Venezuela y validaciones", () => {
  assert.deepEqual(resolverPeriodo({}, AHORA().valueOf() && AHORA()).periodo, {
    desde: "2026-10-01", hasta: "2026-10-20", dias: 20, hoy: "2026-10-20", incluyeHoy: true, zonaHoraria: "America/Caracas (UTC-4)",
  });
  // 01/11 02:00 UTC todavía es 31/10 en Venezuela
  assert.equal(resolverPeriodo({}, new Date("2026-11-01T02:00:00Z")).periodo.desde, "2026-10-01");
  assert.equal(resolverPeriodo({ desde: "2026-10-20", hasta: "2026-10-20" }, AHORA()).periodo.dias, 1);
  for (const args of [{ hasta: "2026-10-21" }, { desde: "2026-02-30" }, { desde: "20/10/2026" }, { desde: "2019-12-31" }, { desde: "2026-10-10", hasta: "2026-10-01" }]) {
    assert.equal(resolverPeriodo(args, AHORA()).error.codigo, "periodo_invalido", JSON.stringify(args));
  }
  const { inicioMs, finMs } = limitesEnMs({ desde: "2026-10-01", hasta: "2026-10-20" });
  assert.equal(new Date(inicioMs).toISOString(), "2026-10-01T04:00:00.000Z");
  assert.equal(new Date(finMs).toISOString(), "2026-10-21T03:59:59.999Z");
});

test("resumen_financiero: cobros en USD separando dólares, conversión registrada y estimados (factor actual)", async () => {
  const { resultado } = await ejecutar("resumen_financiero", {});
  const i = resultado.ingresos;
  assert.equal(i.totalUSD, 320);
  assert.equal(i.cobradosEnDolaresUSD, 100);
  assert.equal(i.desdeBolivaresConConversionRegistradaUSD, 100);
  assert.equal(i.estimadosConFactorActualUSD, 120); // 4500/45 + 900/45 (punto de venta es Bs por configuración)
  assert.equal(i.factorActual, 45);
  assert.equal(i.cobros, 4);
  assert.deepEqual(i.porMetodo, [
    { metodo: "Pago móvil", moneda: "BS", usd: 200, bs: 8500, pagos: 2 },
    { metodo: "Efectivo", moneda: "USD", usd: 100, bs: 0, pagos: 1 },
    { metodo: "Punto de venta", moneda: "BS", usd: 20, bs: 900, pagos: 1 },
  ]);
  assert.deepEqual(i.principalesClientes, [{ cliente: "CLIENTE A", telefono: null, homonimo: false, usd: 200, cobros: 2 }, { cliente: "CLIENTE B", telefono: null, homonimo: false, usd: 100, cobros: 1 }]);
  assert.ok(resultado.notas.some((n) => n.includes("se estimaron 120 USD con el factor actual de la app (45 Bs por USD)")));
});

test("resumen_financiero: egresos, nómina, neto y totales parciales explicados", async () => {
  const { resultado } = await ejecutar("resumen_financiero", {});
  assert.equal(resultado.egresos.totalUSD, 50);
  assert.equal(resultado.egresos.porCategoria.factura.usd, 50);
  assert.equal(resultado.egresos.porCategoria.gasto_dia.bs, 450);
  // 200 de la nómina de octubre + 120 prorrateados (2 de 5 días de la que cruza de mes)
  assert.equal(resultado.nominaUSD, 320);
  assert.equal(resultado.netoUSD, -50);
  assert.equal(resultado.totalesCompletos, false);
  const notas = resultado.notas.join(" ");
  assert.match(notas, /1 egreso\(s\) tienen importe en USD y en Bs/);
  assert.match(notas, /1 egreso\(s\) en bolívares no tienen tasa registrada/);
  assert.match(notas, /Nómina prorrateada: 1 nómina\(s\) quedan entre dos meses.*se incluyen 120\.00 de 300\.00 USD/);
  assert.match(notas, /No incluye anulaciones ni reembolsos/);
  assert.deepEqual(resultado.resumen.map((r) => r.etiqueta)[0], "Ingresos");
});

test("resumen_financiero: sin factor configurado no se estima y se informa; periodo inválido → error controlado", async () => {
  const { resultado } = await ejecutar("resumen_financiero", {}, fuenteDatos({ leerConfigFactor: async () => null }));
  assert.equal(resultado.ingresos.estimadosConFactorActualUSD, 0);
  assert.equal(resultado.ingresos.totalUSD, 200);
  assert.ok(resultado.notas.some((n) => n.includes("no se pudieron convertir porque no hay factor actual")));

  const malo = await ejecutar("resumen_financiero", { hasta: "2030-01-01" });
  assert.equal(malo.error.codigo, "periodo_invalido");
  const extra = await ejecutar("resumen_financiero", { coleccion: "usuarios" });
  assert.equal(extra.error.codigo, "argumentos_invalidos");
});

test("resumen_financiero: lectura truncada se advierte y el total no se presenta como completo", async () => {
  const { resultado } = await ejecutar("resumen_financiero", {}, fuenteDatos({ leerIngresos: lectura([], true) }));
  assert.equal(resultado.totalesCompletos, false);
  assert.ok(resultado.notas.some((n) => n.includes("Lectura truncada en: ingresos")));
});

test("cuentas_por_cobrar: total en USD, antigüedad y orden por la más antigua", async () => {
  const { resultado } = await ejecutar("cuentas_por_cobrar", {});
  assert.equal(resultado.cantidad, 3);
  assert.equal(resultado.totalUSD, 50);
  assert.equal(resultado.precioReferenciaBs, 1200);
  assert.equal(resultado.masAntiguaDias, 30);
  assert.deepEqual(resultado.cuentas.map((c) => [c.cliente, c.diasPendiente]), [["Cliente Y", 30], ["Cliente X", 19], ["Cliente Z", 1]]);
  assert.ok(resultado.notas.some((n) => n.includes("1 cuenta(s) no tienen un precio en USD válido")));
});

test("cuentas_por_pagar: vencidas, próximas, Bs con tasa registrada, pendientes y ambiguas", async () => {
  const { resultado } = await ejecutar("cuentas_por_pagar", {});
  assert.equal(resultado.cantidad, 4);
  assert.equal(resultado.totalUSD, 200);
  assert.deepEqual(resultado.vencidas, { cantidad: 1, usd: 100 });
  assert.deepEqual(resultado.vencenPronto, { dias: 7, cantidad: 1, usd: 100 });
  assert.deepEqual(resultado.facturas.map((f) => [f.documento, f.diasParaVencer, f.usd]), [["F-1", -5, 100], ["F-2", 5, 100], ["F-3", 21, null], ["F-4", null, null]]);
  const notas = resultado.notas.join(" ");
  assert.match(notas, /1 factura\(s\) en bolívares \(500 Bs\) no tienen tasa registrada/);
  assert.match(notas, /1 factura\(s\) tienen importe en USD y en Bs/);
});

test("servicios_del_periodo: recibidos, servicios frecuentes, estados y entregados con el criterio de la app", async () => {
  const fuente = fuenteDatos();
  let rango;
  fuente.leerVehiculosRegistrados = async (inicio, fin) => {
    rango = [inicio, fin];
    return { docs: [{ servicio: "Lavado", status: "entregado", precio: 20, customerName: "Ana" }, { servicio: "lavado ", status: "proceso", precio: "15", customerName: "ana" }, { servicio: "Turbina", status: "por_cobrar" }], truncado: false };
  };
  const { resultado } = await ejecutar("servicios_del_periodo", {}, fuente);
  assert.deepEqual(rango.map((ms) => new Date(ms).toISOString()), ["2026-10-01T04:00:00.000Z", "2026-10-21T03:59:59.999Z"]);
  assert.equal(resultado.registrados.cantidad, 3);
  assert.deepEqual(resultado.registrados.porServicio, [{ servicio: "LAVADO", cantidad: 2, precioReferenciaUSD: 35 }, { servicio: "TURBINA", cantidad: 1, precioReferenciaUSD: 0 }]);
  assert.deepEqual(resultado.registrados.clientesConMasServiciosEnTodoElPeriodo, [{ cliente: "ANA", telefono: null, homonimo: false, servicios: 2 }]);
  assert.equal(resultado.clientesConMasServiciosEnUnMes, undefined); // un solo mes: no hace falta el ranking mensual
  assert.equal(resultado.entregados.cantidad, 2); // "entregado" (equivalente) y "pagado" (defaultFacturar)
});

test("el agente usa resumen_financiero para la pregunta de ingresos del mes y devuelve los datos", async () => {
  const fuente = fuenteDatos();
  const modelo = modeloSimulado([
    { tipo: "herramientas", llamadas: [{ id: "c1", nombre: "resumen_financiero", argumentos: {} }] },
    (entrada) => {
      const r = entrada.conversacion[entrada.conversacion.length - 1].resultados[0];
      return { tipo: "texto", texto: `En lo que va de mes entraron ${r.contenido.ingresos.totalUSD} USD.` };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "¿cuánto dinero en usd ha entrado en lo que va de mes?" }] });
  assert.equal(r.texto, "En lo que va de mes entraron 320 USD.");
  assert.equal(r.consultas[0].herramienta, "resumen_financiero");
  assert.equal(r.consultas[0].resultado.periodo.desde, "2026-10-01");
});

const NOMINAS_SINTETICAS = [
  { id: "n1", fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [
    { id: "e1", nombre: "Pedro Sintetico", cedula: "V-SINTETICO-1", cargo: "Lavador", servicios: 10, bono: 20, monto: 220, observaciones: "OBS_SECRETA" },
    { id: "e2", nombre: "Luis Sintetico", cedula: "V-SINTETICO-2", cargo: "Ayudante", servicios: 4, bono: 0, monto: 150 },
  ] },
  { id: "n3", fechaInicio: "2026-10-12", fechaFin: "2026-10-16", empleados: [{ id: "e1", nombre: "Pedro Sintetico", cargo: "Lavador", servicios: 8, bono: 0, monto: 200 }] },
  { id: "n2", fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ id: "e2", nombre: "Luis Sintetico", monto: 300 }] },
];

test("nomina_por_empleado: total por trabajador, orden, prorrateo entre meses con constancia y sin datos sensibles", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_SINTETICAS) });
  const { resultado } = await ejecutar("nomina_por_empleado", {}, fuente);
  // n2 (28/09 al 02/10, 300 USD): a octubre le tocan 2 de 5 días = 120 USD
  assert.deepEqual(resultado.empleados, [
    { empleado: "Pedro Sintetico", cargo: "Lavador", totalUSD: 420, bonosUSD: 20, servicios: 18, nominas: 2, incluyeProrrateo: false },
    { empleado: "Luis Sintetico", cargo: "Ayudante", totalUSD: 270, bonosUSD: 0, servicios: 4, nominas: 2, incluyeProrrateo: true },
  ]);
  assert.equal(resultado.totalUSD, 690);
  assert.equal(resultado.nominasIncluidas, 3);
  assert.deepEqual(resultado.nominasProrrateadas, [
    { desde: "2026-09-28", hasta: "2026-10-02", motivo: "queda entre dos meses", diasEnPeriodo: 2, diasTotales: 5, incluidoUSD: 120, totalNominaUSD: 300 },
  ]);
  assert.equal(resultado.totalesCompletos, true);
  assert.ok(resultado.notas.includes("Valor prorrateado: la nómina del 28/09/2026 al 02/10/2026 queda entre dos meses; se incluyen 2 de sus 5 días: 120.00 de 300.00 USD."));
  assert.ok(resultado.resumen.some((f) => f.etiqueta.startsWith("Incluye prorrateado") && f.valor === 120));
  const json = JSON.stringify(resultado);
  assert.ok(!json.includes("V-SINTETICO") && !json.includes("OBS_SECRETA"));
});

test("nomina_por_empleado: el mes pasado, sin nóminas y periodo inválido", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_SINTETICAS) });
  const septiembre = await ejecutar("nomina_por_empleado", { desde: "2026-09-01", hasta: "2026-09-30" }, fuente);
  // A septiembre le tocan los otros 3 de 5 días: 180 + 120 = 300, sin perder ni duplicar
  assert.equal(septiembre.resultado.totalUSD, 180);
  assert.equal(septiembre.resultado.nominasProrrateadas[0].diasEnPeriodo, 3);
  const vacio = await ejecutar("nomina_por_empleado", {}, fuenteDatos({ leerNominas: lectura([]) }));
  assert.ok(vacio.resultado.notas.includes("No hay nóminas guardadas en este periodo."));
  const malo = await ejecutar("nomina_por_empleado", { desde: "2026-13-01" });
  assert.equal(malo.error.codigo, "periodo_invalido");
});

test("pregunta de trabajadores: el agente usa nomina_por_empleado y no lee ingresos ni clientes", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_SINTETICAS) });
  const modelo = modeloSimulado([
    { tipo: "herramientas", llamadas: [{ id: "c1", nombre: "nomina_por_empleado", argumentos: { desde: "2026-10-01", hasta: "2026-10-20" } }] },
    (entrada) => {
      const r = entrada.conversacion[entrada.conversacion.length - 1].resultados[0].contenido;
      return { tipo: "texto", texto: `${r.empleados[0].empleado} con ${r.empleados[0].totalUSD} USD.` };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "¿Quién de los trabajadores percibió más dinero?" }] });
  assert.equal(r.texto, "Pedro Sintetico con 420 USD.");
  assert.ok(!fuente.llamadas.includes("leerIngresos"));
});

// ---------------------------------------------------------------------------
// Alcance ampliado: filtros por nombre, agrupación por mes e historial de créditos
// ---------------------------------------------------------------------------
const { coincideNombre, mesesDelPeriodo } = require("../src/herramientas/utilidades");

test("utilidades: búsqueda de nombres sin acentos ni mayúsculas y meses de un periodo", () => {
  assert.ok(coincideNombre("JUAN CARLOS RAMOS", "juan ramos"));
  assert.ok(coincideNombre("José Pérez", "jose PEREZ"));
  assert.ok(!coincideNombre("JUAN PEREZ", "juan ramos"));
  assert.ok(!coincideNombre("JUAN", "  "));
  assert.deepEqual(mesesDelPeriodo({ desde: "2025-12-15", hasta: "2026-02-10" }), [
    { mes: "2025-12", desde: "2025-12-15", hasta: "2025-12-31" },
    { mes: "2026-01", desde: "2026-01-01", hasta: "2026-01-31" },
    { mes: "2026-02", desde: "2026-02-01", hasta: "2026-02-10" },
  ]);
});

const NOMINAS_JUAN = [
  { id: "j1", fechaInicio: "2026-08-03", fechaFin: "2026-08-07", empleados: [
    { id: "jr", nombre: "JUAN CARLOS RAMOS", cargo: "Lavador", monto: 150, servicios: 5 },
    { id: "ar", nombre: "ANA RUIZ", cargo: "Cajera", monto: 100 },
  ] },
  { id: "j2", fechaInicio: "2026-09-07", fechaFin: "2026-09-11", empleados: [{ id: "jr", nombre: "JUAN CARLOS RAMOS", monto: 200 }] },
  { id: "j3", fechaInicio: "2026-09-28", fechaFin: "2026-10-02", empleados: [{ id: "jr", nombre: "JUAN CARLOS RAMOS", monto: 300 }] },
  { id: "j4", fechaInicio: "2026-10-05", fechaFin: "2026-10-09", empleados: [{ id: "jr", nombre: "JUAN CARLOS RAMOS", monto: 100 }] },
];

test("nomina_por_empleado: un trabajador por mes en todo el historial, con el mes de mayor nómina", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_JUAN) });
  const { resultado } = await ejecutar("nomina_por_empleado", { empleado: "juan ramos", agruparPor: "mes", desde: "2020-01-01" }, fuente);
  assert.deepEqual(resultado.filtro, { empleado: "juan ramos", coincidencias: ["JUAN CARLOS RAMOS"] });
  assert.equal(resultado.empleados.length, 1);
  // Agosto 150; septiembre 200 + 180 (3 de 5 días de j3); octubre 120 + 100
  assert.equal(resultado.totalUSD, 750);
  const mes = (m) => resultado.meses.find((x) => x.mes === m);
  assert.equal(mes("2026-08").totalUSD, 150);
  assert.equal(mes("2026-09").totalUSD, 380);
  assert.equal(mes("2026-10").totalUSD, 220);
  assert.equal(mes("2026-09").incluyeProrrateo, true);
  assert.equal(resultado.meses[0].mes, "2026-08"); // sin los meses vacíos desde 2020
  assert.equal(resultado.mesConMasUSD.mes, "2026-09");
  assert.equal(resultado.mesConMasUSD.nombre, "septiembre 2026");
  assert.equal(resultado.mesConMenosUSD.mes, "2026-08");
  assert.ok(resultado.resumen.some((f) => f.etiqueta === "Mes con más: septiembre 2026" && f.valor === 380));
  assert.ok(resultado.notas.some((n) => n.startsWith("Valor prorrateado: las nóminas que quedan entre dos meses")));
  assert.ok(!JSON.stringify(resultado).includes("ANA RUIZ"));
});

test("nomina_por_empleado: si el nombre no coincide, lo dice y sugiere trabajadores del periodo", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_JUAN) });
  const { resultado } = await ejecutar("nomina_por_empleado", { empleado: "enrique", desde: "2026-08-01" }, fuente);
  assert.equal(resultado.totalUSD, 0);
  assert.deepEqual(resultado.empleados, []);
  assert.ok(resultado.notas.some((n) => n.includes("Ningún trabajador de las nóminas del periodo coincide con «enrique»")));
  assert.deepEqual(resultado.trabajadoresDelPeriodo, ["JUAN CARLOS RAMOS", "ANA RUIZ"]);
});

test("pregunta del mes de mayor ingreso de un trabajador: una sola consulta por meses, sin pedir mes por mes", async () => {
  const fuente = fuenteDatos({ leerNominas: lectura(NOMINAS_JUAN) });
  const modelo = modeloSimulado([
    { tipo: "herramientas", llamadas: [{ id: "c1", nombre: "nomina_por_empleado", argumentos: { empleado: "Juan Ramos", agruparPor: "mes", desde: "2020-01-01", hasta: "2026-10-20" } }] },
    (entrada) => {
      const r = entrada.conversacion[entrada.conversacion.length - 1].resultados[0].contenido;
      return { tipo: "texto", texto: `${r.mesConMasUSD.nombre}: ${r.mesConMasUSD.totalUSD} USD.` };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "¿Cuál es el mes en el que Juan Ramos ha ganado más dinero?" }] });
  assert.equal(r.texto, "septiembre 2026: 380 USD.");
  assert.equal(r.consultas.length, 1);
  assert.match(modelo.entradas[0].sistema, /Nunca pidas al usuario que consulte mes por mes/);
  assert.match(modelo.entradas[0].sistema, /desde 2020-01-01 hasta hoy/);
});

test("cuentas_por_cobrar: filtro por cliente, deuda por cliente y orden por monto", async () => {
  const todas = await ejecutar("cuentas_por_cobrar", { ordenarPor: "monto" });
  assert.deepEqual(todas.resultado.porCliente.map((c) => [c.cliente, c.servicios, c.totalUSD]), [["Cliente X", 1, 30], ["Cliente Z", 1, 20], ["Cliente Y", 1, 0]]);
  assert.deepEqual(todas.resultado.cuentas.map((c) => c.cliente), ["Cliente X", "Cliente Z", "Cliente Y"]);
  assert.equal(todas.resultado.clientesConDeuda, 3);
  const x = await ejecutar("cuentas_por_cobrar", { cliente: "cliente x" });
  assert.equal(x.resultado.cantidad, 1);
  assert.equal(x.resultado.totalUSD, 30);
  assert.deepEqual(x.resultado.porCliente, [{ cliente: "Cliente X", telefono: null, homonimo: false, servicios: 1, totalUSD: 30, deudaMasAntiguaDias: 19, desde: "2026-10-01" }]);
  const nadie = await ejecutar("cuentas_por_cobrar", { cliente: "enrique" });
  assert.equal(nadie.resultado.cantidad, 0);
  assert.ok(nadie.resultado.notas.some((n) => n.includes("Ningún cliente con deuda pendiente coincide con «enrique»")));
  assert.equal((await ejecutar("cuentas_por_cobrar", { ordenarPor: "fecha" })).error.codigo, "argumentos_invalidos");
});

const INGRESOS_CREDITOS = [
  { id: "c1", cuentaPorCobrarId: "k1", fecha: "10/10/2026", fechaServicio: "01/10/2026", customerName: "José Pérez", servicio: "TURBINA", formasPago: [{ formaPago: "efectivo", monto: 50 }] },
  { id: "c2", cuentaPorCobrarId: "k2", fecha: "15/10/2026", fechaServicio: "05/09/2026", customerName: "JOSE PEREZ", servicio: "LAVADO", formasPago: [{ formaPago: "efectivo", monto: 30 }] },
  { id: "c3", fecha: "12/10/2026", customerName: "JOSE PEREZ", formasPago: [{ formaPago: "efectivo", monto: 999 }] },
  { id: "c4", cuentaPorCobrarId: "k3", fecha: "20/09/2026", customerName: "OTRO", formasPago: [{ formaPago: "efectivo", monto: 10 }] },
];

test("creditos_cobrados: créditos pagados en el periodo, días hasta el pago y totales por cliente", async () => {
  const fuente = fuenteDatos({ leerIngresos: lectura(INGRESOS_CREDITOS) });
  const { resultado } = await ejecutar("creditos_cobrados", {}, fuente);
  assert.equal(resultado.cantidad, 2);
  assert.equal(resultado.totalUSD, 80);
  assert.equal(resultado.promedioDiasHastaCobro, 25); // (9 + 40) / 2
  assert.deepEqual(resultado.cobros[0], {
    cliente: "JOSE PEREZ", telefono: null, servicio: "LAVADO", vehiculo: null, fechaServicio: "2026-09-05", fechaCobro: "2026-10-15", diasHastaCobro: 40, totalUSD: 30, incluyeEstimacion: false,
  });
  assert.deepEqual(resultado.porCliente, [{ cliente: "JOSE PEREZ", telefono: null, homonimo: false, creditos: 2, totalUSD: 80, ultimoPago: "2026-10-15", promedioDiasHastaCobro: 25 }]);
  const otro = await ejecutar("creditos_cobrados", { cliente: "otro", desde: "2026-09-01" }, fuente);
  assert.equal(otro.resultado.cantidad, 1);
  assert.ok(otro.resultado.notas.some((n) => n.includes("no guardaron la fecha del servicio")));
  const malo = await ejecutar("creditos_cobrados", { desde: "2019-01-01" }, fuente);
  assert.equal(malo.error.codigo, "periodo_invalido");
});

test("cuentas_por_pagar: filtro por proveedor, deuda por proveedor y ventana de vencimiento", async () => {
  const todas = await ejecutar("cuentas_por_pagar", { diasProximos: 30 });
  assert.deepEqual(todas.resultado.vencenPronto, { dias: 30, cantidad: 2, usd: 100 });
  assert.deepEqual(todas.resultado.porProveedor[0], { proveedor: "PROV 1", facturas: 1, totalUSD: 100, vencidas: 1, proximoVencimiento: null });
  const p2 = await ejecutar("cuentas_por_pagar", { proveedor: "prov 2" });
  assert.equal(p2.resultado.cantidad, 1);
  assert.deepEqual(p2.resultado.porProveedor, [{ proveedor: "PROV 2", facturas: 1, totalUSD: 100, vencidas: 0, proximoVencimiento: "2026-10-25" }]);
  assert.equal((await ejecutar("cuentas_por_pagar", { diasProximos: 0 })).error.codigo, "argumentos_invalidos");
});

test("resumen_financiero: totales por mes con las reglas de Reportes y pagos de un cliente", async () => {
  const { resultado } = await ejecutar("resumen_financiero", { desde: "2026-09-01", agruparPor: "mes", cliente: "cliente a" });
  assert.deepEqual(resultado.meses.map((m) => [m.mes, m.ingresosUSD, m.nominaUSD]), [["2026-09", 999, 180], ["2026-10", 320, 320]]);
  assert.equal(resultado.mesConMasIngresos.mes, "2026-09");
  assert.equal(resultado.pagosCliente.cobros, 2);
  assert.equal(resultado.pagosCliente.totalUSD, 200);
  assert.equal(resultado.pagosCliente.ultimoPago, "2026-10-07");
  assert.equal(resultado.pagosCliente.clientes.length, 1); // mismo cliente escrito distinto
});

// ---------------------------------------------------------------------------
// Identidad de clientes por teléfono (homónimos)
// ---------------------------------------------------------------------------
const { claveTelefono, coincideTelefono, crearIdentidadClientes } = require("../src/herramientas/utilidades");

test("teléfono: mismo número en distintos formatos, '+58' vacío y búsqueda por los últimos dígitos", () => {
  for (const t of ["+58 414-123.4567", "04141234567", "4141234567", "+584141234567", "58 0414 1234567"]) assert.equal(claveTelefono(t), "4141234567", t);
  for (const t of ["+58", "", null, "123"]) assert.equal(claveTelefono(t), null, String(t));
  assert.ok(coincideTelefono("+584141234567", "0414-1234567"));
  assert.ok(coincideTelefono("+584141234567", "4567"));
  assert.ok(!coincideTelefono("+584141234567", "45"));
  assert.ok(!coincideTelefono("+584121112222", "4567"));
});

test("identidad: homónimos por teléfono; un registro sin teléfono se une a su único teléfono conocido", () => {
  const id = crearIdentidadClientes([
    { nombre: "Juan Pérez", telefono: "+584141234567" },
    { nombre: "JUAN PEREZ", telefono: "04249999999" },
    { nombre: "Ana Ruiz", telefono: "+584125550000" },
    { nombre: "ana ruiz", telefono: "+58" },
  ]);
  const a = id.clave("Juan Pérez", "0414-1234567");
  const b = id.clave("JUAN PEREZ", "+584249999999");
  assert.notEqual(a, b);
  assert.ok(id.homonimo(a) && id.homonimo(b));
  assert.equal(id.telefono(a), "…4567");
  assert.equal(id.clave("ana ruiz", "+58"), id.clave("Ana Ruiz", "+584125550000"));
  assert.ok(!id.homonimo(id.clave("Ana Ruiz", "")));
  // Sin teléfono y con dos clientes de ese nombre: no se sabe cuál es
  const sinTel = id.clave("Juan Perez", "");
  assert.ok(sinTel !== a && sinTel !== b);
  assert.equal(id.telefono(sinTel), null);
  assert.ok(id.homonimo(sinTel));
});

const CUENTAS_HOMONIMOS = [
  { customerName: "JUAN PEREZ", customerPhone: "+584141234567", servicio: "LAVADO", precio: 30, fechaRegistro: Date.parse("2026-10-01T15:00:00Z") },
  { customerName: "JUAN PEREZ", customerPhone: "+584141234567", servicio: "TURBINA", precio: 70, fechaRegistro: Date.parse("2026-10-10T15:00:00Z") },
  { customerName: "Juan Pérez", customerPhone: "0424-999.9999", servicio: "LAVADO", precio: 25, fechaRegistro: Date.parse("2026-10-15T15:00:00Z") },
];

test("cuentas_por_cobrar: dos clientes con el mismo nombre se separan por teléfono, sin exponer el número", async () => {
  const fuente = fuenteDatos({ leerCuentasPorCobrar: lectura(CUENTAS_HOMONIMOS) });
  const { resultado } = await ejecutar("cuentas_por_cobrar", { cliente: "juan perez" }, fuente);
  assert.deepEqual(resultado.porCliente.map((c) => [c.cliente, c.telefono, c.homonimo, c.servicios, c.totalUSD]), [
    ["JUAN PEREZ", "…4567", true, 2, 100],
    ["Juan Pérez", "…9999", true, 1, 25],
  ]);
  assert.equal(resultado.clientesConDeuda, 2);
  assert.ok(resultado.notas.some((n) => n.includes("clientes distintos con el mismo nombre")));
  assert.ok(resultado.resumen.some((f) => f.etiqueta === "· JUAN PEREZ (tel. …4567)"));
  const json = JSON.stringify(resultado);
  assert.ok(!json.includes("1234567") && !json.includes("999.9999") && !json.includes("4249999999"));
  // Por teléfono, completo en otro formato o por los últimos 4 dígitos
  const uno = await ejecutar("cuentas_por_cobrar", { telefono: "0414-1234567" }, fuente);
  assert.deepEqual([uno.resultado.cantidad, uno.resultado.totalUSD], [2, 100]);
  const otro = await ejecutar("cuentas_por_cobrar", { cliente: "juan", telefono: "9999" }, fuente);
  assert.deepEqual([otro.resultado.cantidad, otro.resultado.totalUSD], [1, 25]);
  assert.deepEqual(otro.resultado.filtro, { cliente: "juan", telefono: "9999" });
});

test("resumen_financiero y creditos_cobrados: pagos de homónimos separados por cliente", async () => {
  const ingresos = [
    { cuentaPorCobrarId: "k1", fecha: "10/10/2026", fechaServicio: "01/10/2026", customerName: "JUAN PEREZ", customerPhone: "+584141234567", formasPago: [{ formaPago: "efectivo", monto: 50 }] },
    { cuentaPorCobrarId: "k2", fecha: "12/10/2026", fechaServicio: "02/10/2026", customerName: "JUAN PEREZ", customerPhone: "+584249999999", formasPago: [{ formaPago: "efectivo", monto: 20 }] },
  ];
  const fuente = fuenteDatos({ leerIngresos: lectura(ingresos) });
  const r = await ejecutar("resumen_financiero", { cliente: "juan perez" }, fuente);
  assert.deepEqual(r.resultado.pagosCliente.clientes.map((c) => [c.telefono, c.homonimo, c.totalUSD]), [["…4567", true, 50], ["…9999", true, 20]]);
  assert.ok(r.resultado.notas.some((n) => n.includes("corresponde a 2 clientes distintos")));
  assert.equal(r.resultado.ingresos.principalesClientes.length, 2);
  const c = await ejecutar("creditos_cobrados", { telefono: "4567" }, fuente);
  assert.deepEqual([c.resultado.cantidad, c.resultado.totalUSD, c.resultado.porCliente[0].telefono], [1, 50, "…4567"]);
});

test("instrucciones: el cliente se identifica por teléfono y nunca se inventa un número", async () => {
  const modelo = modeloSimulado([{ tipo: "texto", texto: "ok" }]);
  await crearAgente({ modelo, fuente: fuenteDatos(), ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "hola" }] });
  assert.match(modelo.entradas[0].sistema, /Un cliente se identifica por su número de teléfono/);
  assert.match(modelo.entradas[0].sistema, /nunca inventes ni completes un número de teléfono/);
});

// ---------------------------------------------------------------------------
// Regresión: "¿qué cliente trajo más servicios en UN mes?"
// El agente respondió con el total histórico (45) como si fuera de un mes, luego
// atribuyó a un cliente los cobros de todos los clientes de un mes (152) y por
// último contestó sin consultar datos. Datos sintéticos que reproducen el caso:
//   - GOLLO: 45 servicios en total, pero como máximo 4 en un mes (octubre 2025);
//   - ENRIQUE: solo 6 servicios, todos en septiembre 2026 (el récord de un mes);
//   - octubre 2025: muchos cobros de otros clientes y solo 3 de GOLLO.
// ---------------------------------------------------------------------------
const llegada = (mes, dia = 15) => Date.parse(`${mes}-${String(dia).padStart(2, "0")}T12:00:00-04:00`);
// n meses después de enero 2024, como AAAA-MM
const mesN = (n) => `${2024 + Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
const VEHICULOS_GOLLO_ENRIQUE = [
  // 41 servicios de GOLLO de a 2 por mes desde enero 2024 (septiembre 2025 queda con 1)
  ...Array.from({ length: 41 }, (_, i) => ({ servicio: "CONVERTIDOR", vehiculo: "AVEO", customerName: "GOLLO", customerPhone: "+584141231575", status: "entregado", arrivalTime: llegada(mesN(Math.floor(i / 2)), 10 + (i % 2)) })),
  // 4 en octubre 2025: su mejor mes (mismo teléfono escrito distinto)
  ...[3, 9, 17, 25].map((d) => ({ servicio: "CONVERTIDOR", vehiculo: "CORSA", customerName: "Gollo", customerPhone: "0414-123-1575", status: "entregado", arrivalTime: llegada("2025-10", d) })),
  // ENRIQUE: 6 en septiembre 2026
  ...[1, 2, 3, 4, 5, 6].map((d) => ({ servicio: "PASTA SELLO", vehiculo: "SPARK", customerName: "ENRIQUE", customerPhone: "+584121231111", status: "entregado", arrivalTime: llegada("2026-09", d) })),
];
const vehiculosEnRango = (docs) => async (inicio, fin) => ({ docs: docs.filter((v) => v.arrivalTime >= inicio && v.arrivalTime <= fin), truncado: false });

test("servicios_del_periodo: el récord de UN mes es distinto del total histórico (caso GOLLO)", async () => {
  const fuente = fuenteDatos({ leerVehiculosRegistrados: vehiculosEnRango(VEHICULOS_GOLLO_ENRIQUE), leerVehiculosEntregados: lectura([]) });
  const { resultado } = await ejecutar("servicios_del_periodo", { desde: "2020-01-01", hasta: "2026-10-20" }, fuente);
  // En todo el historial GOLLO es quien más trajo...
  assert.deepEqual(resultado.registrados.clientesConMasServiciosEnTodoElPeriodo[0], { cliente: "GOLLO", telefono: "…1575", homonimo: false, servicios: 45 });
  // ...pero el récord de un solo mes es ENRIQUE en septiembre 2026
  assert.deepEqual(resultado.clientesConMasServiciosEnUnMes[0], { cliente: "ENRIQUE", telefono: "…1111", homonimo: false, mes: "2026-09", nombreMes: "septiembre 2026", servicios: 6 });
  assert.deepEqual(resultado.clientesConMasServiciosEnUnMes[1], { cliente: "GOLLO", telefono: "…1575", homonimo: false, mes: "2025-10", nombreMes: "octubre 2025", servicios: 4 });
  assert.ok(resultado.notas.some((n) => n.includes("no es el dato de un solo mes")));
  assert.ok(resultado.resumen.some((f) => f.etiqueta === "Más servicios en un solo mes: ENRIQUE, tel. …1111 (septiembre 2026)" && f.valor === 6));
});

test("servicios_del_periodo: servicios de un cliente mes por mes y en un mes concreto", async () => {
  const fuente = fuenteDatos({ leerVehiculosRegistrados: vehiculosEnRango(VEHICULOS_GOLLO_ENRIQUE), leerVehiculosEntregados: lectura([]) });
  const historia = (await ejecutar("servicios_del_periodo", { desde: "2020-01-01", hasta: "2026-10-20", cliente: "gollo" }, fuente)).resultado.serviciosCliente;
  assert.equal(historia.servicios, 45);
  assert.equal(historia.clientes.length, 1); // mismo teléfono escrito distinto = mismo cliente
  assert.deepEqual(historia.mesConMasServicios, { mes: "2025-10", nombre: "octubre 2025", servicios: 4 });
  assert.equal(historia.porMes.reduce((a, m) => a + m.servicios, 0), 45);
  assert.equal(historia.detalle.length, 40); // detalle acotado; los conteos incluyen todo

  const octubre = (await ejecutar("servicios_del_periodo", { desde: "2025-10-01", hasta: "2025-10-31", telefono: "1575" }, fuente)).resultado.serviciosCliente;
  assert.equal(octubre.servicios, 4);
  assert.deepEqual(octubre.detalle.map((s) => s.fecha), ["2025-10-25", "2025-10-17", "2025-10-09", "2025-10-03"]);
  assert.deepEqual(octubre.detalle[0], { cliente: "GOLLO", telefono: "…1575", fecha: "2025-10-25", vehiculo: "CORSA", servicio: "CONVERTIDOR", estado: "entregado" });

  const nadie = await ejecutar("servicios_del_periodo", { desde: "2025-10-01", hasta: "2025-10-31", cliente: "pedro" }, fuente);
  assert.equal(nadie.resultado.serviciosCliente.servicios, 0);
  assert.ok(nadie.resultado.notas.some((n) => n.includes("Ningún servicio del periodo")));
});

test("servicios_del_periodo: agruparPor mes con recibidos, entregados y clientes de cada mes", async () => {
  const fuente = fuenteDatos({
    leerVehiculosRegistrados: vehiculosEnRango(VEHICULOS_GOLLO_ENRIQUE),
    leerVehiculosEntregados: lectura([{ status: "entregado", servicio: "PASTA SELLO", fechaEntrega: llegada("2026-09", 20) }]),
  });
  const { resultado } = await ejecutar("servicios_del_periodo", { desde: "2025-09-01", hasta: "2026-10-20", agruparPor: "mes" }, fuente);
  const mes = (m) => resultado.meses.find((x) => x.mes === m);
  assert.equal(resultado.meses[0].mes, "2025-09");
  assert.deepEqual(mes("2025-10"), { mes: "2025-10", nombre: "octubre 2025", recibidos: 4, entregados: 0, principalesClientes: [{ cliente: "GOLLO", telefono: "…1575", homonimo: false, servicios: 4 }] });
  assert.equal(mes("2026-09").recibidos, 6);
  assert.equal(mes("2026-09").entregados, 1);
  assert.equal(resultado.mesConMasRecibidos.mes, "2026-09");
});

test("resumen_financiero: los cobros de un cliente por mes no se mezclan con los de todos los clientes", async () => {
  const ingresos = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, fecha: `${String(i + 1).padStart(2, "0")}/10/2025`, customerName: "OTRO", customerPhone: "+584240000001", formasPago: [{ formaPago: "efectivo", monto: 100 }] })),
    ...[5, 12, 20].map((d) => ({ id: `g${d}`, fecha: `${String(d).padStart(2, "0")}/10/2025`, customerName: "GOLLO", customerPhone: "+584141231575", formasPago: [{ formaPago: "efectivo", monto: 50 }] })),
    { id: "g-nov", fecha: "03/11/2025", customerName: "GOLLO", customerPhone: "+584141231575", formasPago: [{ formaPago: "efectivo", monto: 50 }] },
  ];
  const fuente = fuenteDatos({ leerIngresos: lectura(ingresos), leerNominas: lectura([]), leerEgresos: lectura([]) });
  const { resultado } = await ejecutar("resumen_financiero", { desde: "2025-10-01", hasta: "2025-11-30", agruparPor: "mes", cliente: "gollo" }, fuente);
  assert.equal(resultado.meses.find((m) => m.mes === "2025-10").cobrosDeTodosLosClientes, 13);
  assert.equal(resultado.meses[0].cobros, undefined); // ya no existe el campo ambiguo
  assert.deepEqual(resultado.pagosCliente.porMes, [
    { mes: "2025-10", nombre: "octubre 2025", cobros: 3, totalUSD: 150 },
    { mes: "2025-11", nombre: "noviembre 2025", cobros: 1, totalUSD: 50 },
  ]);
  assert.ok(resultado.notas.some((n) => n.includes("no servicios")));
  assert.ok(resultado.notas.some((n) => n.includes("son de TODOS los clientes")));
});

test("instrucciones: servicios no son cobros, un total no es un mes y una cifra cuestionada se vuelve a consultar", async () => {
  const modelo = modeloSimulado([{ tipo: "texto", texto: "ok" }]);
  await crearAgente({ modelo, fuente: fuenteDatos(), ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "hola" }] });
  const sistema = modelo.entradas[0].sistema;
  assert.match(sistema, /solo se cuenta con servicios_del_periodo/);
  assert.match(sistema, /Nunca respondas cuántos servicios hubo usando cobros/);
  assert.match(sistema, /Un total de varios meses no es el dato de un mes/);
  assert.match(sistema, /nunca atribuyas a un cliente las cifras generales del mes/);
  assert.match(sistema, /no reutilices cifras de respuestas previas/);
  assert.match(sistema, /vuelve a consultar las herramientas antes de responder/);
  assert.match(sistema, /resumen_financiero, servicios_del_periodo y nomina_por_empleado/);
});

test("pregunta del cliente con más servicios en un mes: una sola consulta y la cifra viene del ranking mensual", async () => {
  const fuente = fuenteDatos({ leerVehiculosRegistrados: vehiculosEnRango(VEHICULOS_GOLLO_ENRIQUE), leerVehiculosEntregados: lectura([]) });
  const modelo = modeloSimulado([
    { tipo: "herramientas", llamadas: [{ id: "c1", nombre: "servicios_del_periodo", argumentos: { desde: "2020-01-01", hasta: "2026-10-20" } }] },
    (entrada) => {
      const [primero] = entrada.conversacion[entrada.conversacion.length - 1].resultados[0].contenido.clientesConMasServiciosEnUnMes;
      return { tipo: "texto", texto: `${primero.cliente} (tel. ${primero.telefono}): ${primero.servicios} servicios en ${primero.nombreMes}.` };
    },
  ]);
  const r = await crearAgente({ modelo, fuente, ahora: AHORA }).responder({ mensajes: [{ rol: "usuario", texto: "¿quién ha sido el cliente que más servicios ha traído en un mes?" }] });
  assert.equal(r.texto, "ENRIQUE (tel. …1111): 6 servicios en septiembre 2026.");
  assert.equal(r.consultas.length, 1);
});
