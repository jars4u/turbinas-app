"use strict";

const { ErrorAgente, ERRORES } = require("./errores");
const { LIMITES, validarSolicitud } = require("./contrato");
const { autorizar } = require("./autorizacion");

/**
 * Manejador independiente de la plataforma.
 *   manejar({ metodo, authorization, cuerpo }) -> { estado, cuerpo }
 * Orden: método -> identidad y rol (servidor) -> validación -> agente.
 * Un usuario sin rol owner/admin no llega a validar ni a invocar al agente.
 * El registro solo recibe códigos y duraciones, nunca mensajes ni datos.
 */
function crearManejador({ autenticacion, crearAgenteParaSolicitud, registrar = () => {} }) {
  async function manejar({ metodo, authorization, cuerpo }) {
    const inicio = Date.now();
    try {
      if (metodo !== "POST") throw ERRORES.metodoNoPermitido();
      await autorizar(authorization, autenticacion, registrar);
      const solicitud = validarSolicitud(cuerpo);
      const respuesta = await crearAgenteParaSolicitud().responder(solicitud);
      registrar({ evento: "respuesta", estado: 200, herramientas: respuesta.consultas.map((c) => c.herramienta), ms: Date.now() - inicio });
      return { estado: 200, cuerpo: { respuesta } };
    } catch (error) {
      const controlado = error instanceof ErrorAgente ? error : ERRORES.interno();
      registrar({ evento: "error", estado: controlado.estado, codigo: controlado.codigo, ms: Date.now() - inicio });
      return { estado: controlado.estado, cuerpo: { error: { codigo: controlado.codigo, mensaje: controlado.message } } };
    }
  }
  return { manejar };
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    // Cloud Functions y Vercel ya consumen el stream y entregan el cuerpo en req.body
    if (req.body !== undefined) {
      if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return resolve({ texto: req.body.toString("utf8") });
      if (JSON.stringify(req.body).length > LIMITES.bytesCuerpo) return reject(ERRORES.solicitudDemasiadoGrande());
      return resolve({ parseado: req.body });
    }
    const partes = [];
    let bytes = 0;
    req.on("data", (trozo) => {
      bytes += trozo.length;
      if (bytes > LIMITES.bytesCuerpo) {
        reject(ERRORES.solicitudDemasiadoGrande());
        req.destroy();
        return;
      }
      partes.push(trozo);
    });
    req.on("end", () => resolve({ texto: Buffer.concat(partes).toString("utf8") }));
    req.on("error", () => reject(ERRORES.solicitudInvalida("No se pudo leer la solicitud.")));
  });
}

/**
 * Adaptador a la firma estándar de Node (req, res), común a Cloud Functions
 * (onRequest) y a funciones de Vercel. origenesPermitidos: orígenes del frontend.
 */
function crearManejadorHttp(manejador, { origenesPermitidos = [] } = {}) {
  return async function (req, res) {
    const origen = req.headers && req.headers.origin;
    if (origen && origenesPermitidos.includes(origen)) {
      res.setHeader("Access-Control-Allow-Origin", origen);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    let cuerpo;
    try {
      const leido = await leerCuerpo(req);
      if (leido.parseado !== undefined) cuerpo = leido.parseado;
      else if (Buffer.byteLength(leido.texto) > LIMITES.bytesCuerpo) throw ERRORES.solicitudDemasiadoGrande();
      else cuerpo = JSON.parse(leido.texto || "null");
    } catch (error) {
      const e = error instanceof ErrorAgente ? error : ERRORES.solicitudInvalida("El cuerpo no es JSON válido.");
      res.statusCode = e.estado;
      return res.end(JSON.stringify({ error: { codigo: e.codigo, mensaje: e.message } }));
    }

    const { estado, cuerpo: salida } = await manejador.manejar({
      metodo: req.method,
      authorization: req.headers && req.headers.authorization,
      cuerpo,
    });
    res.statusCode = estado;
    return res.end(JSON.stringify(salida));
  };
}

module.exports = { crearManejador, crearManejadorHttp };
