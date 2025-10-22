import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const db = getFirestore();
const COLLECTION = "reporte_dia_inicio"; // Documento por fecha YYYY-MM-DD

/**
 * Lee el snapshot de "inicio" para una fecha.
 * @param {string} fechaStr YYYY-MM-DD
 * @returns {Promise<{inicio:number, fecha:string, createdAt?:any} | null>}
 */
export async function obtenerInicioSnapshot(fechaStr) {
  if (!fechaStr) return null;
  const ref = doc(db, COLLECTION, fechaStr);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Crea el snapshot inicial para una fecha SOLO si no existe.
 * Devuelve el valor definitivo (existente o recién creado).
 * @param {string} fechaStr YYYY-MM-DD
 * @param {number} inicioValor
 * @param {object} extras campos opcionales, p.ej. { fuente: 'auto', detalles: [...] }
 * @returns {Promise<number>} valor de inicio que quedó registrado
 */
export async function crearInicioSnapshotSiNoExiste(fechaStr, inicioValor, extras = {}) {
  if (!fechaStr || typeof inicioValor !== 'number') return 0;
  const ref = doc(db, COLLECTION, fechaStr);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return typeof data.inicio === 'number' ? data.inicio : inicioValor;
  }
  const payload = {
    fecha: fechaStr,
    inicio: inicioValor,
    createdAt: serverTimestamp(),
    ...extras,
  };
  await setDoc(ref, payload, { merge: false });
  return inicioValor;
}

/**
 * Actualiza (o crea) el snapshot para una fecha con un nuevo valor de inicio.
 * @param {string} fechaStr YYYY-MM-DD
 * @param {number} inicioValor
 * @param {object} extras campos opcionales
 * @returns {Promise<number>} valor actualizado
 */
export async function actualizarInicioSnapshot(fechaStr, inicioValor, extras = {}) {
  if (!fechaStr || typeof inicioValor !== 'number') return 0;
  const ref = doc(db, COLLECTION, fechaStr);
  const payload = {
    fecha: fechaStr,
    inicio: inicioValor,
    updatedAt: serverTimestamp(),
    ...extras,
  };
  await setDoc(ref, payload, { merge: true });
  return inicioValor;
}
