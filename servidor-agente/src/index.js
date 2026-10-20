"use strict";

const { crearAgente } = require("./agente");
const { crearManejador, crearManejadorHttp } = require("./manejador");
const { crearDependenciasFirebase } = require("./firebase");
const { crearModeloDesdeEntorno } = require("./modelo/openai");
const { modeloNoConfigurado } = require("./modelo/noConfigurado");

/**
 * Ensambla el servicio para una plataforma con firma (req, res).
 * crearModelo: fábrica del adaptador; por defecto OpenAI si hay OPENAI_API_KEY,
 * o "modelo no configurado" (503) si no la hay.
 */
function crearServicioAgente({ entorno = process.env, crearModelo = crearModeloDesdeEntorno, registrar } = {}) {
  const { autenticacion, fuente } = crearDependenciasFirebase({ entorno });
  const modelo = crearModelo(entorno);
  const manejador = crearManejador({
    autenticacion,
    crearAgenteParaSolicitud: () => crearAgente({ modelo, fuente }),
    registrar,
  });
  const origenesPermitidos = String(entorno.AGENTE_ORIGENES_PERMITIDOS || "").split(",").map((o) => o.trim()).filter(Boolean);
  return crearManejadorHttp(manejador, { origenesPermitidos });
}

module.exports = { crearServicioAgente, modeloNoConfigurado };
