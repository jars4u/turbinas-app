import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";

// Obtiene todas las nóminas guardadas, ordenadas por fecha de guardado descendente
export async function obtenerNominas() {
  const db = getFirestore();
  const q = query(collection(db, "nominas"), orderBy("fechaGuardado", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
