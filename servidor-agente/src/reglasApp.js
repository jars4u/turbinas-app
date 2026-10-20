"use strict";

// Reglas financieras de la propia app (src/lib), cargadas tal cual para no
// duplicarlas: el agente calcula igual que la pantalla de Reportes.
// Las fechas de solo día de la app se interpretan en hora local; el servidor
// trabaja en hora de Venezuela para que "hoy" y "este mes" coincidan con la app.
process.env.TZ = "America/Caracas";

let carga = null;

function cargarReglasApp() {
  if (!carga) {
    carga = Promise.all([
      import("../../src/lib/finanzas.js"),
      import("../../src/lib/reportesUtils.js"),
      import("../../src/lib/metodosPago.js"),
    ]).then(([finanzas, reportes, metodos]) => ({ finanzas, reportes, metodos }));
  }
  return carga;
}

module.exports = { cargarReglasApp };
