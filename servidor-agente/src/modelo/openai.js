"use strict";

const {
  OpenAI,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
} = require("openai");
const { ErrorAgente, ERRORES } = require("../errores");
const { modeloNoConfigurado } = require("./noConfigurado");

/**
 * Adaptador OpenAI (Chat Completions con herramientas) del contrato
 * modelo.generar({ sistema, conversacion, herramientas }) descrito en agente.js.
 * - El modelo solo ve las herramientas del registro del backend; las ejecuta el
 *   servidor (agente.js), que valida los argumentos y limita los pasos.
 * - La clave solo llega por OPENAI_API_KEY en el entorno del servidor y nunca se
 *   incluye en errores ni registros: los errores del SDK se traducen a ErrorAgente
 *   con mensajes fijos.
 */
const MODELO_PREDETERMINADO = "gpt-5.4-mini";
const TIEMPO_LIMITE_MS = 30000;
const REINTENTOS = 1;
const MAX_TOKENS_SALIDA = 4000;
const MAX_ARGUMENTOS_TEXTO = 2048;
const RE_MODELO = /^[A-Za-z0-9._:-]{1,100}$/;

// strict exige additionalProperties: false y que todas las propiedades sean requeridas
function admiteStrict(esquema) {
  const requeridas = new Set(esquema.required || []);
  return esquema.additionalProperties === false && Object.keys(esquema.properties || {}).every((p) => requeridas.has(p));
}

function aHerramientasOpenAI(herramientas) {
  return herramientas.map((h) => ({
    type: "function",
    function: { name: h.nombre, description: h.descripcion, parameters: h.esquema, strict: admiteStrict(h.esquema) },
  }));
}

function aMensajesOpenAI(sistema, conversacion) {
  const mensajes = [{ role: "system", content: sistema }];
  for (const turno of conversacion) {
    if (turno.rol === "usuario") {
      mensajes.push({ role: "user", content: turno.texto });
    } else if (turno.rol === "asistente" && Array.isArray(turno.llamadas) && turno.llamadas.length > 0) {
      mensajes.push({
        role: "assistant",
        content: turno.texto || null,
        tool_calls: turno.llamadas.map((l) => ({
          id: l.id,
          type: "function",
          function: {
            name: l.nombre,
            arguments: typeof l.argumentosTexto === "string" ? l.argumentosTexto : JSON.stringify(l.argumentos ?? {}),
          },
        })),
      });
    } else if (turno.rol === "asistente") {
      mensajes.push({ role: "assistant", content: turno.texto });
    } else if (turno.rol === "herramienta") {
      for (const r of turno.resultados) {
        mensajes.push({
          role: "tool",
          tool_call_id: r.id,
          content: JSON.stringify(r.esError ? { error: r.contenido } : r.contenido),
        });
      }
    }
  }
  return mensajes;
}

function parsearArgumentos(texto) {
  if (typeof texto !== "string" || texto.length > MAX_ARGUMENTOS_TEXTO) return null;
  try {
    return JSON.parse(texto);
  } catch (_) {
    // null: el registro de herramientas lo rechaza como argumentos inválidos
    return null;
  }
}

function aSalida(respuesta) {
  const opcion = respuesta && Array.isArray(respuesta.choices) ? respuesta.choices[0] : null;
  const mensaje = opcion && opcion.message;
  if (!mensaje) throw ERRORES.errorModelo();
  if (opcion.finish_reason === "length") throw ERRORES.respuestaIncompleta();
  if (opcion.finish_reason === "content_filter") throw ERRORES.errorModelo();

  const llamadas = Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls : [];
  if (llamadas.length > 0) {
    if (llamadas.some((c) => c.type !== "function" || !c.function)) throw ERRORES.errorModelo();
    return {
      tipo: "herramientas",
      texto: typeof mensaje.content === "string" ? mensaje.content : "",
      llamadas: llamadas.map((c) => ({
        id: c.id,
        nombre: c.function.name,
        argumentos: parsearArgumentos(c.function.arguments),
        argumentosTexto: String(c.function.arguments ?? "").slice(0, MAX_ARGUMENTOS_TEXTO),
      })),
    };
  }
  if (typeof mensaje.content === "string" && mensaje.content.trim() !== "") return { tipo: "texto", texto: mensaje.content };
  if (typeof mensaje.refusal === "string" && mensaje.refusal.trim() !== "") return { tipo: "texto", texto: mensaje.refusal };
  throw ERRORES.errorModelo();
}

