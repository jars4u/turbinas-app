"use strict";

// Utilidades de prueba: datos SINTÉTICOS, sin Firebase ni proveedor de IA.
// De firebase-admin solo se usan sus clases de error (no se inicializa ninguna app).
const { FirebaseAuthError, AuthClientErrorCode } = require("firebase-admin/auth");

const TOKEN = "aaa.bbb.ccc";

const USUARIOS = {
  "uid-owner": { owner: true },
  "uid-admin": { admin: true },
  "uid-observador": { observer: true },
  "uid-admin-texto": { admin: "true" },
};

function autenticacionSimulada({ usuarios = USUARIOS, tokens = { [TOKEN]: "uid-owner" } } = {}) {
  return {
    verificarToken: async (token) => {
      // Lo que lanza firebase-admin ante un token que no verifica
      if (!(token in tokens)) throw new FirebaseAuthError(AuthClientErrorCode.INVALID_ARGUMENT, "Firebase ID token has invalid signature.");
      return { uid: tokens[token] };
    },
    leerUsuario: async (uid) => usuarios[uid] || null,
  };
}

/** Fuente de solo lectura que registra cada llamada. */
function fuenteSimulada({ estados, total, porStatus, falla = false } = {}) {
  const llamadas = [];
  return {
    llamadas,
    leerEstadosServicio: async () => {
      llamadas.push("leerEstadosServicio");
      if (falla) throw new Error("fallo sintético");
      return estados ?? [
        { nombre: "proceso", label: "En proceso" },
        { nombre: "entregado", label: "Entregado", dejarDeMostrar: true },
        { nombre: "pagado", label: "Pagado", defaultFacturar: true },
      ];
    },
    contarVehiculos: async () => {
      llamadas.push("contarVehiculos");
      return total ?? 10;
    },
    contarVehiculosConStatus: async (status) => {
      llamadas.push(`contarVehiculosConStatus:${status}`);
      return (porStatus ?? { proceso: 3, entregado: 5, pagado: 1 })[status] ?? 0;
    },
  };
}

/** Modelo simulado: recibe una lista de salidas y las devuelve en orden. */
function modeloSimulado(salidas) {
  const entradas = [];
  return {
    entradas,
    generar: async (entrada) => {
      entradas.push(JSON.parse(JSON.stringify(entrada)));
      const siguiente = salidas.shift();
      if (siguiente instanceof Error) throw siguiente;
      if (typeof siguiente === "function") return siguiente(entrada);
      return siguiente;
    },
  };
}

module.exports = { TOKEN, USUARIOS, autenticacionSimulada, fuenteSimulada, modeloSimulado };
