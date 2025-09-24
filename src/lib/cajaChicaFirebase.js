import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

const db = getFirestore();
const MOVIMIENTOS_COLLECTION = "cajaChicaMovimientos";

export async function guardarMovimientoCajaChica(movimiento) {
  // Guardar con fecha como Timestamp
  const mov = { ...movimiento, fecha: Timestamp.now() };
  await addDoc(collection(db, MOVIMIENTOS_COLLECTION), mov);
}

export async function obtenerMovimientosCajaChica() {
  const snapshot = await getDocs(collection(db, MOVIMIENTOS_COLLECTION));
  // Ordenar por fecha descendente
  const docs = snapshot.docs
    .map(doc => {
      const data = doc.data();
      let fechaStr = "";
      let fechaRaw = null;
      if (data.fecha && typeof data.fecha.toDate === "function") {
        fechaRaw = data.fecha.toDate();
        fechaStr = fechaRaw.toLocaleDateString('es-VE');
      } else if (typeof data.fecha === "string") {
        fechaStr = data.fecha;
        fechaRaw = Date.parse(data.fecha) ? new Date(data.fecha) : null;
      }
      return {
        ...data,
        fecha: fechaStr,
        fechaRaw,
        id: doc.id
      };
    })
    .sort((a, b) => (b.fechaRaw?.getTime() || 0) - (a.fechaRaw?.getTime() || 0));
  return docs;
}
