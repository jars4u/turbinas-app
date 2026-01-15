import { getFirestore, collection, doc, setDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";

export async function upsertProveedor({ proveedor, rifCi }) {
  const db = getFirestore();
  const nombre = (proveedor || "").trim().toUpperCase();
  const rif = (rifCi || "").trim().toUpperCase();
  if (!nombre) return;

  const id = nombre; // clave por nombre de proveedor en mayúsculas
  const ref = doc(collection(db, "proveedores"), id);
  await setDoc(
    ref,
    {
      proveedor: nombre,
      rifCi: rif || null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function obtenerProveedores() {
  const db = getFirestore();
  const q = query(collection(db, "proveedores"), orderBy("proveedor"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}
