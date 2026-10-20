"use strict";

/**
 * Herramienta: nomina_por_empleado
 * Lo que la nómina guardada asigna a cada TRABAJADOR en un periodo. Fuente única:
 * la colección `nominas` (CalculoNomina.js guarda empleados[] con id, nombre,
 * cargo, servicios, bono y monto = base + bono). Los clientes no están aquí.
 * Atribución con la regla de la app (atribuirNomina de src/lib/finanzas.js):
 *   - nóminas cuyo periodo cae entero en el rango: suman completas;
 *   - nóminas que cruzan un cambio de mes o el límite del rango: se prorratean por
 *     días (monto y bono de cada empleado) y se deja constancia en las notas.
 *     Los servicios no se prorratean: se cuentan en cada periodo que toca la nómina.
 * No sale del servidor: cédula ni observaciones.
 */
const { cargarReglasApp } = require("../reglasApp");
const { PROPIEDADES_PERIODO, resolverPeriodo, limitesEnMs } = require("./periodo");
const { r2, texto, diaCaracas } = require("./utilidades");

const NOMBRE = "nomina_por_empleado";
const MAX_EMPLEADOS = 100;
const MAX_NOTAS_PRORRATEO = 10;

const dmy = (dia) => dia.split("-").reverse().join("/");

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Nómina de los TRABAJADORES del taller (no clientes) en un periodo (por defecto, el mes actual hasta hoy, hora de Venezuela): " +
    "cuánto asignó la nómina a cada empleado, con su cargo, servicios y bonos, ordenado de mayor a menor. Úsala para preguntas sobre " +
    "empleados, trabajadores, sueldos, comisiones o quién ganó más. Los importes son los de la nómina guardada en la app; " +
    "las nóminas que quedan entre dos meses se prorratean por días y se indica en las notas.",
  esquema: { type: "object", properties: PROPIEDADES_PERIODO, additionalProperties: false },
  datos: ["nominas (empleados: nombre, cargo, servicios, bono, monto)"],
  roles: ["owner", "admin"],
};

