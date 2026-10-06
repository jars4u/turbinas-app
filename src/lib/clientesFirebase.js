import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { leerCompartido, invalidarLectura } from "./lecturasCompartidas";

function normalizeNombre(nombre) {
  return String(nombre || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTelefono(telefono) {
  const raw = String(telefono || "").replace(/[\s-]/g, "").trim();
  if (!raw) return "";
  if (raw.startsWith("+58")) return raw;
  return "+58" + raw.replace(/^0+/, "");
}

function buildClienteKey(cliente) {
  return `${normalizeNombre(cliente?.nombre).toLowerCase()}|${normalizeTelefono(cliente?.telefono)}`;
}

export function normalizeCliente(cliente) {
  const nombre = normalizeNombre(cliente?.nombre);
  const telefono = normalizeTelefono(cliente?.telefono);

  if (!nombre) return null;

  return {
    ...cliente,
    nombre,
    telefono,
  };
}

export function normalizeClientes(clientes = []) {
  const deduped = new Map();

  (clientes || []).forEach((cliente) => {
    const normalized = normalizeCliente(cliente);
    if (!normalized) return;

    const key = buildClienteKey(normalized);
    const current = deduped.get(key);

    if (!current) {
      deduped.set(key, normalized);
      return;
    }

    const next = {
      ...current,
      ...normalized,
      id: current.id || normalized.id,
      telefono: current.telefono || normalized.telefono,
    };
    deduped.set(key, next);
  });

  return Array.from(deduped.values()).sort((left, right) => {
    const byName = left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return (left.telefono || "").localeCompare(right.telefono || "", "es", { sensitivity: "base" });
  });
}

// Peticiones simultáneas comparten una sola consulta
export function obtenerClientes() {
  return leerCompartido("clientes", async () => {
    const db = getFirestore();
    const snap = await getDocs(collection(db, "clientes"));
    return normalizeClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

export async function actualizarCliente(id, data) {
  const db = getFirestore();
  await updateDoc(doc(db, "clientes", id), data);
  invalidarLectura("clientes");
}

export async function eliminarCliente(id) {
  const db = getFirestore();
  await deleteDoc(doc(db, "clientes", id));
  invalidarLectura("clientes");
}
