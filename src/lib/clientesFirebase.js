import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

export async function obtenerClientes() {
  const db = getFirestore();
  const snap = await getDocs(collection(db, "clientes"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function actualizarCliente(id, data) {
  const db = getFirestore();
  await updateDoc(doc(db, "clientes", id), data);
}

export async function eliminarCliente(id) {
  const db = getFirestore();
  await deleteDoc(doc(db, "clientes", id));
}
