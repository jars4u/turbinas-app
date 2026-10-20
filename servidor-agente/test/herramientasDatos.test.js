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
  for (const args of [{ hasta: "2026-10-21" }, { desde: "2026-02-30" }, { desde: "20/10/2026" }, { desde: "2019-12-31" }, { desde: "2026-10-10", hasta: "2026-10-01" }, { desde: "2025-01-01" }]) {
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
  assert.deepEqual(i.principalesClientes, [{ cliente: "CLIENTE A", usd: 200, cobros: 2 }, { cliente: "CLIENTE B", usd: 100, cobros: 1 }]);
  assert.ok(resultado.notas.some((n) => n.includes("se estimaron 120 USD con el factor actual de la app (45 Bs por USD)")));
});

test("resumen_financiero: egresos, nómina, neto y totales parciales explicados", async () => {
  const { resultado } = await ejecutar("resumen_financiero", {});
  assert.equal(resultado.egresos.totalUSD, 50);
  assert.equal(resultado.egresos.porCategoria.factura.usd, 50);
  assert.equal(resultado.egresos.porCategoria.gasto_dia.bs, 450);
  assert.equal(resultado.nominaUSD, 200);
  assert.equal(resultado.netoUSD, 70);
  assert.equal(resultado.totalesCompletos, false);
  const notas = resultado.notas.join(" ");
  assert.match(notas, /1 egreso\(s\) tienen importe en USD y en Bs/);
  assert.match(notas, /1 egreso\(s\) en bolívares no tienen tasa registrada/);
  assert.match(notas, /1 nómina\(s\) por 300 USD cruzan/);
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
  assert.deepEqual(resultado.vencenProximos7Dias, { cantidad: 1, usd: 100 });
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
  assert.deepEqual(resultado.registrados.principalesClientes, [{ cliente: "ANA", servicios: 2 }]);
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
