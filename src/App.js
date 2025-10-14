import Login from "./pages/Login";
import Inventario from "./pages/Inventario";
import CalculoNominaPage from "./pages/CalculoNomina";

import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import HistorialVehiculos from "./pages/HistorialVehiculos";
import Configuracion from "./pages/Configuracion";
import CierreDia from "./pages/CierreDia";
import AccesoDenegado from "./pages/AccesoDenegado";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { usuario, isAdmin, isOwner, loadingAuth, handleLogout } = useAuth();
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
        <Route path="/inventario" element={
          <ProtectedRoute>
            <Inventario usuarioActivo={usuario} />
          </ProtectedRoute>
        } />
        <Route path="/nomina" element={
          <ProtectedRoute>
            <CalculoNominaPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
