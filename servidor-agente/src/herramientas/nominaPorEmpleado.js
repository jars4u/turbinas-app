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
 * Opciones: filtrar por trabajador (por nombre) y agrupar por mes, para preguntas
 * como "¿en qué mes ganó más Juan?" en una sola consulta.
 * No sale del servidor: cédula ni observaciones.
 */
const { cargarReglasApp } = require("../reglasApp");
const { PROPIEDADES_PERIODO, resolverPeriodo, limitesEnMs } = require("./periodo");
const { r2, texto, diaCaracas, coincideNombre, nombreMes, mesesDelPeriodo, sinMesesInicialesVacios } = require("./utilidades");

const NOMBRE = "nomina_por_empleado";
const MAX_EMPLEADOS = 100;
const MAX_NOTAS_PRORRATEO = 10;
const MAX_SUGERENCIAS = 30;

const dmy = (dia) => dia.split("-").reverse().join("/");

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Nómina de los TRABAJADORES del taller (no clientes) en un periodo (por defecto, el mes actual hasta hoy, hora de Venezuela): " +
    "cuánto asignó la nómina a cada empleado, con su cargo, servicios y bonos, ordenado de mayor a menor. Úsala para preguntas sobre " +
    "empleados, trabajadores, sueldos, comisiones o quién ganó más. Puede filtrar por un trabajador (empleado) y agrupar por mes " +
    "(agruparPor: 'mes') para comparar meses en una sola consulta; para 'en qué mes ganó más' o historiales usa un periodo largo " +
    "(desde 2020-01-01 si no se indica otro). Los importes son los de la nómina guardada en la app; las nóminas que quedan entre " +
    "dos meses se prorratean por días y se indica en las notas.",
  esquema: {
    type: "object",
    properties: {
      ...PROPIEDADES_PERIODO,
      empleado: { type: "string", maxLength: 60, description: "Nombre o parte del nombre de un trabajador para filtrar (no distingue acentos ni mayúsculas)." },
      agruparPor: {
        type: "string",
        enum: ["empleado", "mes"],
        description: "empleado (por defecto): total de cada trabajador en el periodo. mes: además, el total de cada mes del periodo.",
      },
    },
    additionalProperties: false,
  },
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

/** Suma las nóminas atribuibles a [inicio, fin] para los empleados que pasan el filtro. */
function agregar(docs, rango, finanzas, filtro) {
  const mapa = new Map();
  const invalidos = { cantidad: 0 };
  const prorrateadas = [];
  let nominasIncluidas = 0;
  let sinPeriodo = 0;
  for (const nomina of docs) {
    const a = finanzas.atribuirNomina(nomina, rango);
    if (a.estado === "sin_periodo") sinPeriodo += 1;
    if (a.estado !== "dentro" && a.estado !== "prorrateada") continue;
    const empleados = (Array.isArray(nomina.empleados) ? nomina.empleados : []).filter((e) => e && typeof e === "object" && filtro(e));
    if (empleados.length === 0) continue;
    nominasIncluidas += 1;
    const proporcion = a.estado === "prorrateada" ? a.diasEnRango / a.diasTotales : 1;
    if (a.estado === "prorrateada") {
      // Importe de los empleados considerados (todos, o solo el filtrado)
      const total = empleados.reduce((acc, e) => {
        const m = finanzas.leerImporte(e.monto);
        return acc + (m.estado === "valido" ? m.valor : 0);
      }, 0);
      prorrateadas.push({
        desde: diaCaracas(a.periodo.inicio.getTime()),
        hasta: diaCaracas(a.periodo.fin.getTime()),
        motivo: a.motivo === "cruza_cambio_de_mes" ? "queda entre dos meses" : "queda en el límite del periodo consultado",
        diasEnPeriodo: a.diasEnRango,
        diasTotales: a.diasTotales,
        incluidoUSD: r2(total * proporcion),
        totalNominaUSD: r2(total),
      });
    }
    for (const empleado of empleados) acumular(mapa, empleado, finanzas, invalidos, proporcion);
  }
  const empleados = [...mapa.values()]
    .map((f) => ({ ...f, totalUSD: r2(f.totalUSD), bonosUSD: r2(f.bonosUSD) }))
    .sort((a, b) => b.totalUSD - a.totalUSD || a.empleado.localeCompare(b.empleado));
  return { empleados, invalidos, prorrateadas, nominasIncluidas, sinPeriodo, totalUSD: r2(empleados.reduce((acc, e) => acc + e.totalUSD, 0)) };
}

function rangoDe(periodo) {
  const { inicioMs, finMs } = limitesEnMs(periodo);
  return { inicio: new Date(inicioMs), fin: new Date(finMs) };
}

