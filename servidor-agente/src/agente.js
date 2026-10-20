"use strict";

const { ErrorAgente, ERRORES } = require("./errores");
const { definicionesParaModelo, ejecutarHerramienta } = require("./herramientas");

const MAX_PASOS = 4;
const MAX_LLAMADAS_POR_PASO = 3;
const MAX_CARACTERES_RESPUESTA = 20000;

const INSTRUCCIONES_SISTEMA = [
  "Eres el asistente de Turbinas App, un sistema de gestión de servicios para un taller de turbinas en Venezuela.",
  "Responde en español, con claridad. Puedes explicar conceptos, comparar, planificar y elaborar tablas o proyecciones.",
  "Solo usa herramientas cuando la pregunta necesite datos reales de Turbinas App; para preguntas generales responde sin consultarlas.",
  "Reglas de veracidad:",
  "- Presenta como 'Datos de Turbinas App' únicamente lo que devuelva una herramienta, indicando cuándo se consultó.",
  "- Señala como interpretación cualquier explicación o conclusión tuya sobre esos datos.",
  "- Señala como estimación cualquier proyección o cálculo aproximado.",
  "- Si las herramientas disponibles no permiten responder, dilo claramente; nunca inventes cifras, estados ni registros.",
  "- Si una herramienta devuelve un error, informa que no se pudieron obtener los datos.",
].join("\n");

/**
 * Contrato del adaptador de modelo (independiente del proveedor):
 *
 *   modelo.generar({ sistema, conversacion, herramientas }) -> Promise<Salida>
 *
 *   herramientas: [{ nombre, descripcion, esquema }]  (esquema = JSON Schema del input)
 *   conversacion: lista de turnos en orden:
 *     { rol: "usuario", texto }
 *     { rol: "asistente", texto, llamadas?: [{ id, nombre, argumentos }] }
 *     { rol: "herramienta", resultados: [{ id, nombre, contenido, esError }] }
 *   Salida:
 *     { tipo: "texto", texto }                                   respuesta final
 *     { tipo: "herramientas", texto?, llamadas: [{ id, nombre, argumentos }] }
 *
 * El adaptador traduce este formato al del proveedor (definiciones de herramientas,
 * bloques de uso y de resultado). El modelo decide si llama herramientas; el
 * servidor las ejecuta, nunca el modelo.
 */
function crearAgente({ modelo, fuente, ahora }) {
  if (!modelo || typeof modelo.generar !== "function") throw new Error("Adaptador de modelo inválido");

  async function responder({ mensajes }) {
    const conversacion = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    const consultas = [];
    const herramientas = definicionesParaModelo();

    for (let paso = 0; paso < MAX_PASOS; paso += 1) {
      let salida;
      try {
        salida = await modelo.generar({ sistema: INSTRUCCIONES_SISTEMA, conversacion, herramientas });
      } catch (error) {
        if (error instanceof ErrorAgente) throw error;
        throw ERRORES.errorModelo();
      }

      if (salida && salida.tipo === "texto" && typeof salida.texto === "string") {
        return { texto: salida.texto.slice(0, MAX_CARACTERES_RESPUESTA), consultas };
      }
      if (!salida || salida.tipo !== "herramientas" || !Array.isArray(salida.llamadas) || salida.llamadas.length === 0) {
        throw ERRORES.errorModelo();
      }

      const llamadas = salida.llamadas.slice(0, MAX_LLAMADAS_POR_PASO);
      conversacion.push({ rol: "asistente", texto: typeof salida.texto === "string" ? salida.texto : "", llamadas });
      const resultados = [];
      for (const llamada of llamadas) {
        const r = await ejecutarHerramienta(llamada && llamada.nombre, llamada && llamada.argumentos, { fuente, ahora });
        const esError = Boolean(r.error);
        resultados.push({ id: llamada && llamada.id, nombre: llamada && llamada.nombre, contenido: esError ? r.error : r.resultado, esError });
        consultas.push(esError
          ? { herramienta: String((llamada && llamada.nombre) || "").slice(0, 60), error: r.error }
          : { herramienta: llamada.nombre, resultado: r.resultado });
      }
      conversacion.push({ rol: "herramienta", resultados });
    }
    throw ERRORES.limiteIteraciones();
  }

  return { responder };
}

module.exports = { crearAgente, INSTRUCCIONES_SISTEMA, MAX_PASOS };
