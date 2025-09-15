import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";

// Crear vehículo
export async function crearVehiculo(data) {
  return await addDoc(collection(db, "vehiculos"), data);
}

// Leer vehículos
export async function obtenerVehiculos() {
  const snapshot = await getDocs(collection(db, "vehiculos"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Actualizar vehículo
export async function actualizarVehiculo(id, data) {
  return await updateDoc(doc(db, "vehiculos", id), data);
}

// Eliminar vehículo
export async function eliminarVehiculo(id) {
  return await deleteDoc(doc(db, "vehiculos", id));
}
