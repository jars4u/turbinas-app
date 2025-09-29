import Login from "./pages/Login";

import React, { useState } from "react";
import { obtenerUsuarios, observarUsuario, logoutUsuario } from "./lib/usuariosFirebase";
import Dashboard from "./pages/Dashboard";
import HistorialVehiculos from "./pages/HistorialVehiculos";
import Configuracion from "./pages/Configuracion";
import CierreDia from "./pages/CierreDia";
import AccesoDenegado from "./pages/AccesoDenegado";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  const [usuario, setUsuario] = useState(() => {
    const u = localStorage.getItem("usuario");
    if (!u) return null;
    try {
      return JSON.parse(u);
    } catch (e) {
      localStorage.removeItem("usuario");
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Escuchar cambios de usuario autenticado
  React.useEffect(() => {
    setLoadingAuth(true);
    const unsubscribe = observarUsuario(async (user) => {
      if (user) {
        setUsuario({ email: user.email });
        localStorage.setItem("usuario", JSON.stringify({ email: user.email }));
        // Consultar si el usuario es admin/owner en Firestore
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

  // Eliminado: handleLogin y error, ya no se usan

  const handleLogout = async () => {
    await logoutUsuario(); // Cierra sesión en Firebase
    setUsuario(null);
    setIsAdmin(false);
    setIsOwner(false);
    localStorage.removeItem("usuario");
  };

  // Componente para proteger rutas
  function ProtectedRoute({ children, skeleton }) {
    if (loadingAuth) {
      return skeleton || null;
    }
    if (!usuario) {
      return <AccesoDenegado />;
    }
    return children;
  }

  // Skeleton para la página de configuración
  const ConfigSkeleton = (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eee', marginRight: 12 }} />
        <div style={{ width: 180, height: 28, borderRadius: 6, background: '#eee' }} />
      </div>
      <div style={{ width: 140, height: 36, borderRadius: 6, background: '#eee', marginBottom: 24 }} />
      <div style={{ width: '100%', height: 48, borderRadius: 8, background: '#eee', marginBottom: 16 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
      <div style={{ width: '100%', height: 32, borderRadius: 8, background: '#eee', marginBottom: 8 }} />
    </div>
  );
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
          <ProtectedRoute skeleton={ConfigSkeleton}>
            <Configuracion usuario={usuario} isAdmin={isAdmin} isOwner={isOwner} />
          </ProtectedRoute>
        } />
        <Route path="/cierredia" element={
          <ProtectedRoute>
            <CierreDia usuario={usuario} isAdmin={isAdmin} isOwner={isOwner} />
          </ProtectedRoute>
        } />
        <Route path="/historial" element={
          <ProtectedRoute>
            <HistorialVehiculos isOwner={isOwner} />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
