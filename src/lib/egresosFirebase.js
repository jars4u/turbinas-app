import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

export async function guardarEgreso(egreso) {
  const db = getFirestore();
  await addDoc(collection(db, "egresos"), {
    ...egreso,
    fecha: Timestamp.now(),
  });
}

export async function obtenerEgresos() {
  const db = getFirestore();
  const snapshot = await getDocs(collection(db, "egresos"));
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      fecha: data.fecha, // Devuelve el Timestamp directamente
    };
  });
}
