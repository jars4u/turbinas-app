"use strict";

const { esObjetoPlano } = require("../contrato");
const resumenServiciosPorEstado = require("./resumenServiciosPorEstado");
const resumenFinanciero = require("./resumenFinanciero");
const cuentasPorCobrar = require("./cuentasPorCobrar");
const cuentasPorPagar = require("./cuentasPorPagar");
const serviciosRegistrados = require("./serviciosRegistrados");
const nominaPorEmpleado = require("./nominaPorEmpleado");
const creditosCobrados = require("./creditosCobrados");

// Lista cerrada: el modelo solo puede invocar herramientas de este registro
const REGISTRO = new Map(
  [resumenServiciosPorEstado, resumenFinanciero, cuentasPorCobrar, cuentasPorPagar, serviciosRegistrados, nominaPorEmpleado, creditosCobrados].map((h) => [h.NOMBRE, h])
);

const MAX_BYTES_ARGUMENTOS = 2048;

/**
 * Valida argumentos contra el subconjunto de JSON Schema que usan las herramientas:
 * objeto, propiedades de tipo string/integer/boolean (con enum, maxLength,
 * minimum/maximum), required y additionalProperties: false.
 */
function validarArgumentos(esquema, argumentos) {
  if (!esObjetoPlano(argumentos)) return "Los argumentos deben ser un objeto.";
  if (JSON.stringify(argumentos).length > MAX_BYTES_ARGUMENTOS) return "Argumentos demasiado grandes.";
  const propiedades = esquema.properties || {};
  for (const clave of Object.keys(argumentos)) {
    if (!Object.prototype.hasOwnProperty.call(propiedades, clave)) return `Argumento no permitido: ${clave.slice(0, 40)}`;
  }
  for (const requerido of esquema.required || []) {
    if (!(requerido in argumentos)) return `Falta el argumento ${requerido}.`;
  }
  for (const [clave, regla] of Object.entries(propiedades)) {
    if (!(clave in argumentos)) continue;
    const v = argumentos[clave];
    if (regla.type === "string" && (typeof v !== "string" || (regla.maxLength && v.length > regla.maxLength))) return `Argumento inválido: ${clave}`;
    if (regla.type === "integer" && (!Number.isInteger(v) || (regla.minimum !== undefined && v < regla.minimum) || (regla.maximum !== undefined && v > regla.maximum))) return `Argumento inválido: ${clave}`;
    if (regla.type === "boolean" && typeof v !== "boolean") return `Argumento inválido: ${clave}`;
    if (regla.enum && !regla.enum.includes(v)) return `Argumento inválido: ${clave}`;
  }
  return null;
}

/** Definiciones que se entregan al modelo (sin detalles internos). */
function definicionesParaModelo() {
  return [...REGISTRO.values()].map(({ definicion }) => ({
    nombre: definicion.nombre,
    descripcion: definicion.descripcion,
    esquema: definicion.esquema,
  }));
}

/**
 * Ejecuta una herramienta del registro. Nunca lanza: devuelve { resultado } o
 * { error: { codigo, mensaje } } para que el modelo y el cliente lo vean.
 */
async function ejecutarHerramienta(nombre, argumentos, contexto) {
  const herramienta = typeof nombre === "string" ? REGISTRO.get(nombre) : undefined;
  if (!herramienta) return { error: { codigo: "herramienta_desconocida", mensaje: "Herramienta no disponible." } };
  const problema = validarArgumentos(herramienta.definicion.esquema, argumentos);
  if (problema) return { error: { codigo: "argumentos_invalidos", mensaje: problema } };
  try {
    return await herramienta.ejecutar(argumentos, contexto);
  } catch (_) {
    return { error: { codigo: "consulta_fallida", mensaje: "No se pudieron consultar los datos de Turbinas App." } };
  }
}

module.exports = { definicionesParaModelo, ejecutarHerramienta, validarArgumentos, REGISTRO };
