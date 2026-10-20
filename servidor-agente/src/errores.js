"use strict";

/**
 * Error controlado del agente: un código estable para el cliente, el estado HTTP
 * y un mensaje que se puede mostrar. Nunca incluye datos del usuario ni secretos.
 */
class ErrorAgente extends Error {
  constructor(codigo, estado, mensaje) {
    super(mensaje);
    this.codigo = codigo;
    this.estado = estado;
  }
}

const ERRORES = {
  metodoNoPermitido: () => new ErrorAgente("metodo_no_permitido", 405, "Método no permitido."),
  noAutenticado: () => new ErrorAgente("no_autenticado", 401, "Inicia sesión para usar el agente."),
  sinPermiso: () => new ErrorAgente("sin_permiso", 403, "Solo los usuarios owner o admin pueden usar el agente."),
  autenticacionNoConfigurada: () =>
    new ErrorAgente(
      "autenticacion_no_configurada",
      503,
      "El servidor del agente no pudo verificar la sesión por un problema propio. No hace falta volver a iniciar sesión."
    ),
  solicitudInvalida: (mensaje) => new ErrorAgente("solicitud_invalida", 400, mensaje),
  solicitudDemasiadoGrande: () => new ErrorAgente("solicitud_demasiado_grande", 413, "El mensaje es demasiado largo."),
  modeloNoConfigurado: () =>
    new ErrorAgente("modelo_no_configurado", 503, "El modelo de IA todavía no está configurado en el servidor."),
  errorModelo: () => new ErrorAgente("error_modelo", 502, "El modelo de IA no respondió correctamente. Inténtalo de nuevo."),
  regionNoSoportada: () =>
    new ErrorAgente(
      "proveedor_region_no_soportada",
      503,
      "El proveedor de IA configurado no presta servicio en esta región. El servidor debe usar un proveedor disponible, como Azure OpenAI."
    ),
  tiempoAgotadoModelo: () =>
    new ErrorAgente("modelo_tiempo_agotado", 504, "El modelo de IA tardó demasiado en responder. Inténtalo de nuevo."),
  limiteUsoModelo: () =>
    new ErrorAgente("modelo_limite_uso", 503, "El proveedor de IA rechazó la solicitud por límite de uso o saldo. Inténtalo más tarde."),
  respuestaIncompleta: () =>
    new ErrorAgente("respuesta_incompleta", 502, "La respuesta del modelo quedó incompleta. Intenta con una pregunta más concreta."),
  limiteIteraciones: () =>
    new ErrorAgente("limite_iteraciones", 502, "El agente no pudo completar la respuesta dentro del límite de pasos."),
  interno: () => new ErrorAgente("error_interno", 500, "Error interno del agente."),
};

module.exports = { ErrorAgente, ERRORES };
