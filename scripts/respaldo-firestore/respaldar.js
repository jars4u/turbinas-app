// Respalda TODA la base de Firestore (colecciones y subcolecciones) a JSON.
//
// Uso:
//   node respaldar.js <ruta-clave-cuenta-servicio.json> [carpeta-destino]
//
// Crea respaldos/<fecha-hora>/ con:
//   - un archivo .json por colección raíz (documentos con sus subcolecciones anidadas)
//   - resumen.json con la cantidad de documentos por colección
//
// Solo LEE: no modifica nada en Firestore. Cada documento cuenta como una lectura
// de la cuota diaria del plan gratuito (50.000 lecturas/día).
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { aJSON } = require("./tipos");

async function respaldarColeccion(coleccionRef, contador) {
  const snapshot = await coleccionRef.get();
  const documentos = [];
  for (const docSnap of snapshot.docs) {
    contador.total += 1;
    const subcolecciones = {};
    for (const sub of await docSnap.ref.listCollections()) {
      subcolecciones[sub.id] = await respaldarColeccion(sub, contador);
    }
    documentos.push({
      id: docSnap.id,
      datos: aJSON(docSnap.data()),
      ...(Object.keys(subcolecciones).length ? { subcolecciones } : {}),
    });
  }
  return documentos;
}

async function main() {
  const [rutaClave, destinoBase = "respaldos"] = process.argv.slice(2);
  if (!rutaClave) {
    console.error("Uso: node respaldar.js <clave-cuenta-servicio.json> [carpeta-destino]");
    process.exit(1);
  }
  const clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
  initializeApp({ credential: cert(clave) });
  const db = getFirestore();

  const marca = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = path.join(destinoBase, marca);
  fs.mkdirSync(destino, { recursive: true });

  const resumen = { proyecto: clave.project_id, fecha: new Date().toISOString(), colecciones: {} };
  const colecciones = await db.listCollections();
  for (const col of colecciones) {
    const contador = { total: 0 };
    const documentos = await respaldarColeccion(col, contador);
    fs.writeFileSync(path.join(destino, `${col.id}.json`), JSON.stringify(documentos, null, 2));
    resumen.colecciones[col.id] = contador.total;
    console.log(`  ${col.id}: ${contador.total} documentos`);
  }
  resumen.totalDocumentos = Object.values(resumen.colecciones).reduce((a, b) => a + b, 0);
  fs.writeFileSync(path.join(destino, "resumen.json"), JSON.stringify(resumen, null, 2));
  console.log(`\nRespaldo completo: ${resumen.totalDocumentos} documentos en ${destino}`);
}

main().catch((e) => {
  console.error("Error en el respaldo:", e);
  process.exit(1);
});
