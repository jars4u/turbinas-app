
import React, { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Configuracion from "./pages/Configuracion";
import CierreDia from "./pages/CierreDia";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
  const [usuario, setUsuario] = useState(() => localStorage.getItem("usuario") || null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLogin = async (username, password) => {
    setError("");
    try {
      const res = await fetch("http://localhost:4000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: username, clave: password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUsuario(data.usuario);
        localStorage.setItem("usuario", data.usuario);
        // Consultar si el usuario es admin
        fetch(`http://localhost:4000/usuarios`)
          .then(res => res.json())
          .then(users => {
            const user = users.find(u => u.usuario === data.usuario);
            setIsAdmin(user?.admin || false);
          });
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleLogout = () => {
    setUsuario(null);
    setIsAdmin(false);
    localStorage.removeItem("usuario");
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          !usuario ? <Login onLogin={handleLogin} error={error} />
          : <Dashboard usuario={usuario} onLogout={handleLogout} />
        } />
        <Route path="/configuracion" element={
          <Configuracion usuario={usuario} isAdmin={isAdmin} />
        } />
        <Route path="/cierredia" element={<CierreDia />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
