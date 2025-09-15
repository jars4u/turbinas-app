import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { collection, getDocs, updateDoc, doc, deleteDoc, setDoc } from "firebase/firestore";

// Registrar usuario (email y clave)
export async function registrarUsuario(email, password, extraData = {}) {
  // Crear usuario sin cambiar la sesión actual usando la API REST de Firebase Auth
  // Obtener la API key desde el objeto de configuración de Firebase
  const apiKey = (auth.app && auth.app.options && auth.app.options.apiKey) || process.env.REACT_APP_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("No se encontró la API key de Firebase. Verifica la configuración.");
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Error al crear usuario");
  }
  // Guardar datos extra en Firestore (roles, nombre, etc)
  await setDoc(doc(db, "usuarios", data.localId), {
    email,
    ...extraData,
  });
  return { uid: data.localId, email, ...extraData };
}

// Login
export function loginUsuario(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Logout
export function logoutUsuario() {
  return signOut(auth);
}

// Obtener usuario actual
export function observarUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

// Leer usuarios (solo admins o para gestión)
export async function obtenerUsuarios() {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Actualizar usuario (roles, datos extra)
export async function actualizarUsuario(id, data) {
  return await updateDoc(doc(db, "usuarios", id), data);
}

// Eliminar usuario
export async function eliminarUsuario(id) {
  return await deleteDoc(doc(db, "usuarios", id));
}
