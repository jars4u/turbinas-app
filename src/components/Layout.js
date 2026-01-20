import React from "react";
import { Box } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";

export default function Layout({
  children,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar cliente, modelo, servicio...",
  headerMaxWidth = "xl",
}) {
  const { usuario, isObserver, handleLogout } = useAuth();
  const navigate = useNavigate();
  const usuarioActivo = usuario?.email || "";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff", display: "flex", flexDirection: "column" }}>
      <AppHeader
        usuarioActivo={usuarioActivo}
        onLogout={handleLogout}
        navigate={navigate}
        isObserver={isObserver}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        maxWidth={headerMaxWidth}
      />
      <Box component="main" sx={{ flex: 1, bgcolor: "#fff" }}>
        {children}
      </Box>
    </Box>
  );
}
