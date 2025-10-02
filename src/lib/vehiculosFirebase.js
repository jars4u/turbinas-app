
import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from "firebase/firestore";

// Sanitiza cualquier undefined en null, recursivamente
function sanitizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(k => {
      const val = obj[k];
      if (val === undefined) {
        newObj[k] = null;
      } else {
        newObj[k] = sanitizeDeep(val);
      }
    });
    return newObj;
  }
  return obj;
}

// Crear vehículo
export async function crearVehiculo(data) {
  return await addDoc(collection(db, "vehiculos"), data);
}

// Leer vehículos
// Escuchar vehículos en tiempo real
export function escucharVehiculos(callback) {
  return onSnapshot(collection(db, "vehiculos"), (snapshot) => {
    const vehiculos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(vehiculos);
  });
}

// Obtener vehículos una sola vez (legacy)
export async function obtenerVehiculos() {
  const snapshot = await getDocs(collection(db, "vehiculos"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Actualizar vehículo con historial de cambios
export async function actualizarVehiculo(id, data, usuario = "") {
  const ref = doc(db, "vehiculos", id);
  // Leer el documento actual
  const { getDoc, arrayUnion } = await import("firebase/firestore");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Si no existe, solo actualiza
    return await updateDoc(ref, data);
  }
  const actual = snap.data();
  const historial = Array.isArray(actual.historial) ? actual.historial : [];
  const ahora = Date.now();
  const cambios = [];
  // Detectar cambios campo a campo
  Object.keys(data).forEach((campo) => {
    if (campo === "historial") return; // No auditar el propio historial
    const valorAnterior = actual[campo];
    const valorNuevo = data[campo];
    if (valorAnterior !== valorNuevo) {
      cambios.push({
        fecha: ahora,
        usuario: usuario || data.usuario || actual.usuario || "",
        campo,
        valorAnterior,
        valorNuevo,
        descripcion: `Cambio en '${campo}'`,
      });
    }
  });
  // Si hay cambios, agregarlos al historial
  let nuevoHistorial = historial;
  if (cambios.length > 0) {
    nuevoHistorial = [...historial, ...cambios];
  }
  // Actualizar el documento con los nuevos datos y el historial
  const sanitized = sanitizeDeep({ ...data, historial: nuevoHistorial });
  return await updateDoc(ref, sanitized);
}

// Eliminar vehículo
export async function eliminarVehiculo(id) {
  return await deleteDoc(doc(db, "vehiculos", id));
}
