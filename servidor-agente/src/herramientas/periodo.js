"use strict";

// Periodos de consulta en hora de Venezuela (UTC-4 fijo, sin horario de verano).
const OFFSET_CARACAS_MS = -4 * 60 * 60 * 1000;
const FECHA_MINIMA = "2020-01-01";
const MAX_DIAS = 366;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Argumentos comunes de las herramientas con periodo (JSON Schema)
const PROPIEDADES_PERIODO = {
  desde: { type: "string", maxLength: 10, description: "Fecha inicial AAAA-MM-DD (hora de Venezuela). Por defecto, el día 1 del mes actual." },
  hasta: { type: "string", maxLength: 10, description: "Fecha final AAAA-MM-DD, incluida. Por defecto, hoy. No puede ser futura." },
};

const pad = (n) => String(n).padStart(2, "0");

/** Fecha de hoy en Venezuela como AAAA-MM-DD. */
function hoyCaracas(ahora = new Date()) {
  const d = new Date(ahora.getTime() + OFFSET_CARACAS_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fechaReal(texto) {
  const m = RE_FECHA.exec(texto);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function dias(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1;
}

/**
 * Valida { desde?, hasta? } y devuelve { periodo } o { error }.
 * Sin argumentos: del día 1 del mes actual hasta hoy (hora de Venezuela).
 */
function resolverPeriodo(argumentos, ahora = new Date()) {
  const hoy = hoyCaracas(ahora);
  const desde = argumentos.desde ?? `${hoy.slice(0, 8)}01`;
  const hasta = argumentos.hasta ?? hoy;
  const error = (mensaje) => ({ error: { codigo: "periodo_invalido", mensaje } });
  if (!fechaReal(desde) || !fechaReal(hasta)) return error("Las fechas deben tener el formato AAAA-MM-DD y existir.");
  if (desde < FECHA_MINIMA) return error(`La fecha inicial no puede ser anterior a ${FECHA_MINIMA}.`);
  if (hasta > hoy) return error("La fecha final no puede ser futura.");
  if (desde > hasta) return error("La fecha inicial es posterior a la final.");
  if (dias(desde, hasta) > MAX_DIAS) return error(`El periodo no puede superar ${MAX_DIAS} días.`);
  return {
    periodo: {
      desde,
      hasta,
      dias: dias(desde, hasta),
      hoy,
      incluyeHoy: hasta === hoy,
      zonaHoraria: "America/Caracas (UTC-4)",
    },
  };
}

/** Instantes [inicio, fin] del periodo en milisegundos (00:00 y 23:59:59.999 en Venezuela). */
function limitesEnMs({ desde, hasta }) {
  return {
    inicioMs: Date.parse(`${desde}T00:00:00.000-04:00`),
    finMs: Date.parse(`${hasta}T23:59:59.999-04:00`),
  };
}

module.exports = { PROPIEDADES_PERIODO, resolverPeriodo, hoyCaracas, limitesEnMs, MAX_DIAS };