async function ejecutar(argumentos, { fuente, ahora = () => new Date() }) {
  const { periodo, error } = resolverPeriodo(argumentos, ahora());
  if (error) return { error };
  const busqueda = texto(argumentos.empleado, 60);
  const porMes = argumentos.agruparPor === "mes";
  const { finanzas } = await cargarReglasApp();
  const { docs, truncado } = await fuente.leerNominas();
  const filtro = busqueda ? (e) => coincideNombre(e.nombre, busqueda) : () => true;

  const total = agregar(docs, rangoDe(periodo), finanzas, filtro);
  const { empleados, invalidos, prorrateadas, nominasIncluidas, sinPeriodo, totalUSD } = total;
  const prorrateadoUSD = r2(prorrateadas.reduce((acc, p) => acc + p.incluidoUSD, 0));

  let meses = null;
  if (porMes) {
    const todos = mesesDelPeriodo(periodo).map((m) => {
      const ag = agregar(docs, rangoDe(m), finanzas, filtro);
      return {
        mes: m.mes,
        nombre: nombreMes(m.mes),
        totalUSD: ag.totalUSD,
        bonosUSD: r2(ag.empleados.reduce((acc, e) => acc + e.bonosUSD, 0)),
        servicios: ag.empleados.reduce((acc, e) => acc + e.servicios, 0),
        nominas: ag.nominasIncluidas,
        incluyeProrrateo: ag.prorrateadas.length > 0,
      };
    });
    meses = sinMesesInicialesVacios(todos, (m) => m.nominas === 0);
  }
  const conImporte = meses ? meses.filter((m) => m.totalUSD > 0) : [];
  const mesMayor = conImporte.length ? conImporte.reduce((a, b) => (b.totalUSD > a.totalUSD ? b : a)) : null;
  const mesMenor = conImporte.length ? conImporte.reduce((a, b) => (b.totalUSD < a.totalUSD ? b : a)) : null;

  const notas = ["Importes de la nómina guardada en la app (base más bonos). La app no registra si cada pago se hizo efectivamente."];
  if (busqueda && empleados.length === 0) {
    notas.push(`Ningún trabajador de las nóminas del periodo coincide con «${busqueda}». Revisa el nombre o amplía el periodo.`);
  }
  if (porMes) {
    if (meses.some((m) => m.incluyeProrrateo)) {
      notas.push("Valor prorrateado: las nóminas que quedan entre dos meses se reparten por días entre ellos; los meses con incluyeProrrateo lo incluyen.");
    }
  } else {
    for (const p of prorrateadas.slice(0, MAX_NOTAS_PRORRATEO)) {
      notas.push(
        `Valor prorrateado: la nómina del ${dmy(p.desde)} al ${dmy(p.hasta)} ${p.motivo}; se incluyen ${p.diasEnPeriodo} de sus ${p.diasTotales} días: ${p.incluidoUSD.toFixed(2)} de ${p.totalNominaUSD.toFixed(2)} USD.`
      );
    }
    if (prorrateadas.length > MAX_NOTAS_PRORRATEO) notas.push(`Hay ${prorrateadas.length - MAX_NOTAS_PRORRATEO} nómina(s) prorrateada(s) más.`);
  }
  if (prorrateadas.length > 0 || (meses && meses.some((m) => m.incluyeProrrateo))) notas.push("En las nóminas prorrateadas se reparten el monto y el bono por días; los servicios se cuentan completos.");
  if (nominasIncluidas === 0 && !busqueda) notas.push("No hay nóminas guardadas en este periodo.");
  if (invalidos.cantidad > 0) notas.push(`${invalidos.cantidad} importe(s) de empleados no son válidos y no se sumaron.`);
  if (sinPeriodo > 0) notas.push(`${sinPeriodo} nómina(s) sin fechas válidas no se pueden asignar a ningún periodo.`);
  if (empleados.length > MAX_EMPLEADOS) notas.push(`Se listan los ${MAX_EMPLEADOS} primeros de ${empleados.length} empleados.`);
  if (truncado) notas.push("Lectura truncada: los totales pueden estar incompletos.");

  // Si el nombre no coincide, nombres de trabajadores del periodo para sugerir
  const sugerencias = busqueda && empleados.length === 0
    ? agregar(docs, rangoDe(periodo), finanzas, () => true).empleados.slice(0, MAX_SUGERENCIAS).map((e) => e.empleado)
    : undefined;

  const filasMeses = meses
    ? (meses.length <= 12 ? meses : [...conImporte].sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 5)).map((m) => ({
        etiqueta: `· ${m.nombre}${m.incluyeProrrateo ? " (incluye prorrateo)" : ""}`,
        valor: m.totalUSD,
        tipo: "usd",
      }))
    : [];

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): nominas",
      consultadoEn: ahora().toISOString(),
      periodo,
      filtro: busqueda ? { empleado: busqueda, coincidencias: empleados.map((e) => e.empleado) } : null,
      totalesCompletos: invalidos.cantidad === 0 && sinPeriodo === 0 && !truncado,
      nominasIncluidas,
      totalUSD,
      empleados: empleados.slice(0, MAX_EMPLEADOS),
      ...(meses ? { meses, mesConMasUSD: mesMayor, mesConMenosUSD: mesMenor } : {}),
      ...(sugerencias ? { trabajadoresDelPeriodo: sugerencias } : {}),
      nominasProrrateadas: prorrateadas.slice(0, MAX_NOTAS_PRORRATEO),
      resumen: [
        { etiqueta: busqueda && empleados.length === 1 ? `Nómina de ${empleados[0].empleado}` : "Nómina del periodo", valor: totalUSD, tipo: "usd" },
        ...(meses
          ? [...(mesMayor ? [{ etiqueta: `Mes con más: ${mesMayor.nombre}`, valor: mesMayor.totalUSD, tipo: "usd" }] : []), ...filasMeses]
          : empleados.slice(0, 5).map((e) => ({ etiqueta: `· ${e.empleado}`, valor: e.totalUSD, tipo: "usd" }))),
        ...(prorrateadas.length > 0 ? [{ etiqueta: "Incluye prorrateado (nóminas entre dos meses)", valor: prorrateadoUSD, tipo: "usd" }] : []),
      ],
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE };
