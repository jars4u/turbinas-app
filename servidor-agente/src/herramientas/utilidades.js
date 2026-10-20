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

module.exports = { r2, texto, diaCaracas, diferenciaDias, top };
