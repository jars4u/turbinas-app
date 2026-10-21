"use strict";

// Adaptador OpenAI con un cliente SIMULADO: ninguna prueba llama a la API real.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APIConnectionTimeoutError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
} = require("openai");
const { crearModeloOpenAI, crearModeloDesdeEntorno, MODELO_PREDETERMINADO, MAX_TOKENS_SALIDA } = require("../src/modelo/openai");
const { modeloNoConfigurado } = require("../src/modelo/noConfigurado");
const { crearAgente, MAX_PASOS } = require("../src/agente");
const { crearManejador } = require("../src/manejador");
const { TOKEN, autenticacionSimulada, fuenteSimulada } = require("./ayudas");

const CLAVE = "sk-SINTETICA-NO-REAL-123";
const AHORA = () => new Date("2026-10-20T15:00:00Z");
const pregunta = (texto) => ({ mensajes: [{ rol: "usuario", texto }] });

/** Cliente con la forma de sdk.chat.completions.create que devuelve respuestas en orden. */
function clienteSimulado(respuestas) {
  const solicitudes = [];
  return {
    solicitudes,
    chat: {
      completions: {
        create: async (parametros) => {
          solicitudes.push(JSON.parse(JSON.stringify(parametros)));
          const r = respuestas.shift();
          if (r instanceof Error) throw r;
          return r;
        },
      },
    },
  };
}

const texto = (contenido, finish = "stop") => ({ choices: [{ finish_reason: finish, message: { role: "assistant", content: contenido } }] });
const llamada = (args = "{}", nombre = "resumen_servicios_por_estado", id = "call_1") => ({
  choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name: nombre, arguments: args } }] } }],
});

function agenteCon(respuestas, fuente = fuenteSimulada()) {
  const cliente = clienteSimulado(respuestas);
  const agente = crearAgente({ modelo: crearModeloOpenAI({ cliente }), fuente, ahora: AHORA });
  return { agente, cliente, fuente };
}

test("configuración ausente o inválida: adaptador 'no configurado' con error controlado", async () => {
  assert.equal(crearModeloDesdeEntorno({}), modeloNoConfigurado);
  assert.equal(crearModeloDesdeEntorno({ OPENAI_API_KEY: "   " }), modeloNoConfigurado);
  assert.equal(crearModeloDesdeEntorno({ OPENAI_API_KEY: CLAVE, OPENAI_MODEL: "modelo con espacios" }), modeloNoConfigurado);
  await assert.rejects(modeloNoConfigurado.generar({}), (e) => e.codigo === "modelo_no_configurado" && e.estado === 503);
  // Con clave se construye el adaptador real, sin hacer ninguna llamada
  const real = crearModeloDesdeEntorno({ OPENAI_API_KEY: CLAVE });
  assert.notEqual(real, modeloNoConfigurado);
  assert.equal(typeof real.generar, "function");
});

test("pregunta general: responde sin ejecutar herramientas", async () => {
  const { agente, cliente, fuente } = agenteCon([texto("Una turbina es una máquina rotativa…")]);
  const r = await agente.responder(pregunta("¿Qué es una turbina?"));
  assert.deepEqual(r, { texto: "Una turbina es una máquina rotativa…", consultas: [] });
  assert.deepEqual(fuente.llamadas, []);
  const [solicitud] = cliente.solicitudes;
  assert.equal(solicitud.model, MODELO_PREDETERMINADO);
  assert.equal(solicitud.max_completion_tokens, MAX_TOKENS_SALIDA);
  assert.equal(solicitud.tool_choice, "auto");
  assert.equal(solicitud.messages[0].role, "system");
  assert.match(solicitud.messages[0].content, /nunca inventes cifras/);
  assert.deepEqual(solicitud.messages[1], { role: "user", content: "¿Qué es una turbina?" });
  assert.deepEqual(solicitud.tools[0], {
    type: "function",
    function: {
      name: "resumen_servicios_por_estado",
      description: solicitud.tools[0].function.description,
      parameters: { type: "object", properties: {}, additionalProperties: false },
      strict: true,
    },
  });
  // Con argumentos opcionales (desde/hasta) no se usa strict: OpenAI lo exige con todos requeridos
  const financiero = solicitud.tools.find((t) => t.function.name === "resumen_financiero");
  assert.equal(financiero.function.strict, false);
  assert.deepEqual(Object.keys(financiero.function.parameters.properties), ["desde", "hasta", "agruparPor", "cliente", "telefono"]);
});

