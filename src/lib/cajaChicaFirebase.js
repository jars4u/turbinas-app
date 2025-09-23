import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

const db = getFirestore();
const MOVIMIENTOS_COLLECTION = "cajaChicaMovimientos";

export async function guardarMovimientoCajaChica(movimiento) {
  // Guardar con fecha como Timestamp
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const mov = { ...movimiento, fecha: fechaStr };
  await addDoc(collection(db, MOVIMIENTOS_COLLECTION), mov);
}

export async function obtenerMovimientosCajaChica() {
  const snapshot = await getDocs(collection(db, MOVIMIENTOS_COLLECTION));
  // Ordenar por fecha descendente
  const docs = snapshot.docs
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
  return docs;
}
