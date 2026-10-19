// Conversión entre valores de Firestore y JSON sin perder los tipos especiales.
// Timestamp, GeoPoint, referencias y bytes se guardan como objetos etiquetados
// con "__tipo" para poder reconstruirlos exactamente al restaurar.
const { Timestamp, GeoPoint, DocumentReference } = require("firebase-admin/firestore");

function aJSON(valor) {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Timestamp) {
    return { __tipo: "timestamp", seconds: valor.seconds, nanoseconds: valor.nanoseconds };
  }
  if (valor instanceof GeoPoint) {
    return { __tipo: "geopoint", latitude: valor.latitude, longitude: valor.longitude };
  }
  if (valor instanceof DocumentReference) {
    return { __tipo: "referencia", path: valor.path };
  }
  if (Buffer.isBuffer(valor) || valor instanceof Uint8Array) {
    return { __tipo: "bytes", base64: Buffer.from(valor).toString("base64") };
  }
  if (Array.isArray(valor)) return valor.map(aJSON);
  if (typeof valor === "object") {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = aJSON(v);
    return salida;
  }
  return valor;
}

function desdeJSON(valor, db) {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map((v) => desdeJSON(v, db));
  if (typeof valor === "object") {
    switch (valor.__tipo) {
      case "timestamp":
        return new Timestamp(valor.seconds, valor.nanoseconds);
      case "geopoint":
        return new GeoPoint(valor.latitude, valor.longitude);
      case "referencia":
        return db.doc(valor.path);
      case "bytes":
        return Buffer.from(valor.base64, "base64");
      default: {
        const salida = {};
        for (const [k, v] of Object.entries(valor)) salida[k] = desdeJSON(v, db);
        return salida;
      }
    }
  }
  return valor;
}

module.exports = { aJSON, desdeJSON };
