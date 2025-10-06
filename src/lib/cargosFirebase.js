import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

const db = getFirestore();
const cargosCollection = collection(db, "cargos");

export async function crearCargo(cargo) {
  // cargo: { nombre, salario, tipo }
  return await addDoc(cargosCollection, cargo);
}

export async function obtenerCargos() {
  const snapshot = await getDocs(cargosCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function actualizarCargo(id, cargo) {
  return await updateDoc(doc(db, "cargos", id), cargo);
}

export async function eliminarCargo(id) {
  return await deleteDoc(doc(db, "cargos", id));
}
