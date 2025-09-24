import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const db = getFirestore();
const CONFIG_DOC = "configuracionCajaChica";
const CONFIG_COLLECTION = "configuracion";

export async function guardarFondoCajaChica(monto) {
  // Guarda el fondo como número con dos decimales
  await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC), {
    fondoCajaChica: Number(Number(monto).toFixed(2)),
    actualizado: new Date().toISOString()
  });
}

export async function obtenerFondoCajaChica() {
  const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().fondoCajaChica ?? 0;
  }
  return 0;
}
