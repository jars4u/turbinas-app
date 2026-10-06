import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc
} from "firebase/firestore";
import { leerCompartido, invalidarLectura } from "./lecturasCompartidas";

const COLLECTION = "estadosServicio";

// Los estados cambian muy poco y solo se escriben desde este módulo: se cachean
// un minuto y se invalidan en cada alta/edición/baja.
const CLAVE = "estadosServicio";
const TTL_ESTADOS_MS = 60 * 1000;

export function obtenerEstadosServicio() {
  return leerCompartido(
    CLAVE,
    async () => {
      const snapshot = await getDocs(collection(db, COLLECTION));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    { ttlMs: TTL_ESTADOS_MS }
  );
}

export async function agregarEstadoServicio(data) {
  const ref = await addDoc(collection(db, COLLECTION), data);
  invalidarLectura(CLAVE);
  return { id: ref.id, ...data };
}

export async function actualizarEstadoServicio(id, data) {
  await updateDoc(doc(db, COLLECTION, id), data);
  invalidarLectura(CLAVE);
  return { id, ...data };
}

export async function eliminarEstadoServicio(id) {
  await deleteDoc(doc(db, COLLECTION, id));
  invalidarLectura(CLAVE);
}
