import Login from "./pages/Login";

import React, { Suspense, lazy, useEffect } from "react";
import { LinearProgress } from "@mui/material";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MetodosPagoProvider } from "./context/MetodosPagoContext";
import AccesoDenegado from "./pages/AccesoDenegado";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotasFlotantes from "./components/NotasFlotantes";

// Cada página se descarga en su propio chunk solo cuando se visita, en lugar de
// cargar toda la app (gráficos, PDF, Excel, configuración...) al abrirla.
const cargarDashboard = () => import("./pages/Dashboard");
const Dashboard = lazy(cargarDashboard);
const HistorialVehiculos = lazy(() => import("./pages/HistorialVehiculos"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const CierreDia = lazy(() => import("./pages/CierreDia"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Inventario = lazy(() => import("./pages/Inventario"));
const CalculoNominaPage = lazy(() => import("./pages/CalculoNomina"));
const AgenteIA = lazy(() => import("./pages/AgenteIA"));

// Indicador mientras llega el chunk de una página
const CargandoPagina = (
  <LinearProgress sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000 }} />
);

function App() {
  return (
    <AuthProvider>
      <MetodosPagoProvider>
        <AppRoutes />
      </MetodosPagoProvider>
    </AuthProvider>
  );
}

// Definido fuera de AppRoutes: si se declarara dentro, cada render de AppRoutes
// crearía un tipo de componente nuevo y React desmontaría/remontaría la página
// completa (repitiendo todas sus cargas) con cada cambio del contexto de auth.
function ProtectedRoute({ children, skeleton }) {
  const { usuario, loadingAuth } = useAuth();
  if (loadingAuth) {
    return skeleton || null;
  }
  if (!usuario) {
    return <AccesoDenegado />;
  }
  return children;
}

// Ruta solo para owner/admin: además de la sesión exige el rol en la ruta (el
// backend del agente lo vuelve a verificar en el servidor)
function RutaSoloAdmin({ children }) {
  const { usuario, isAdmin, isOwner, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (!usuario || (!isAdmin && !isOwner)) return <AccesoDenegado />;
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

function AppRoutes() {
  const { usuario, isAdmin, isOwner, handleLogout } = useAuth();

  // El Dashboard es la página principal: se precarga apenas hay sesión para que
  // entrar a ella no espere la descarga de su chunk.
  useEffect(() => {
    if (usuario) cargarDashboard();
  }, [usuario]);

  return (
    <BrowserRouter>
      <Suspense fallback={CargandoPagina}>
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
        <Route path="/reportes" element={
          <ProtectedRoute>
            <Reportes isAdmin={isAdmin} isOwner={isOwner} />
          </ProtectedRoute>
        } />
        <Route path="/nomina" element={
          <ProtectedRoute>
            <CalculoNominaPage />
          </ProtectedRoute>
        } />
        <Route path="/agente" element={
          <RutaSoloAdmin>
            <AgenteIA />
          </RutaSoloAdmin>
        } />
      </Routes>
      </Suspense>
      {/* Componente de notas flotantes global */}
      <NotasFlotantes />
    </BrowserRouter>
  );
}

export default App;