test("pregunta de datos: invoca la herramienta registrada y devuelve su resultado al modelo", async () => {
  const { agente, cliente, fuente } = agenteCon([llamada(), texto("Datos de Turbinas App: 10 servicios en total.")]);
  const r = await agente.responder(pregunta("¿Cuántos servicios hay por estado?"));
  assert.equal(r.texto, "Datos de Turbinas App: 10 servicios en total.");
  assert.equal(r.consultas[0].resultado.totalServicios, 10);
  assert.ok(fuente.llamadas.includes("contarVehiculos"));

  const mensajes = cliente.solicitudes[1].messages;
  assert.deepEqual(mensajes[2], {
    role: "assistant",
    content: null,
    tool_calls: [{ id: "call_1", type: "function", function: { name: "resumen_servicios_por_estado", arguments: "{}" } }],
  });
  assert.equal(mensajes[3].role, "tool");
  assert.equal(mensajes[3].tool_call_id, "call_1");
  assert.equal(JSON.parse(mensajes[3].content).totalServicios, 10);
});

test("argumentos inválidos o herramienta no registrada: no se consultan datos y el modelo recibe el error", async () => {
  for (const [args, nombre, codigo] of [
    ["{no es json", "resumen_servicios_por_estado", "argumentos_invalidos"],
    ['{"coleccion":"usuarios"}', "resumen_servicios_por_estado", "argumentos_invalidos"],
    ["{}", "leer_firestore", "herramienta_desconocida"],
  ]) {
    const { agente, cliente, fuente } = agenteCon([llamada(args, nombre), texto("No pude obtener esos datos.")]);
    const r = await agente.responder(pregunta("x"));
    assert.equal(r.consultas[0].error.codigo, codigo);
    assert.deepEqual(fuente.llamadas, []);
    const resultadoHerramienta = cliente.solicitudes[1].messages.find((m) => m.role === "tool");
    assert.equal(JSON.parse(resultadoHerramienta.content).error.codigo, codigo);
    // Se devuelve al modelo la llamada tal como la hizo (también si no era JSON válido)
    assert.equal(cliente.solicitudes[1].messages[2].tool_calls[0].function.arguments, args);
  }
});

test("límite de iteraciones: un modelo que solo pide herramientas se corta tras MAX_PASOS", async () => {
  const { agente, cliente } = agenteCon(Array.from({ length: MAX_PASOS + 3 }, () => llamada()));
  await assert.rejects(agente.responder(pregunta("x")), (e) => e.codigo === "limite_iteraciones");
  assert.equal(cliente.solicitudes.length, MAX_PASOS);
});

test("errores del proveedor y respuestas incompletas: errores controlados sin secretos", async () => {
  const conClave = `Incorrect API key provided: ${CLAVE}`;
  const casos = [
    [new APIConnectionTimeoutError(), "modelo_tiempo_agotado", 504],
    [new RateLimitError(429, { message: conClave, code: "insufficient_quota" }, conClave, new Headers()), "modelo_limite_uso", 503],
    [new AuthenticationError(401, { message: conClave }, conClave, new Headers()), "modelo_no_configurado", 503],
    [new NotFoundError(404, { message: "model not found" }, "model not found", new Headers()), "modelo_no_configurado", 503],
    [new InternalServerError(500, { message: conClave }, conClave, new Headers()), "error_modelo", 502],
    [new Error(conClave), "error_modelo", 502],
    [texto("respuesta cortad", "length"), "respuesta_incompleta", 502],
    [texto("", "content_filter"), "error_modelo", 502],
    [{ choices: [] }, "error_modelo", 502],
    [texto(""), "error_modelo", 502],
  ];
  for (const [respuesta, codigo, estado] of casos) {
    const { agente } = agenteCon([respuesta]);
    const error = await agente.responder(pregunta("x")).catch((e) => e);
    assert.equal(error.codigo, codigo, codigo);
    assert.equal(error.estado, estado);
    assert.ok(!JSON.stringify({ m: error.message, c: error.codigo }).includes(CLAVE));
  }
});

test("de extremo a extremo por el manejador: owner obtiene datos y el error no expone la clave", async () => {
  const fuente = fuenteSimulada();
  const respuestas = [llamada(), texto("Hay 10 servicios.")];
  const manejador = crearManejador({
    autenticacion: autenticacionSimulada(),
    crearAgenteParaSolicitud: () => crearAgente({ modelo: crearModeloOpenAI({ cliente: clienteSimulado(respuestas) }), fuente, ahora: AHORA }),
  });
  const ok = await manejador.manejar({ metodo: "POST", authorization: `Bearer ${TOKEN}`, cuerpo: pregunta("¿Cuántos servicios hay por estado?") });
  assert.equal(ok.estado, 200);
  assert.equal(ok.cuerpo.respuesta.consultas[0].resultado.totalServicios, 10);

  const fallo = crearManejador({
    autenticacion: autenticacionSimulada(),
    crearAgenteParaSolicitud: () => crearAgente({
      modelo: crearModeloOpenAI({ cliente: clienteSimulado([new AuthenticationError(401, { message: CLAVE }, CLAVE, new Headers())]) }),
      fuente,
    }),
  });
  const r = await fallo.manejar({ metodo: "POST", authorization: `Bearer ${TOKEN}`, cuerpo: pregunta("hola") });
  assert.equal(r.estado, 503);
  assert.ok(!JSON.stringify(r).includes(CLAVE));
});

