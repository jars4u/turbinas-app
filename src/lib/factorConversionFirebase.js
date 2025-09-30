import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();
const FACTOR_DOC_ID = "factorConversion";
const CONFIG_COLLECTION = "configuracion";

export async function guardarFactorConversion(valor) {
  await setDoc(doc(db, CONFIG_COLLECTION, FACTOR_DOC_ID), {
    valor: Number(valor),
    fecha: new Date().toISOString(),
  });
}

export async function obtenerFactorConversion() {
  const docSnap = await getDoc(doc(db, CONFIG_COLLECTION, FACTOR_DOC_ID));
  if (docSnap.exists()) {
    return docSnap.data().valor;
  }
  return 1;
}
