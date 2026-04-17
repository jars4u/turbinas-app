import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

function normalizarFechaEgreso(fecha) {
  // Ajustar la fecha a la zona horaria de Venezuela (GMT-4)
  // - Si viene string dd/mm/yyyy: 4am UTC = 00:00 GMT-4
  // - Si viene Date: se usa tal cual
  // - Si viene Timestamp-like: se convierte
  if (!fecha) return Timestamp.fromDate(new Date());

  let fechaLocal;

  if (typeof fecha === "string" && fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    fechaLocal = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
  } else if (fecha instanceof Date) {
    fechaLocal = fecha;
  } else if (fecha?.seconds) {
    fechaLocal = new Date(fecha.seconds * 1000);
  } else if (typeof fecha?.toDate === "function") {
    fechaLocal = fecha.toDate();
  } else {
    fechaLocal = new Date();
  }

  return Timestamp.fromDate(fechaLocal);
}

export async function guardarEgreso(egreso) {
  const db = getFirestore();

  await addDoc(collection(db, "egresos"), {
    ...egreso,
    fecha: normalizarFechaEgreso(egreso?.fecha),
  });
}

export async function guardarGastoDia(gasto) {
  // Helper para guardar gastos del día con tipo fijo
  return guardarEgreso({ ...gasto, tipo: 'gastoDia' });
}

export async function actualizarEgreso(id, egreso) {
  const db = getFirestore();
  if (!id) throw new Error("actualizarEgreso: id requerido");

  await updateDoc(doc(db, "egresos", id), {
    ...egreso,
    ...(egreso && "fecha" in egreso ? { fecha: normalizarFechaEgreso(egreso.fecha) } : {}),
  });
}

export async function eliminarEgreso(id) {
  const db = getFirestore();
  if (!id) return;
  await deleteDoc(doc(db, "egresos", id));
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