const { PermissionDeniedError } = require("openai");
const { configuracionDesdeEntorno } = require("../src/modelo/openai");

const AZURE = {
  AZURE_OPENAI_ENDPOINT: "https://recurso-sintetico.openai.azure.com/",
  AZURE_OPENAI_API_KEY: "clave-azure-sintetica",
  AZURE_OPENAI_DEPLOYMENT: "gpt-4-1-mini-turbinas",
};

test("Azure OpenAI: API v1 con baseURL del recurso y el deployment como modelo", () => {
  assert.deepEqual(configuracionDesdeEntorno(AZURE), {
    proveedor: "azure",
    apiKey: "clave-azure-sintetica",
    modelo: "gpt-4-1-mini-turbinas",
    baseURL: "https://recurso-sintetico.openai.azure.com/openai/v1/",
  });
  // Se normaliza el endpoint aunque traiga ruta; también recursos de Foundry
  assert.equal(configuracionDesdeEntorno({ ...AZURE, AZURE_OPENAI_ENDPOINT: "https://recurso-sintetico.openai.azure.com/openai/v1" }).baseURL,
    "https://recurso-sintetico.openai.azure.com/openai/v1/");
  assert.equal(configuracionDesdeEntorno({ ...AZURE, AZURE_OPENAI_ENDPOINT: "https://recurso.services.ai.azure.com" }).proveedor, "azure");
  // Azure tiene prioridad sobre la API directa de OpenAI
  assert.equal(configuracionDesdeEntorno({ ...AZURE, OPENAI_API_KEY: CLAVE }).proveedor, "azure");
  const modelo = crearModeloDesdeEntorno(AZURE);
  assert.notEqual(modelo, modeloNoConfigurado);
});

test("Azure OpenAI: configuración incompleta o endpoint fuera de Azure → no configurado", () => {
  const casos = [
    [{ AZURE_OPENAI_ENDPOINT: AZURE.AZURE_OPENAI_ENDPOINT }, "azure_incompleto"],
    [{ ...AZURE, AZURE_OPENAI_API_KEY: "" }, "azure_incompleto"],
    [{ ...AZURE, AZURE_OPENAI_ENDPOINT: "http://recurso-sintetico.openai.azure.com" }, "azure_endpoint_invalido"],
    [{ ...AZURE, AZURE_OPENAI_ENDPOINT: "https://atacante.example.com" }, "azure_endpoint_invalido"],
    [{ ...AZURE, AZURE_OPENAI_ENDPOINT: "https://openai.azure.com.atacante.example" }, "azure_endpoint_invalido"],
    [{ ...AZURE, AZURE_OPENAI_ENDPOINT: "no es url" }, "azure_endpoint_invalido"],
    [{ ...AZURE, AZURE_OPENAI_DEPLOYMENT: "nombre con espacios" }, "azure_deployment_invalido"],
    [{}, "sin_clave"],
  ];
  for (const [entorno, motivo] of casos) {
    assert.deepEqual(configuracionDesdeEntorno(entorno), { proveedor: null, motivo }, motivo);
    assert.equal(crearModeloDesdeEntorno(entorno), modeloNoConfigurado);
  }
});

test("OpenAI rechaza la región: error propio y controlado, distinto de 'no configurado'", async () => {
  const region = new PermissionDeniedError(403, { code: "unsupported_country_region_territory", type: "request_forbidden", message: "Country, region, or territory not supported" }, "Country not supported", new Headers());
  const { agente } = agenteCon([region]);
  const error = await agente.responder(pregunta("x")).catch((e) => e);
  assert.deepEqual([error.codigo, error.estado], ["proveedor_region_no_soportada", 503]);

  const otro = new PermissionDeniedError(403, { code: "otra_cosa", message: CLAVE }, CLAVE, new Headers());
  const error2 = await agenteCon([otro]).agente.responder(pregunta("x")).catch((e) => e);
  assert.equal(error2.codigo, "modelo_no_configurado");
  assert.ok(!error2.message.includes(CLAVE));
});