function acumular(mapa, empleado, finanzas, invalidos, proporcion) {
  const nombre = texto(empleado.nombre, 60) || "Sin nombre";
  const clave = typeof empleado.id === "string" && empleado.id ? `id:${empleado.id}` : `nombre:${nombre.toUpperCase()}`;
  const fila = mapa.get(clave) || { empleado: nombre, cargo: texto(empleado.cargo, 40), totalUSD: 0, bonosUSD: 0, servicios: 0, nominas: 0, incluyeProrrateo: false };
  const monto = finanzas.leerImporte(empleado.monto);
  if (monto.estado === "valido") fila.totalUSD += monto.valor * proporcion;
  else invalidos.cantidad += 1;
  const bono = finanzas.leerImporte(empleado.bono);
  if (bono.estado === "valido") fila.bonosUSD += bono.valor * proporcion;
  if (proporcion < 1) fila.incluyeProrrateo = true;
  const servicios = finanzas.leerImporte(empleado.servicios);
  if (servicios.estado === "valido") fila.servicios += servicios.valor;
  fila.nominas += 1;
  mapa.set(clave, fila);
}

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { periodo, error } = resolverPeriodo(argumentos, ahora());
  if (error) return { error };
  const { finanzas } = await cargarReglasApp();
  const { docs, truncado } = await fuente.leerNominas();
  const { inicioMs, finMs } = limitesEnMs(periodo);
  const rango = { inicio: new Date(inicioMs), fin: new Date(finMs) };

  const incluidos = new Map();
  const invalidos = { cantidad: 0 };
  const prorrateadas = [];
  let nominasIncluidas = 0;
  let sinPeriodo = 0;
  for (const nomina of docs) {
    const a = finanzas.atribuirNomina(nomina, rango);
    if (a.estado === "sin_periodo") sinPeriodo += 1;
    if (a.estado !== "dentro" && a.estado !== "prorrateada") continue;
    nominasIncluidas += 1;
    const proporcion = a.estado === "prorrateada" ? a.diasEnRango / a.diasTotales : 1;
    if (a.estado === "prorrateada") {
      prorrateadas.push({
        desde: diaCaracas(a.periodo.inicio.getTime()),
        hasta: diaCaracas(a.periodo.fin.getTime()),
        motivo: a.motivo === "cruza_cambio_de_mes" ? "queda entre dos meses" : "queda en el límite del periodo consultado",
        diasEnPeriodo: a.diasEnRango,
        diasTotales: a.diasTotales,
        incluidoUSD: r2(a.usd || 0),
        totalNominaUSD: r2(a.usdTotal || 0),
      });
    }
    for (const empleado of Array.isArray(nomina.empleados) ? nomina.empleados : []) {
      if (empleado && typeof empleado === "object") acumular(incluidos, empleado, finanzas, invalidos, proporcion);
    }
  }

  const ordenar = (mapa) =>
    [...mapa.values()]
      .map((f) => ({ ...f, totalUSD: r2(f.totalUSD), bonosUSD: r2(f.bonosUSD) }))
      .sort((a, b) => b.totalUSD - a.totalUSD || a.empleado.localeCompare(b.empleado));
  const empleados = ordenar(incluidos);
  const totalUSD = r2(empleados.reduce((acc, e) => acc + e.totalUSD, 0));
  const prorrateadoUSD = r2(prorrateadas.reduce((acc, p) => acc + p.incluidoUSD, 0));

  const notas = ["Importes de la nómina guardada en la app (base más bonos). La app no registra si cada pago se hizo efectivamente."];
  for (const p of prorrateadas.slice(0, MAX_NOTAS_PRORRATEO)) {
    notas.push(
      `Valor prorrateado: la nómina del ${dmy(p.desde)} al ${dmy(p.hasta)} ${p.motivo}; se incluyen ${p.diasEnPeriodo} de sus ${p.diasTotales} días: ${p.incluidoUSD.toFixed(2)} de ${p.totalNominaUSD.toFixed(2)} USD.`
    );
  }
  if (prorrateadas.length > MAX_NOTAS_PRORRATEO) notas.push(`Hay ${prorrateadas.length - MAX_NOTAS_PRORRATEO} nómina(s) prorrateada(s) más.`);
  if (prorrateadas.length > 0) notas.push("En las nóminas prorrateadas se reparten el monto y el bono por días; los servicios se cuentan completos.");
  if (nominasIncluidas === 0) notas.push("No hay nóminas guardadas en este periodo.");
  if (invalidos.cantidad > 0) notas.push(`${invalidos.cantidad} importe(s) de empleados no son válidos y no se sumaron.`);
  if (sinPeriodo > 0) notas.push(`${sinPeriodo} nómina(s) sin fechas válidas no se pueden asignar a ningún periodo.`);
  if (empleados.length > MAX_EMPLEADOS) notas.push(`Se listan los ${MAX_EMPLEADOS} primeros de ${empleados.length} empleados.`);
  if (truncado) notas.push("Lectura truncada: los totales pueden estar incompletos.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): nominas",
      consultadoEn: ahora().toISOString(),
      periodo,
      totalesCompletos: invalidos.cantidad === 0 && sinPeriodo === 0 && !truncado,
      nominasIncluidas,
      totalUSD,
      empleados: empleados.slice(0, MAX_EMPLEADOS),
      nominasProrrateadas: prorrateadas.slice(0, MAX_NOTAS_PRORRATEO),
      resumen: [
        { etiqueta: "Nómina del periodo", valor: totalUSD, tipo: "usd" },
        ...empleados.slice(0, 5).map((e) => ({ etiqueta: `· ${e.empleado}`, valor: e.totalUSD, tipo: "usd" })),
        ...(prorrateadas.length > 0 ? [{ etiqueta: "Incluye prorrateado (nóminas entre dos meses)", valor: prorrateadoUSD, tipo: "usd" }] : []),
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
