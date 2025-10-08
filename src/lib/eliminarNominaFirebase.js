import { getFirestore, doc, deleteDoc } from "firebase/firestore";

// Elimina una nómina por su id en la colección 'nominas'
export async function eliminarNomina(id) {
  const db = getFirestore();
  await deleteDoc(doc(db, "nominas", id));
}
