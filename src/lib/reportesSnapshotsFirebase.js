import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();
const COLLECTION = "reportes_inicio_snapshots";

export async function guardarSnapshotInicio(fechaStr, payload) {
  // payload: { count, ids, createdAt }
  if (!fechaStr) throw new Error('fechaStr requerida');
  await setDoc(doc(db, COLLECTION, fechaStr), payload, { merge: true });
}

export async function obtenerSnapshotInicio(fechaStr) {
  if (!fechaStr) return null;
  const snap = await getDoc(doc(db, COLLECTION, fechaStr));
  if (!snap.exists()) return null;
  return snap.data();
}
