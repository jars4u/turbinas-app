"use strict";

const { ERRORES } = require("../errores");

/**
 * Adaptador usado mientras no haya proveedor de IA configurado: responde 503
 * "modelo_no_configurado". Nunca simula respuestas.
 */
const modeloNoConfigurado = {
  generar: async () => {
    throw ERRORES.modeloNoConfigurado();
  },
};

module.exports = { modeloNoConfigurado };
