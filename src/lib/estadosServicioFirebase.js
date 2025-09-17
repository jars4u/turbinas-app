import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc
} from "firebase/firestore";

const COLLECTION = "estadosServicio";

export async function obtenerEstadosServicio() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function agregarEstadoServicio(data) {
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id, ...data };
}

export async function actualizarEstadoServicio(id, data) {
  await updateDoc(doc(db, COLLECTION, id), data);
  return { id, ...data };
}

export async function eliminarEstadoServicio(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
