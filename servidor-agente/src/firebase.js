"use strict";

/**
 * Dependencias reales con firebase-admin (solo lectura). Se cargan bajo demanda
 * para que las pruebas no necesiten el SDK ni credenciales.
 * Credenciales: las predeterminadas de la plataforma (Cloud Functions / Cloud Run)
 * o FIREBASE_SERVICE_ACCOUNT_JSON en el entorno del servidor (nunca en el frontend).
 * Recomendado: cuenta de servicio con roles/datastore.viewer y roles/firebaseauth.viewer.
 *
 * Las lecturas son fijas: el modelo nunca elige colecciones, campos ni filtros.
 * Cada una proyecta solo los campos que usan las herramientas, tiene un tope de
 * documentos (informa si se truncó) y una caché corta por instancia para no
 * repetir lecturas cuando el agente usa varias herramientas en una pregunta.
 */
const TOPE_DOCUMENTOS = 20000;
// 5 minutos: una conversación reutiliza lo leído y no gasta la cuota diaria de Firestore
const CACHE_MS = 5 * 60 * 1000;

const CAMPOS = {
  ingresosMovimientos: ["fecha", "formasPago", "formaPago", "monto", "montoUSD", "montoBs", "usdEquiv", "factorConversion", "cuentaPorCobrarId", "customerName", "customerPhone", "cliente", "fechaServicio", "servicio", "vehiculo"],
  egresos: ["fecha", "fechaStr", "montoUSD", "montoBs", "tasaFactura", "tasa", "tipo", "divisa", "monedaFactura", "items"],
  nominas: ["fechaInicio", "fechaFin", "fechaGuardado", "empleados", "total", "totalNomina", "montoTotal"],
  metodosPago: ["clave", "nombre", "moneda", "activo", "orden"],
  cuentasPorCobrar: ["customerName", "customerPhone", "cliente", "servicio", "vehiculo", "placa", "precio", "precioBs", "fechaRegistro", "arrivalTime", "status"],
  cuentasPorPagar: ["proveedor", "documento", "concepto", "descripcion", "montoUSD", "montoBs", "monedaFactura", "tasaFactura", "vencimiento", "fecha", "items"],
  vehiculos: ["servicio", "vehiculo", "customerName", "customerPhone", "status", "estado", "precio", "arrivalTime", "fechaEntrega"],
};

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

  const cache = new Map();
  function enCache(clave, leer) {
    const ahora = Date.now();
    const guardado = cache.get(clave);
    if (guardado && ahora - guardado.momento < CACHE_MS) return guardado.promesa;
    const promesa = leer().catch((error) => {
      cache.delete(clave);
      throw error;
    });
    cache.set(clave, { momento: ahora, promesa });
    return promesa;
  }

  /** { docs: [{ id, ...campos }], truncado } */
  async function proyectar(consulta) {
    const snap = await consulta.limit(TOPE_DOCUMENTOS).get();
    return { docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), truncado: snap.size >= TOPE_DOCUMENTOS };
  }

  const coleccionCompleta = (nombre) =>
    enCache(nombre, () => proyectar(db.collection(nombre).select(...CAMPOS[nombre])));

  const vehiculosPorRango = (campo, inicioMs, finMs) =>
    enCache(`vehiculos:${campo}:${inicioMs}:${finMs}`, () =>
      proyectar(db.collection("vehiculos").where(campo, ">=", inicioMs).where(campo, "<=", finMs).select(...CAMPOS.vehiculos)));

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
      leerIngresos: () => coleccionCompleta("ingresosMovimientos"),
      leerEgresos: () => coleccionCompleta("egresos"),
      leerNominas: () => coleccionCompleta("nominas"),
      leerMetodosPago: () => coleccionCompleta("metodosPago"),
      leerCuentasPorCobrar: () => coleccionCompleta("cuentasPorCobrar"),
      leerCuentasPorPagar: () => coleccionCompleta("cuentasPorPagar"),
      leerConfigFactor: () =>
        enCache("configuracion:factorConversion", async () => {
          const [snap] = await db.getAll(db.collection("configuracion").doc("factorConversion"), { fieldMask: ["modo", "valorManual", "valor"] });
          return snap && snap.exists ? snap.data() : null;
        }),
      leerVehiculosRegistrados: (inicioMs, finMs) => vehiculosPorRango("arrivalTime", inicioMs, finMs),
      leerVehiculosEntregados: (inicioMs, finMs) => vehiculosPorRango("fechaEntrega", inicioMs, finMs),
    },
  };
}

module.exports = { crearDependenciasFirebase, CAMPOS, TOPE_DOCUMENTOS };
