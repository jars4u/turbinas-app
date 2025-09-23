import { getFirestore, collection, getDocs } from "firebase/firestore";

export async function obtenerCierresDiarios() {
  const db = getFirestore();
  const ref = collection(db, "cierresDiarios");
  const snapshot = await getDocs(ref);
  // Mapear los documentos a objetos
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
