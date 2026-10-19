// Restaura un respaldo hecho con respaldar.js.
//
// Uso:
//   node restaurar.js <clave-cuenta-servicio.json> <carpeta-respaldo> [--coleccion=nombre] [--aplicar]
//
// Por defecto es una SIMULACIÓN: solo informa qué escribiría. Para escribir de
// verdad hay que pasar --aplicar.
//
// Escribe cada documento con su mismo ID (set completo), así que sobrescribe la
// versión actual de esos documentos. No borra documentos que no estén en el respaldo.
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { desdeJSON } = require("./tipos");

const LOTE = 400; // Firestore permite hasta 500 escrituras por lote

async function main() {
  const args = process.argv.slice(2);
  const [rutaClave, carpeta] = args.filter((a) => !a.startsWith("--"));
  const aplicar = args.includes("--aplicar");
  const soloColeccion = (args.find((a) => a.startsWith("--coleccion=")) || "").split("=")[1];
  if (!rutaClave || !carpeta) {
    console.error("Uso: node restaurar.js <clave.json> <carpeta-respaldo> [--coleccion=nombre] [--aplicar]");
    process.exit(1);
  }
  const clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
  initializeApp({ credential: cert(clave) });
  const db = getFirestore();

  const escrituras = [];
  const recorrer = (coleccionPath, documentos) => {
    for (const d of documentos) {
      const ref = db.collection(coleccionPath).doc(d.id);
      escrituras.push({ ref, datos: desdeJSON(d.datos, db) });
      for (const [sub, docsSub] of Object.entries(d.subcolecciones || {})) {
        recorrer(`${ref.path}/${sub}`, docsSub);
      }
    }
  };

  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".json") && f !== "resumen.json");
  for (const archivo of archivos) {
    const coleccion = path.basename(archivo, ".json");
    if (soloColeccion && coleccion !== soloColeccion) continue;
    recorrer(coleccion, JSON.parse(fs.readFileSync(path.join(carpeta, archivo), "utf8")));
  }

  console.log(`${escrituras.length} documentos a restaurar${soloColeccion ? ` (colección ${soloColeccion})` : ""}.`);
  if (!aplicar) {
    console.log("Simulación: no se escribió nada. Agrega --aplicar para restaurar.");
    return;
  }
  for (let i = 0; i < escrituras.length; i += LOTE) {
    const lote = db.batch();
    escrituras.slice(i, i + LOTE).forEach(({ ref, datos }) => lote.set(ref, datos));
    await lote.commit();
    console.log(`  ${Math.min(i + LOTE, escrituras.length)}/${escrituras.length}`);
  }
  console.log("Restauración completa.");
}

main().catch((e) => {
  console.error("Error en la restauración:", e);
  process.exit(1);
});
