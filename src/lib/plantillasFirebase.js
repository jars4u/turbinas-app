import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

const COLLECTION = "plantillasMensajes";

export async function obtenerPlantillas() {
  const db = getFirestore();
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, mensaje: d.data().mensaje, nombre: d.data().nombre }));
}

export async function agregarPlantilla({ mensaje, nombre }) {
  const db = getFirestore();
  const ref = await addDoc(collection(db, COLLECTION), { mensaje, nombre });
  return { id: ref.id, mensaje, nombre };
}

export async function editarPlantilla(id, { mensaje, nombre }) {
  const db = getFirestore();
  await updateDoc(doc(db, COLLECTION, id), { mensaje, nombre });
}

export async function eliminarPlantilla(id) {
  const db = getFirestore();
  await deleteDoc(doc(db, COLLECTION, id));
}