function traducirError(error) {
  if (error instanceof ErrorAgente) return error;
  if (error instanceof APIConnectionTimeoutError) return ERRORES.tiempoAgotadoModelo();
  // La API directa de OpenAI no presta servicio en el país desde el que se llama
  if (error instanceof PermissionDeniedError && error.code === "unsupported_country_region_territory") {
    return ERRORES.regionNoSoportada();
  }
  // Clave inválida, sin permiso o modelo inexistente: configuración del servidor
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError || error instanceof NotFoundError) {
    return ERRORES.modeloNoConfigurado();
  }
  // Incluye límite de solicitudes y falta de saldo (insufficient_quota)
  if (error instanceof RateLimitError) return ERRORES.limiteUsoModelo();
  return ERRORES.errorModelo();
}

/**
 * cliente: inyectable en pruebas; por defecto, el SDK oficial con tiempo límite y un reintento.
 * baseURL: solo para Azure OpenAI (API v1, mismo contrato de Chat Completions).
 */
function crearModeloOpenAI({ apiKey, modelo = MODELO_PREDETERMINADO, baseURL, cliente } = {}) {
  const sdk = cliente || new OpenAI({ apiKey, baseURL, timeout: TIEMPO_LIMITE_MS, maxRetries: REINTENTOS });
  return {
    generar: async ({ sistema, conversacion, herramientas }) => {
      const parametros = {
        model: modelo,
        messages: aMensajesOpenAI(sistema, conversacion),
        max_completion_tokens: MAX_TOKENS_SALIDA,
      };
      if (herramientas.length > 0) {
        parametros.tools = aHerramientasOpenAI(herramientas);
        parametros.tool_choice = "auto";
      }
      let respuesta;
      try {
        respuesta = await sdk.chat.completions.create(parametros);
      } catch (error) {
        throw traducirError(error);
      }
      return aSalida(respuesta);
    },
  };
}

// Endpoints de recursos de Azure OpenAI / Foundry (solo HTTPS y dominios de Azure)
const RE_HOST_AZURE = /^[a-z0-9-]+\.(openai\.azure\.com|services\.ai\.azure\.com|cognitiveservices\.azure\.com)$/;

/**
 * Configuración del proveedor según el entorno del servidor (sin efectos ni red).
 * Azure OpenAI (tiene prioridad si se configura; las tres variables son obligatorias):
 *   AZURE_OPENAI_ENDPOINT    https://<recurso>.openai.azure.com
 *   AZURE_OPENAI_API_KEY     clave del recurso de Azure
 *   AZURE_OPENAI_DEPLOYMENT  nombre del deployment del modelo
 * API directa de OpenAI:
 *   OPENAI_API_KEY  clave;  OPENAI_MODEL  modelo (opcional, MODELO_PREDETERMINADO)
 * Devuelve { proveedor: "azure" | "openai", apiKey, modelo, baseURL? } o
 * { proveedor: null, motivo } si falta o es inválida.
 */
function configuracionDesdeEntorno(entorno = process.env) {
  const leer = (nombre) => String(entorno[nombre] || "").trim();
  const endpoint = leer("AZURE_OPENAI_ENDPOINT");
  const claveAzure = leer("AZURE_OPENAI_API_KEY");
  const deployment = leer("AZURE_OPENAI_DEPLOYMENT");

  if (endpoint || claveAzure || deployment) {
    if (!endpoint || !claveAzure || !deployment) return { proveedor: null, motivo: "azure_incompleto" };
    let url;
    try {
      url = new URL(endpoint);
    } catch (_) {
      return { proveedor: null, motivo: "azure_endpoint_invalido" };
    }
    if (url.protocol !== "https:" || !RE_HOST_AZURE.test(url.hostname)) return { proveedor: null, motivo: "azure_endpoint_invalido" };
    if (!RE_MODELO.test(deployment)) return { proveedor: null, motivo: "azure_deployment_invalido" };
    // API v1 de Azure OpenAI: cliente OpenAI estándar, sin api-version, model = deployment
    return { proveedor: "azure", apiKey: claveAzure, modelo: deployment, baseURL: `https://${url.hostname}/openai/v1/` };
  }

  const apiKey = leer("OPENAI_API_KEY");
  const modelo = leer("OPENAI_MODEL") || MODELO_PREDETERMINADO;
  if (!apiKey) return { proveedor: null, motivo: "sin_clave" };
  if (!RE_MODELO.test(modelo)) return { proveedor: null, motivo: "modelo_invalido" };
  return { proveedor: "openai", apiKey, modelo };
}

function crearModeloDesdeEntorno(entorno = process.env) {
  const config = configuracionDesdeEntorno(entorno);
  if (!config.proveedor) return modeloNoConfigurado;
  return crearModeloOpenAI({ apiKey: config.apiKey, modelo: config.modelo, baseURL: config.baseURL });
}

module.exports = {
  crearModeloOpenAI,
  crearModeloDesdeEntorno,
  configuracionDesdeEntorno,
  MODELO_PREDETERMINADO,
  TIEMPO_LIMITE_MS,
  MAX_TOKENS_SALIDA,
};
