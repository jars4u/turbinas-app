"use strict";

// Función de Vercel (Node) del Agente de IA: POST /api/agente.
// Se ejecuta en la región fijada en vercel.json (iad1, EE. UU.); la llamada a OpenAI
// sale de esta función, nunca del navegador. Configuración en las variables de
// entorno del proyecto en Vercel (ver servidor-agente/README.md):
//   OPENAI_API_KEY, OPENAI_MODEL, FIREBASE_SERVICE_ACCOUNT_JSON.
// Cada solicitud verifica el ID token y el rol owner/admin en el servidor.
const { crearServicioAgente } = require("../servidor-agente/src");

let servicio = null;

module.exports = (req, res) => {
  // Se crea una vez por instancia, con las variables de entorno de Vercel
  if (!servicio) {
    servicio = crearServicioAgente({
      // Registros de Vercel: solo eventos y códigos, nunca mensajes, tokens ni claves
      registrar: (registro) => console.log(JSON.stringify(registro)),
    });
  }
  return servicio(req, res);
};
