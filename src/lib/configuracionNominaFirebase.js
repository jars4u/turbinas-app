import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();
const CONFIG_DOC = "configuracion_nomina";

export async function guardarConfiguracionNomina({ diasSemanaLaboral }) {
  await setDoc(doc(db, CONFIG_DOC, "general"), { diasSemanaLaboral }, { merge: true });
}

export async function obtenerConfiguracionNomina() {
  const snap = await getDoc(doc(db, CONFIG_DOC, "general"));
  if (snap.exists()) {
    return snap.data();
  }
  return { diasSemanaLaboral: 5 };
}
