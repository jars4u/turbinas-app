import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";

const COLLECTION = "empleados";

export async function guardarEmpleado(empleado) {
  // Si tiene id, actualiza; si no, crea nuevo
  if (empleado.id) {
    await updateDoc(doc(db, COLLECTION, empleado.id), empleado);
    return empleado.id;
  } else {
    const ref = await addDoc(collection(db, COLLECTION), empleado);
    return ref.id;
  }
}

export async function obtenerEmpleados() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function eliminarEmpleado(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
