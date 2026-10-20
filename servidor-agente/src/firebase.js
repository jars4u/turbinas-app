"use strict";

/**
 * Dependencias reales con firebase-admin (solo lectura). Se cargan bajo demanda
 * para que las pruebas no necesiten el SDK ni credenciales.
 * Credenciales: las predeterminadas de la plataforma (Cloud Functions / Cloud Run)
 * o FIREBASE_SERVICE_ACCOUNT_JSON en el entorno del servidor (nunca en el frontend).
 * Recomendado: cuenta de servicio con permisos de lectura (roles/datastore.viewer)
 * más verificación de tokens de Firebase Auth.
 */
function crearDependenciasFirebase({ entorno = process.env } = {}) {
  const { initializeApp, getApps, cert, applicationDefault } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore } = require("firebase-admin/firestore");

  const NOMBRE_APP = "servidor-agente";
  const existente = getApps().find((a) => a.name === NOMBRE_APP);
  const credencial = entorno.FIREBASE_SERVICE_ACCOUNT_JSON
    ? cert(JSON.parse(entorno.FIREBASE_SERVICE_ACCOUNT_JSON))
    : applicationDefault();
  const app = existente || initializeApp({ credential: credencial, projectId: entorno.FIREBASE_PROJECT_ID }, NOMBRE_APP);
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    autenticacion: {
      // checkRevoked: un token de una sesión revocada no sirve
      verificarToken: (token) => auth.verifyIdToken(token, true),
      leerUsuario: async (uid) => {
        const snap = await db.collection("usuarios").doc(uid).get();
        return snap.exists ? snap.data() : null;
      },
    },
    fuente: {
      leerEstadosServicio: async () => {
        const snap = await db.collection("estadosServicio").select("nombre", "label", "defaultFacturar", "dejarDeMostrar").limit(51).get();
        return snap.docs.map((d) => d.data());
      },
      contarVehiculos: async () => (await db.collection("vehiculos").count().get()).data().count,
      contarVehiculosConStatus: async (status) =>
        (await db.collection("vehiculos").where("status", "==", status).count().get()).data().count,
    },
  };
}

module.exports = { crearDependenciasFirebase };
