import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

export async function guardarIngreso(ingreso) {
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const mov = { ...ingreso, fecha: fechaStr };
  await addDoc(collection(db, INGRESOS_COLLECTION), mov);
}

export async function obtenerIngresos() {
  const snapshot = await getDocs(collection(db, INGRESOS_COLLECTION));
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      let fechaStr = '';
      let fechaRaw = null;
      if (data.fecha && typeof data.fecha === 'string') {
        // Si es string, normalizar a dd/mm/yyyy
        const parts = data.fecha.split(/[/-]/);
        if (parts.length === 3) {
          fechaStr = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
          // Para ordenar, crear un objeto Date
          fechaRaw = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else {
          fechaStr = data.fecha;
          fechaRaw = Date.parse(data.fecha) ? new Date(data.fecha) : null;
        }
      } else if (data.fecha && data.fecha.toDate) {
        // Si es Timestamp
        fechaRaw = data.fecha.toDate();
        fechaStr = fechaRaw.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
      return {
        ...data,
        fecha: fechaStr,
        fechaRaw,
        id: doc.id
      };
    })
  .sort((a, b) => (a.fechaRaw?.getTime() || 0) - (b.fechaRaw?.getTime() || 0));
}
