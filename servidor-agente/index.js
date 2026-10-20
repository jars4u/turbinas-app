"use strict";

// Punto de entrada para Cloud Functions de Firebase (2.ª gen.), región us-central1.
// La llamada a OpenAI sale de este servidor; el navegador solo habla con la función.
//   - OPENAI_API_KEY: secreto de Cloud Secret Manager (firebase functions:secrets:set).
//   - OPENAI_MODEL y AGENTE_ORIGENES_PERMITIDOS: variables no secretas (.env del directorio).
//   - Firebase Admin usa la cuenta de servicio de ejecución de la función.
// La seguridad no depende de que la función sea pública: cada solicitud verifica el
// ID token y el rol owner/admin en el servidor (src/autorizacion.js).
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { crearServicioAgente } = require("./src");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

let servicio = null;

exports.agente = onRequest(
  {
    region: "us-central1",
    secrets: [OPENAI_API_KEY],
    invoker: "public",
    // Límite de instancias y de tiempo para acotar costes
    maxInstances: 2,
    concurrency: 10,
    timeoutSeconds: 180,
    memory: "256MiB",
  },
  (req, res) => {
    // Se crea en la primera solicitud: el secreto solo existe en tiempo de ejecución
    if (!servicio) {
      servicio = crearServicioAgente({
        entorno: { ...process.env, OPENAI_API_KEY: OPENAI_API_KEY.value() },
        // Cloud Logging: solo eventos y códigos, nunca mensajes, tokens ni claves
        registrar: (registro) => console.log(JSON.stringify(registro)),
      });
    }
    return servicio(req, res);
  }
);
