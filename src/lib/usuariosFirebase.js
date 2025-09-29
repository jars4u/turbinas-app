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


// Eliminar usuario de Firestore y Auth
export async function eliminarUsuario({ id, email }) {
  // Eliminar de Firestore
  await deleteDoc(doc(db, "usuarios", id));

  // Eliminar de Auth usando la API REST de Firebase
  // Necesitamos la API key
  const apiKey = (auth.app && auth.app.options && auth.app.options.apiKey) || process.env.REACT_APP_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API key de Firebase");

  // Buscar el uid del usuario por email usando la API REST de Firebase
  // 1. Obtener el idToken de un usuario admin (el actual)
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No hay usuario autenticado");
  const idToken = await currentUser.getIdToken();

  // 2. Buscar el usuario por email
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const lookupRes = await fetch(lookupUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ email: [email] }),
  });
  const lookupData = await lookupRes.json();
  if (!lookupRes.ok || !lookupData.users || !lookupData.users[0]) {
    // Si no se encuentra el usuario en Auth, ya está eliminado
    return;
  }
  const uid = lookupData.users[0].localId;

  // 3. Eliminar el usuario de Auth
  const deleteUrl = `https://identitytoolkit.googleapis.com/v1/projects/${auth.app.options.projectId}/accounts:delete`;
  await fetch(deleteUrl + `?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ localId: uid }),
  });
}
