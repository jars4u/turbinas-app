
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, getDocs, getDoc } from "firebase/firestore";

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

// ...existing code...

export async function crearVehiculo(data) {
  const res = await addDoc(collection(db, "vehiculos"), data);
  // Actualizar modelosServicios en el cliente correspondiente
  const nombreMayus = (data.customerName || "").toUpperCase();
  if (nombreMayus) {
    const { collection: collClientes, doc: docCliente } = await import("firebase/firestore");
    const clientesSnap = await getDocs(collClientes(db, "clientes"));
    let clienteDoc = null;
    clientesSnap.forEach(doc => {
      const nombreCliente = (doc.data().nombre || "").toUpperCase();
      if (nombreCliente === nombreMayus) {
        clienteDoc = doc;
      }
    });
    if (clienteDoc) {
      const prev = clienteDoc.data().modelosServicios || [];
      const nuevo = {
        modelo: data.vehiculo || "",
        servicio: data.servicio || "",
        fecha: data.arrivalTime || ""
      };
      const actualizados = [...prev, nuevo].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      await updateDoc(docCliente(db, "clientes", clienteDoc.id), { modelosServicios: actualizados });
    }
  }
  return res;
}

// Leer vehículos
export async function obtenerVehiculos() {
  const snapshot = await getDocs(collection(db, "vehiculos"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  return await updateDoc(ref, sanitized);
}

// Eliminar vehículo
export async function eliminarVehiculo(id) {
  return await deleteDoc(doc(db, "vehiculos", id));
}
