import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();
const CONFIG_DOC = "configuracion_reporte";

export async function guardarConfiguracionReporte(config) {
  // config espera un objeto con claves por seccion, e.g. { inicio: [...], registrados: [...], entregados: [...], pendientes: [...] }
  await setDoc(doc(db, CONFIG_DOC, "general"), config, { merge: true });
}

export async function obtenerConfiguracionReporte() {
  const snap = await getDoc(doc(db, CONFIG_DOC, "general"));
  if (snap.exists()) {
    return snap.data();
  }
  // valores por defecto vacíos
  return { inicio: [], registrados: [], entregados: [], pendientes: [], inicioModo: 'timestamp' };
}
