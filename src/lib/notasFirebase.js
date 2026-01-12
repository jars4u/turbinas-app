import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const NOTAS_COLLECTION = "notas";

// Escuchar notas por usuario (email)
export function escucharNotasPorUsuario(usuarioEmail, onNext, onError) {
  if (!usuarioEmail) return () => {};
  // Evitamos orderBy para no requerir índice compuesto.
  const q = query(
    collection(db, NOTAS_COLLECTION),
    where("usuarioEmail", "==", usuarioEmail)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordenar en cliente por createdAt (Timestamp) descendente
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      onNext(items);
    },
    (err) => onError?.(err)
  );
}

// Crear nota
export async function crearNota(usuarioEmail, text) {
  if (!usuarioEmail) throw new Error("Usuario no válido");
  const docRef = await addDoc(collection(db, NOTAS_COLLECTION), {
    usuarioEmail,
    text,
    createdAt: serverTimestamp(),
    updatedAt: null,
  });
  return docRef.id;
}

// Actualizar nota
export async function actualizarNota(id, text) {
  if (!id) throw new Error("ID no válido");
  await updateDoc(doc(db, NOTAS_COLLECTION, id), {
    text,
    updatedAt: serverTimestamp(),
  });
}

// Eliminar nota
export async function eliminarNota(id) {
  if (!id) throw new Error("ID no válido");
  await deleteDoc(doc(db, NOTAS_COLLECTION, id));
}
