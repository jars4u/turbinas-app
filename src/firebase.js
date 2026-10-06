import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDl43vMgKdjhEoRvTaRypXfB550mJodwn8",
  authDomain: "turbinas-app.firebaseapp.com",
  projectId: "turbinas-app",
  storageBucket: "turbinas-app.firebasestorage.app",
  messagingSenderId: "426432572123",
  appId: "1:426432572123:web:8649b3b0f4367de7923afe",
  measurementId: "G-NK57VGFL4M"
};

const app = initializeApp(firebaseConfig);
// Caché persistente en IndexedDB (compartida entre pestañas): los listeners pintan
// de inmediato con los datos locales y luego sincronizan con el servidor.
// Si IndexedDB no está disponible, Firestore cae solo a caché en memoria.
// Debe inicializarse antes de cualquier getFirestore() (los módulos de lib lo usan).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Mantener la sesión abierta hasta cerrar sesión explícitamente.
// Prioriza IndexedDB; si no está disponible, cae a localStorage y luego a sessionStorage.
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  ],
});