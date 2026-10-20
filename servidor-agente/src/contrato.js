"use strict";

const { ERRORES } = require("./errores");

/**
 * Contrato de la solicitud POST del agente:
 *   Authorization: Bearer <Firebase ID token>
 *   { "mensajes": [{ "rol": "usuario" | "asistente", "texto": "..." }, ...] }
 * Es la conversación actual (sin persistencia). Solo hay texto: el cliente nunca
 * envía llamadas ni resultados de herramientas, que solo produce el servidor.
 */
const LIMITES = {
  bytesCuerpo: 64 * 1024,
  mensajes: 20,
  caracteresMensaje: 4000,
  caracteresTotales: 24000,
  caracteresToken: 4096,
};

const ROLES_MENSAJE = new Set(["usuario", "asistente"]);

function esObjetoPlano(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validarSolicitud(cuerpo) {
  if (!esObjetoPlano(cuerpo)) throw ERRORES.solicitudInvalida("El cuerpo debe ser un objeto JSON.");
  const claves = Object.keys(cuerpo);
  if (claves.some((c) => c !== "mensajes")) throw ERRORES.solicitudInvalida("Campos no permitidos en la solicitud.");
  const { mensajes } = cuerpo;
  if (!Array.isArray(mensajes) || mensajes.length === 0) throw ERRORES.solicitudInvalida("Falta la conversación.");
  if (mensajes.length > LIMITES.mensajes) throw ERRORES.solicitudInvalida(`La conversación supera ${LIMITES.mensajes} mensajes.`);

  let total = 0;
  const limpios = mensajes.map((m) => {
    if (!esObjetoPlano(m) || Object.keys(m).some((c) => c !== "rol" && c !== "texto")) {
      throw ERRORES.solicitudInvalida("Mensaje con formato inválido.");
    }
    if (!ROLES_MENSAJE.has(m.rol)) throw ERRORES.solicitudInvalida("Rol de mensaje no permitido.");
    if (typeof m.texto !== "string" || m.texto.trim() === "") throw ERRORES.solicitudInvalida("Mensaje vacío.");
    if (m.texto.length > LIMITES.caracteresMensaje) throw ERRORES.solicitudDemasiadoGrande();
    total += m.texto.length;
    return { rol: m.rol, texto: m.texto };
  });
  if (total > LIMITES.caracteresTotales) throw ERRORES.solicitudDemasiadoGrande();
  if (limpios[limpios.length - 1].rol !== "usuario") throw ERRORES.solicitudInvalida("El último mensaje debe ser del usuario.");
  return { mensajes: limpios };
}

module.exports = { LIMITES, validarSolicitud, esObjetoPlano };
