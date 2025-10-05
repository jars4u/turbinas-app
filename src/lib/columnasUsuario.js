import { db, auth } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Guarda la configuración de columnas visibles para el usuario actual
export async function guardarColumnasUsuario(columnasVisibles) {
  const user = auth.currentUser;
  if (!user) return;
  const ref = doc(db, "columnasUsuario", user.uid);
  await setDoc(ref, { columnasVisibles }, { merge: true });
}

// Obtiene la configuración de columnas visibles para el usuario actual
export async function obtenerColumnasUsuario() {
  const user = auth.currentUser;
  if (!user) return null;
  const ref = doc(db, "columnasUsuario", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().columnasVisibles;
  }
  return null;
}
