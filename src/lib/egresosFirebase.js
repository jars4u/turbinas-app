import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

export async function guardarEgreso(egreso) {
  const db = getFirestore();
  await addDoc(collection(db, "egresos"), {
    ...egreso,
  fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
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
