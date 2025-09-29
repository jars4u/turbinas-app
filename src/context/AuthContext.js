import React, { createContext, useContext, useEffect, useState } from "react";
import { obtenerUsuarios, observarUsuario, logoutUsuario } from "../lib/usuariosFirebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    setLoadingAuth(true);
    const unsubscribe = observarUsuario(async (user) => {
      if (user) {
        setUsuario({ email: user.email });
        localStorage.setItem("usuario", JSON.stringify({ email: user.email }));
        const usuarios = await obtenerUsuarios();
        const usuarioFirestore = usuarios.find(u => u.email === user.email);
        setIsAdmin(usuarioFirestore?.admin === true);
        setIsOwner(usuarioFirestore?.owner === true);
      } else {
        setUsuario(null);
        setIsAdmin(false);
        setIsOwner(false);
        localStorage.removeItem("usuario");
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logoutUsuario();
    setUsuario(null);
    setIsAdmin(false);
    setIsOwner(false);
    localStorage.removeItem("usuario");
  };

  return (
    <AuthContext.Provider value={{ usuario, isAdmin, isOwner, loadingAuth, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
