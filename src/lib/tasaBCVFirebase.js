import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();
const TASA_DOC_ID = "tasaBCV";
const TASA_COLLECTION = "configuracion";

export async function guardarTasaBCV(valor) {
  await setDoc(
    doc(db, TASA_COLLECTION, TASA_DOC_ID),
    { valor, fecha: new Date().toISOString() },
    { merge: true }
  );
}

export async function guardarTasaEURBCV(valorEUR) {
  await setDoc(
    doc(db, TASA_COLLECTION, TASA_DOC_ID),
    { valorEUR: Number(valorEUR), fechaEUR: new Date().toISOString() },
    { merge: true }
  );
}

export async function obtenerTasaBCV() {
  const docSnap = await getDoc(doc(db, TASA_COLLECTION, TASA_DOC_ID));
  if (docSnap.exists()) {
    return docSnap.data().valor;
  }
  return null;
}

export async function obtenerTasaEURBCV() {
  const docSnap = await getDoc(doc(db, TASA_COLLECTION, TASA_DOC_ID));
  if (docSnap.exists()) {
    const { valorEUR } = docSnap.data();
    return valorEUR != null ? valorEUR : null;
  }
  return null;
}
