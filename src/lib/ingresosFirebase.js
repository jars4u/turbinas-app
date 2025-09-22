import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

export async function guardarIngreso(ingreso) {
  const mov = { ...ingreso, fecha: Timestamp.fromDate(new Date()) };
  await addDoc(collection(db, INGRESOS_COLLECTION), mov);
}

export async function obtenerIngresos() {
  const snapshot = await getDocs(collection(db, INGRESOS_COLLECTION));
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        ...data,
        fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate().toLocaleDateString('es-VE') : '',
        fechaRaw: data.fecha && data.fecha.toDate ? data.fecha.toDate() : null,
        id: doc.id
      };
    })
    .sort((a, b) => (b.fechaRaw?.getTime() || 0) - (a.fechaRaw?.getTime() || 0));
}
