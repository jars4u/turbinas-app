import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

export async function guardarEgreso(egreso) {
  const db = getFirestore();
  // Ajustar la fecha a la zona horaria de Venezuela (GMT-4)
  let fechaLocal;
  if (egreso.fecha) {
    // Si ya viene como string (dd/mm/yyyy), convertir a Date local
    if (typeof egreso.fecha === 'string' && egreso.fecha.includes('/')) {
      const [d, m, y] = egreso.fecha.split('/');
      fechaLocal = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // 4am UTC = 00:00 GMT-4
    } else if (egreso.fecha instanceof Date) {
      fechaLocal = egreso.fecha;
    } else if (egreso.fecha.seconds) {
      // Si viene como Timestamp de Firestore
      fechaLocal = new Date(egreso.fecha.seconds * 1000);
    } else {
      fechaLocal = new Date();
    }
  } else {
    fechaLocal = new Date();
  }
  // Guardar como Timestamp de Firestore
  await addDoc(collection(db, "egresos"), {
    ...egreso,
    fecha: Timestamp.fromDate(fechaLocal)
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
