import React, { createContext, useContext, useEffect, useState } from "react";
import { observarUsuario, logoutUsuario } from "../lib/usuariosFirebase";
import { db } from "../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    setLoadingAuth(true);
    let userDocUnsub = null;
    const unsubscribe = observarUsuario(async (user) => {
      // Cancelar suscripción previa al cambiar de usuario
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (user) {
        const baseInfo = { email: user.email, uid: user.uid };
        setUsuario(baseInfo);
        localStorage.setItem("usuario", JSON.stringify(baseInfo));

        const userDocRef = doc(db, "usuarios", user.uid);

        // Intentar lectura inicial por si aún no existe el doc
        try {
          const snap = await getDoc(userDocRef);
          const data = snap.data() || {};
          setIsAdmin(!!data.admin);
          setIsOwner(!!data.owner);
          setIsObserver(!!data.observer);
        } catch (e) {
          setIsAdmin(false);
          setIsOwner(false);
          setIsObserver(false);
        }

        // Suscribirse a cambios en tiempo real del documento de roles
        userDocUnsub = onSnapshot(
          userDocRef,
          (snapshot) => {
            const data = snapshot.data() || {};
            setIsAdmin(!!data.admin);
            setIsOwner(!!data.owner);
            setIsObserver(!!data.observer);
            setLoadingAuth(false);
          },
          () => {
            setIsAdmin(false);
            setIsOwner(false);
            setIsObserver(false);
            setLoadingAuth(false);
          }
        );
      } else {
        setUsuario(null);
        setIsAdmin(false);
        setIsOwner(false);
        setIsObserver(false);
        localStorage.removeItem("usuario");
        setLoadingAuth(false);
      }
    });
    return () => {
      if (userDocUnsub) userDocUnsub();
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await logoutUsuario();
    setUsuario(null);
    setIsAdmin(false);
    setIsOwner(false);
    setIsObserver(false);
    localStorage.removeItem("usuario");
  };

  return (
    <AuthContext.Provider value={{ usuario, isAdmin, isOwner, isObserver, loadingAuth, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
