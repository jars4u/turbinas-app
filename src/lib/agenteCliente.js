// Cliente del Agente de IA. Envía la conversación actual al backend con el
// Firebase ID token del usuario; el backend verifica identidad y rol (owner/admin)
// por su cuenta. No hay claves del proveedor de IA en el frontend.

// Deben coincidir con servidor-agente/src/contrato.js
export const LIMITES_AGENTE = { mensajes: 20, caracteresMensaje: 4000, caracteresTotales: 24000 };

const MENSAJES_ERROR = {
  agente_no_configurado: "El agente aún no está conectado a un servidor en este entorno.",
  no_autenticado: "Tu sesión no es válida o expiró. Vuelve a iniciar sesión.",
  sin_permiso: "Tu usuario no tiene permiso para usar el agente (solo owner o admin).",
  autenticacion_no_configurada:
    "El servidor del agente no pudo verificar tu sesión por un problema de configuración. No necesitas volver a iniciar sesión; avisa al administrador.",
  solicitud_invalida: "No se pudo procesar el mensaje. Revísalo e inténtalo de nuevo.",
  solicitud_demasiado_grande: "El mensaje es demasiado largo. Acórtalo o inicia una conversación nueva.",
  modelo_no_configurado: "El agente todavía no tiene un modelo de IA configurado en el servidor.",
  error_modelo: "El modelo de IA no respondió correctamente. Inténtalo de nuevo.",
  proveedor_region_no_soportada:
    "El proveedor de IA configurado en el servidor no presta servicio en esta región. Avisa al administrador.",
  modelo_tiempo_agotado: "El modelo de IA tardó demasiado en responder. Inténtalo de nuevo.",
  modelo_limite_uso: "El proveedor de IA rechazó la solicitud por límite de uso o saldo. Inténtalo más tarde.",
  respuesta_incompleta: "La respuesta del modelo quedó incompleta. Intenta con una pregunta más concreta.",
  limite_iteraciones: "El agente no pudo completar la respuesta. Intenta con una pregunta más concreta.",
  red: "No se pudo conectar con el agente. Revisa tu conexión e inténtalo de nuevo.",
  respuesta_invalida: "La respuesta del agente no tiene el formato esperado.",
  desconocido: "Ocurrió un error inesperado con el agente.",
};

export class ErrorAgente extends Error {
  constructor(codigo) {
    super(MENSAJES_ERROR[codigo] || MENSAJES_ERROR.desconocido);
    this.codigo = MENSAJES_ERROR[codigo] ? codigo : "desconocido";
  }
}

export function urlAgente() {
  return process.env.REACT_APP_AGENTE_URL || "";
}

async function tokenUsuarioActual() {
  const { auth } = await import("../firebase");
  const usuario = auth.currentUser;
  if (!usuario) throw new ErrorAgente("no_autenticado");
  return usuario.getIdToken();
}

/**
 * Últimos mensajes que caben en los límites del servidor, empezando por un
 * mensaje del usuario. Solo rol y texto: nunca se reenvían resultados de datos.
 */
export function prepararConversacion(historial) {
  const seleccion = [];
  let total = 0;
  for (let i = historial.length - 1; i >= 0; i -= 1) {
    const { rol, texto } = historial[i];
    if (seleccion.length >= LIMITES_AGENTE.mensajes || total + texto.length > LIMITES_AGENTE.caracteresTotales) break;
    seleccion.unshift({ rol, texto });
    total += texto.length;
  }
  while (seleccion.length > 0 && seleccion[0].rol !== "usuario") seleccion.shift();
  return seleccion;
}

function respuestaValida(datos) {
  const r = datos && datos.respuesta;
  return r && typeof r.texto === "string" && Array.isArray(r.consultas);
}

/** Envía la conversación y devuelve { texto, consultas }; lanza ErrorAgente con mensaje legible. */
export async function enviarConversacion(historial, { url = urlAgente(), obtenerToken = tokenUsuarioActual, fetchImpl } = {}) {
  if (!url) throw new ErrorAgente("agente_no_configurado");
  const ultimo = historial[historial.length - 1];
  if (ultimo && ultimo.texto.length > LIMITES_AGENTE.caracteresMensaje) throw new ErrorAgente("solicitud_demasiado_grande");

  const token = await obtenerToken();
  let respuesta;
  try {
    respuesta = await (fetchImpl || fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mensajes: prepararConversacion(historial) }),
    });
  } catch (_) {
    throw new ErrorAgente("red");
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (_) {
    datos = null;
  }
  if (!respuesta.ok) throw new ErrorAgente(datos && datos.error && datos.error.codigo);
  if (!respuestaValida(datos)) throw new ErrorAgente("respuesta_invalida");
  return datos.respuesta;
}
