"use strict";

const OFFSET_CARACAS_MS = -4 * 60 * 60 * 1000;

/** Redondeo monetario a 2 decimales (evita ruido de coma flotante en las respuestas). */
function r2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Texto acotado para mostrar (nombres, servicios); null si no hay texto útil. */
function texto(valor, max = 80) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().replace(/\s+/g, " ");
  return limpio ? limpio.slice(0, max) : null;
}

/** Día AAAA-MM-DD en Venezuela de un instante en milisegundos. */
function diaCaracas(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + OFFSET_CARACAS_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Días completos entre dos fechas AAAA-MM-DD (b - a). */
function diferenciaDias(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Agrupa y devuelve los N primeros por un valor numérico. */
function top(mapa, clave, n = 10) {
  return [...mapa.values()].sort((a, b) => b[clave] - a[clave]).slice(0, n);
}

/** Texto comparable: sin acentos, mayúsculas ni espacios repetidos. */
function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El nombre coincide con la búsqueda? Cada palabra buscada debe aparecer en el
 * nombre ("juan ramos" encuentra "JUAN CARLOS RAMOS"; "jose" encuentra "José").
 */
function coincideNombre(nombre, busqueda) {
  const n = normalizar(nombre);
  const palabras = normalizar(busqueda).split(" ").filter(Boolean);
  return palabras.length > 0 && palabras.every((p) => n.includes(p));
}

/** Día AAAA-MM-DD de una fecha local (el proceso usa TZ America/Caracas, ver reglasApp.js). */
function diaLocal(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-09" -> "septiembre 2026" */
function nombreMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${y}`;
}

/** Meses que toca un periodo { desde, hasta }, cada uno recortado al periodo. */
function mesesDelPeriodo({ desde, hasta }) {
  const meses = [];
  let [y, m] = desde.split("-").map(Number);
  for (;;) {
    const mes = `${y}-${String(m).padStart(2, "0")}`;
    if (mes > hasta.slice(0, 7)) break;
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const inicioMes = `${mes}-01`;
    const finMes = `${mes}-${String(ultimo).padStart(2, "0")}`;
    meses.push({ mes, desde: inicioMes < desde ? desde : inicioMes, hasta: finMes > hasta ? hasta : finMes });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return meses;
}

/** Quita los meses iniciales sin datos (p. ej. al pedir todo el historial desde 2020). */
function sinMesesInicialesVacios(meses, estaVacio) {
  const primero = meses.findIndex((m) => !estaVacio(m));
  return primero === -1 ? [] : meses.slice(primero);
}

// ---------------------------------------------------------------------------
// Identidad de clientes: el teléfono (customerPhone) distingue a dos clientes que
// se llaman igual. Al modelo solo se le muestran los últimos 4 dígitos.
// ---------------------------------------------------------------------------

/**
 * Teléfono comparable: últimos 10 dígitos sin el prefijo 58 ni ceros iniciales
 * ("+58 414-123.4567" = "04141234567" = "4141234567"). null si no hay número útil
 * (la app guarda "+58" cuando no se escribió ninguno).
 */
function claveTelefono(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.startsWith("58") && d.length >= 12) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

/** Solo los últimos 4 dígitos, para distinguir clientes sin exponer el número. */
function telefonoVisible(clave) {
  return clave ? `…${clave.slice(-4)}` : null;
}

/** ¿El teléfono coincide con lo buscado? Número completo en cualquier formato, o sus últimos 4+ dígitos. */
function coincideTelefono(valor, busqueda) {
  const clave = claveTelefono(valor);
  const digitos = String(busqueda || "").replace(/\D/g, "");
  if (!clave || digitos.length < 4) return false;
  return clave === claveTelefono(busqueda) || clave.endsWith(digitos);
}

/**
 * Identifica clientes por teléfono. Recibe todos los registros { nombre, telefono }
 * y devuelve { clave(nombre, telefono), telefono(clave), homonimo(clave) }:
 *   - con teléfono: el cliente es ese teléfono;
 *   - sin teléfono: si su nombre tiene un único teléfono conocido, es ese cliente;
 *     si no tiene ninguno, se agrupa por nombre; si tiene varios, no se puede saber
 *     cuál es y queda aparte (sin teléfono) marcado como homónimo.
 *   - homonimo: el mismo nombre corresponde a más de un teléfono.
 */
function crearIdentidadClientes(registros) {
  const telefonosPorNombre = new Map();
  for (const { nombre, telefono } of registros) {
    const tel = claveTelefono(telefono);
    if (!tel) continue;
    const n = normalizar(nombre);
    if (!telefonosPorNombre.has(n)) telefonosPorNombre.set(n, new Set());
    telefonosPorNombre.get(n).add(tel);
  }
  const homonimos = new Set([...telefonosPorNombre].filter(([, tels]) => tels.size > 1).map(([n]) => n));
  const nombreDeClave = new Map();
  return {
    clave(nombre, telefono) {
      const n = normalizar(nombre);
      let tel = claveTelefono(telefono);
      if (!tel && telefonosPorNombre.has(n) && telefonosPorNombre.get(n).size === 1) [tel] = telefonosPorNombre.get(n);
      const clave = tel ? `tel:${tel}` : `nombre:${n}`;
      nombreDeClave.set(clave, n);
      return clave;
    },
    telefono: (clave) => (clave.startsWith("tel:") ? telefonoVisible(clave.slice(4)) : null),
    homonimo: (clave) => homonimos.has(nombreDeClave.get(clave)),
  };
}

// Argumentos comunes para buscar a un cliente (JSON Schema)
const PROPIEDADES_CLIENTE = {
  cliente: { type: "string", maxLength: 60, description: "Nombre o parte del nombre del cliente para filtrar (no distingue acentos ni mayúsculas)." },
  telefono: {
    type: "string",
    maxLength: 25,
    description: "Teléfono del cliente (completo en cualquier formato, o sus últimos 4 dígitos). Identifica al cliente cuando hay varios con el mismo nombre.",
  },
};

/** Filtro por nombre y/o teléfono de cliente; null si no se pidió ninguno. */
function filtroCliente({ cliente, telefono }) {
  const nombre = texto(cliente, 60);
  const tel = texto(telefono, 25);
  if (!nombre && !tel) return null;
  return {
    descripcion: { ...(nombre ? { cliente: nombre } : {}), ...(tel ? { telefono: tel } : {}) },
    texto: [nombre, tel && `tel. ${tel}`].filter(Boolean).join(", "),
    coincide: (n, t) => (!nombre || coincideNombre(n, nombre)) && (!tel || coincideTelefono(t, tel)),
  };
}

module.exports = {
  PROPIEDADES_CLIENTE,
  filtroCliente,
  sinMesesInicialesVacios,
  r2,
  texto,
  diaCaracas,
  diferenciaDias,
  top,
  normalizar,
  coincideNombre,
  diaLocal,
  nombreMes,
  mesesDelPeriodo,
  claveTelefono,
  telefonoVisible,
  coincideTelefono,
  crearIdentidadClientes,
};
