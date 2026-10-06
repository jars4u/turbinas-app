
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, getDocs, getDoc } from "firebase/firestore";
import { leerCompartido, invalidarLectura } from "./lecturasCompartidas";

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

// Crear vehículo. El historial del cliente (modelosServicios) lo registra quien
// llama (Dashboard), con una consulta filtrada en lugar de leer toda la colección.
export async function crearVehiculo(data) {
  const res = await addDoc(collection(db, "vehiculos"), data);
  invalidarLectura("vehiculos");
  return res;
}

// Leer vehículos (peticiones simultáneas comparten una sola consulta)
export function obtenerVehiculos() {
  return leerCompartido("vehiculos", async () => {
    const snapshot = await getDocs(collection(db, "vehiculos"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
}

// Escuchar vehículos en tiempo real
export function escucharVehiculos(callback) {
  return onSnapshot(collection(db, "vehiculos"), (snapshot) => {
    const vehiculos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(vehiculos);
  });
}

// Actualizar vehículo con historial de cambios
export async function actualizarVehiculo(id, data, usuario = "") {
  const ref = doc(db, "vehiculos", id);
  // Leer el documento actual
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
  const res = await updateDoc(ref, sanitized);
  invalidarLectura("vehiculos");
  return res;
}

// Eliminar vehículo
export async function eliminarVehiculo(id) {
  const res = await deleteDoc(doc(db, "vehiculos", id));
  invalidarLectura("vehiculos");
  return res;
}
