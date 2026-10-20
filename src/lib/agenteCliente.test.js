/* Cliente del agente: contrato de la solicitud y errores legibles (sin red real) */
import { ErrorAgente, enviarConversacion, prepararConversacion } from "./agenteCliente";

const URL = "https://agente.ejemplo.test/agente";
const obtenerToken = async () => "token.sintetico.firma";
const respuestaHttp = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });
const historial = [{ rol: "usuario", texto: "¿Cuántos servicios hay en cada estado?" }];

test("sin URL configurada no se llama al servidor", async () => {
  const fetchImpl = jest.fn();
  await expect(enviarConversacion(historial, { url: "", obtenerToken, fetchImpl })).rejects.toMatchObject({ codigo: "agente_no_configurado" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("envía el token y solo rol/texto; devuelve la respuesta", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(respuestaHttp(200, { respuesta: { texto: "Hay 10 servicios.", consultas: [] } }));
  const conConsultas = [...historial, { rol: "asistente", texto: "x", consultas: [{ herramienta: "y" }] }, { rol: "usuario", texto: "¿y ahora?" }];
  const r = await enviarConversacion(conConsultas, { url: URL, obtenerToken, fetchImpl });
  expect(r).toEqual({ texto: "Hay 10 servicios.", consultas: [] });
  const [url, opciones] = fetchImpl.mock.calls[0];
  expect(url).toBe(URL);
  expect(opciones.method).toBe("POST");
  expect(opciones.headers.Authorization).toBe("Bearer token.sintetico.firma");
  expect(JSON.parse(opciones.body)).toEqual({
    mensajes: [
      { rol: "usuario", texto: "¿Cuántos servicios hay en cada estado?" },
      { rol: "asistente", texto: "x" },
      { rol: "usuario", texto: "¿y ahora?" },
    ],
  });
});

test.each([
  [401, "no_autenticado", /sesión/],
  [403, "sin_permiso", /owner o admin/],
  [400, "solicitud_invalida", /No se pudo procesar/],
  [503, "modelo_no_configurado", /modelo de IA configurado/],
  [502, "error_modelo", /no respondió correctamente/],
  [500, "codigo_que_no_existe", /error inesperado/],
])("HTTP %i → mensaje legible", async (status, codigo, texto) => {
  const fetchImpl = jest.fn().mockResolvedValue(respuestaHttp(status, { error: { codigo, mensaje: "detalle del servidor" } }));
  const error = await enviarConversacion(historial, { url: URL, obtenerToken, fetchImpl }).catch((e) => e);
  expect(error).toBeInstanceOf(ErrorAgente);
  expect(error.message).toMatch(texto);
});

test("503 autenticacion_no_configurada: problema del servidor, sin pedir volver a iniciar sesión", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(respuestaHttp(503, { error: { codigo: "autenticacion_no_configurada", mensaje: "x" } }));
  const error = await enviarConversacion(historial, { url: URL, obtenerToken, fetchImpl }).catch((e) => e);
  expect(error.codigo).toBe("autenticacion_no_configurada");
  expect(error.message).toMatch(/servidor del agente no pudo verificar/);
  expect(error.message).toMatch(/No necesitas volver a iniciar sesión/);
  expect(error.message).not.toMatch(/Vuelve a iniciar sesión/);
});

test("fallo de red y respuesta con formato inesperado", async () => {
  await expect(enviarConversacion(historial, { url: URL, obtenerToken, fetchImpl: jest.fn().mockRejectedValue(new Error("offline")) }))
    .rejects.toMatchObject({ codigo: "red" });
  await expect(enviarConversacion(historial, { url: URL, obtenerToken, fetchImpl: jest.fn().mockResolvedValue(respuestaHttp(200, { otra: 1 })) }))
    .rejects.toMatchObject({ codigo: "respuesta_invalida" });
});

test("mensaje demasiado largo: se rechaza antes de enviar", async () => {
  const fetchImpl = jest.fn();
  await expect(enviarConversacion([{ rol: "usuario", texto: "x".repeat(4001) }], { url: URL, obtenerToken, fetchImpl }))
    .rejects.toMatchObject({ codigo: "solicitud_demasiado_grande" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("prepararConversacion respeta los límites y empieza por un mensaje del usuario", () => {
  const largo = Array.from({ length: 25 }, (_, i) => ({ rol: i % 2 ? "asistente" : "usuario", texto: `m${i}` }));
  const ventana = prepararConversacion(largo);
  expect(ventana.length).toBeLessThanOrEqual(20);
  expect(ventana[0].rol).toBe("usuario");
  expect(ventana[ventana.length - 1].texto).toBe("m24");
});
