"use strict";

const { ErrorAgente, ERRORES } = require("./errores");
const { definicionesParaModelo, ejecutarHerramienta } = require("./herramientas");
const { hoyCaracas } = require("./herramientas/periodo");

const MAX_PASOS = 5;
const MAX_LLAMADAS_POR_PASO = 3;
const MAX_CARACTERES_RESPUESTA = 20000;

const INSTRUCCIONES_SISTEMA = [
  "Eres el asistente de Turbinas App, un sistema de gestión de servicios para un taller de turbinas en Venezuela.",
  "Hablas con los dueños y administradores del taller: responde en español, en un tono cercano y claro, sin tecnicismos.",
  "Empieza por la respuesta directa (la cifra o el dato que piden) y luego da el contexto breve que ayude a entenderla.",
  "Escribe montos con 2 decimales e indica la moneda (USD o Bs). Usa listas con guiones para desgloses; evita tablas en Markdown.",
  "Puedes explicar conceptos, comparar, planificar y hacer proyecciones.",
  "Solo usa herramientas cuando la pregunta necesite datos reales de Turbinas App; para preguntas generales responde sin consultarlas.",
  "Herramientas disponibles:",
  "- resumen_financiero: dinero que entró (cobros) y salió (egresos, nómina), por método de pago y por cliente, y neto de un periodo.",
  "- cuentas_por_cobrar: lo que los clientes deben por servicios ya entregados.",
  "- cuentas_por_pagar: facturas de proveedores pendientes y vencimientos.",
  "- servicios_del_periodo: vehículos recibidos y entregados en un periodo, servicios más frecuentes y clientes con más servicios.",
  "- resumen_servicios_por_estado: cuántos servicios hay ahora mismo en cada estado.",
  "Periodos: si no se indica, usa el mes actual hasta hoy. Para 'hoy' usa la misma fecha en desde y hasta; para 'la semana'",
  "o 'el mes pasado' calcula las fechas a partir de la fecha de hoy. Usa fechas AAAA-MM-DD y nunca fechas futuras.",
  "Reglas de veracidad:",
  "- Presenta como 'Datos de Turbinas App' únicamente lo que devuelva una herramienta, indicando cuándo se consultó.",
  "- Señala como interpretación cualquier explicación o conclusión tuya sobre esos datos.",
  "- Señala como estimación cualquier proyección o cálculo aproximado.",
  "- Si las herramientas disponibles no permiten responder, dilo claramente; nunca inventes cifras, estados ni registros.",
  "- Si una herramienta devuelve un error, informa que no se pudieron obtener los datos.",
  "- Si el resultado trae notas (estimaciones con el factor actual, totales parciales, registros excluidos), menciónalas en",
  "  lenguaje sencillo; en particular, aclara qué parte de una cifra es estimada y con qué factor.",
].join("\n");

/** Instrucciones con la fecha de hoy en Venezuela, para interpretar "hoy", "este mes", etc. */
function instruccionesConFecha(ahora) {
  return `${INSTRUCCIONES_SISTEMA}\nHoy es ${hoyCaracas(ahora)} (hora de Venezuela, UTC-4).`;
}

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
        salida = await modelo.generar({ sistema: instruccionesConFecha(ahora ? ahora() : new Date()), conversacion, herramientas });
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
