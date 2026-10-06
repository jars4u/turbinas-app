import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { observarUsuario, logoutUsuario } from "../lib/usuariosFirebase";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

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
    const unsubscribe = observarUsuario((user) => {
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

        // Suscribirse a cambios en tiempo real del documento de roles.
        // La primera emisión cubre la lectura inicial (también si el doc no existe),
        // así que no hace falta un getDoc previo que retrase la suscripción.
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

  const handleLogout = useCallback(async () => {
    await logoutUsuario();
    setUsuario(null);
    setIsAdmin(false);
    setIsOwner(false);
    setIsObserver(false);
    localStorage.removeItem("usuario");
  }, []);

  // Valor memoizado: los consumidores solo se re-renderizan cuando algo cambia de verdad
  const value = useMemo(
    () => ({ usuario, isAdmin, isOwner, isObserver, loadingAuth, handleLogout }),
    [usuario, isAdmin, isOwner, isObserver, loadingAuth, handleLogout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
