import { getFirestore, collection, addDoc, Timestamp } from "firebase/firestore";

// Guarda una nómina en la colección 'nominas' de Firestore
export async function guardarNomina(nomina) {
  const db = getFirestore();
  // Agrega fecha de guardado
  const payload = {
    ...nomina,
    fechaGuardado: Timestamp.now(),
  };
  await addDoc(collection(db, "nominas"), payload);
}
