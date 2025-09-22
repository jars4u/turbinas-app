import Login from "./pages/Login";

import React, { useState } from "react";
import { obtenerUsuarios, observarUsuario, logoutUsuario } from "./lib/usuariosFirebase";
import Dashboard from "./pages/Dashboard";
import Historial from "./pages/historial";
import Configuracion from "./pages/Configuracion";
import CierreDia from "./pages/CierreDia";
import AccesoDenegado from "./pages/AccesoDenegado";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  const [usuario, setUsuario] = useState(() => localStorage.getItem("usuario") || null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Escuchar cambios de usuario autenticado
  React.useEffect(() => {
    const unsubscribe = observarUsuario(async (user) => {
      if (user) {
        setUsuario(user.email);
        localStorage.setItem("usuario", user.email);
        // Consultar si el usuario es admin en Firestore
        const usuarios = await obtenerUsuarios();
        const usuarioFirestore = usuarios.find(u => u.email === user.email);
        setIsAdmin(usuarioFirestore?.admin === true);
      } else {
        setUsuario(null);
        setIsAdmin(false);
        localStorage.removeItem("usuario");
      }
    });
    return () => unsubscribe();
  }, []);

  // Eliminado: handleLogin y error, ya no se usan

  const handleLogout = async () => {
    await logoutUsuario(); // Cierra sesión en Firebase
    setUsuario(null);
    setIsAdmin(false);
    localStorage.removeItem("usuario");
  };

  // Componente para proteger rutas
  function ProtectedRoute({ children }) {
    if (!usuario) {
      return <AccesoDenegado />;
    }
    return children;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard usuario={usuario} onLogout={handleLogout} />
          </ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute>
            <Configuracion usuario={usuario} isAdmin={isAdmin} />
          </ProtectedRoute>
        } />
        <Route path="/cierredia" element={
          <ProtectedRoute>
            <CierreDia />
          </ProtectedRoute>
        } />
        <Route path="/historial" element={
          <ProtectedRoute>
            <Historial />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
