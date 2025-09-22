import React from "react";
import { AppBar, Toolbar, Box, Chip, Avatar, Typography, Button, Divider, Tooltip, IconButton } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import HistoryIcon from "@mui/icons-material/History";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import PersonIcon from "@mui/icons-material/Person";

export default function AppHeader({ usuarioActivo, onLogout, navigate }) {
  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ background: "none", boxShadow: "none", m: 0, p: 0 }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          minHeight: 48,
          p: 0,
          m: 0,
          background: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 40, marginRight: 8 }}
            aria-label="Logo"
          />
          <Chip label="v.1.3" size="small" sx={{ fontSize: '0.72rem', height: 22, mb: 0.5 }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Historial" arrow>
              <span>
                <IconButton
                  color="default"
                  size="small"
                  sx={{ color: "#757575" }}
                  onClick={() => navigate("/historial")}
                  aria-label="Ir a historial"
                >
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cierre del día" arrow>
              <span>
                <IconButton
                  color="default"
                  size="small"
                  sx={{ color: "#757575" }}
                  onClick={() => navigate("/cierredia")}
                  aria-label="Ir a cierre del día"
                >
                  <PointOfSaleIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Configuración" arrow>
              <span>
                <IconButton
                  color="default"
                  size="small"
                  sx={{ color: "#757575" }}
                  onClick={() => navigate("/configuracion")}
                  aria-label="Ir a configuración"
                >
                  <SettingsIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ mx: 2, height: 28 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar sx={{ bgcolor: "#e0e0e0", width: 22, height: 22 }} aria-label="Usuario">
              <PersonIcon fontSize="small" style={{ color: "#757575" }} />
            </Avatar>
            <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: 13 }}>
              {usuarioActivo}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              onClick={onLogout}
              aria-label="Cerrar sesión"
            >
              Cerrar sesión
            </Button>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
