import { getFirestore, collection, getDocs, addDoc, Timestamp } from "firebase/firestore";

export async function obtenerCierresDiarios() {
  const db = getFirestore();
  const ref = collection(db, "cierresDiarios");
  const snapshot = await getDocs(ref);
  // Mapear los documentos a objetos
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Guarda un cierre diario en la colección 'cierresDiarios'
export async function guardarCierreDiario({ fecha, tasa, totalIngresosUSD, totalIngresosBs, totalEgresosUSD, totalEgresosBs, utilidadUSD, utilidadBs, observaciones = "", usuario = "" }) {
  const db = getFirestore();
  // fecha debe ser string 'dd/mm/yyyy' o Timestamp
  const cierre = {
    fecha: fecha || new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    fechaTimestamp: Timestamp.now(),
    tasa: Number(tasa),
    totalIngresosUSD: Number(totalIngresosUSD),
    totalIngresosBs: Number(totalIngresosBs),
    totalEgresosUSD: Number(totalEgresosUSD),
    totalEgresosBs: Number(totalEgresosBs),
    utilidadUSD: Number(utilidadUSD),
    utilidadBs: Number(utilidadBs),
    observaciones,
    usuario,
  };
  await addDoc(collection(db, "cierresDiarios"), cierre);
  return cierre;
}
