import React from "react";
import { AppBar, Toolbar, Box, Chip, Avatar, Typography, Button, Divider, Tooltip, IconButton, TextField, InputAdornment, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import HistoryIcon from "@mui/icons-material/History";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import PersonIcon from "@mui/icons-material/Person";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import GroupIcon from "@mui/icons-material/Group";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";

export default function AppHeader({ usuarioActivo, onLogout, navigate, searchValue = "", onSearchChange, searchPlaceholder = "Buscar cliente, modelo, servicio..." }) {
  const [actionsAnchor, setActionsAnchor] = React.useState(null);
  const actionsOpen = Boolean(actionsAnchor);
  const handleOpenActions = (e) => setActionsAnchor(e.currentTarget);
  const handleCloseActions = () => setActionsAnchor(null);
  // Menú de usuario (solo se usa en móviles)
  const [userAnchor, setUserAnchor] = React.useState(null);
  const userMenuOpen = Boolean(userAnchor);
  const handleOpenUserMenu = (e) => setUserAnchor(e.currentTarget);
  const handleCloseUserMenu = () => setUserAnchor(null);

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
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          justifyContent: { xs: "center", sm: "space-between" },
          minHeight: 48,
          p: { xs: 1, sm: 0 },
          m: 0,
          width: "100%",
          background: "none",
          gap: { xs: 1, sm: 0 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: { xs: "center", sm: "flex-start" }, gap: 1, width: { xs: "100%", sm: "auto" }, mb: { xs: 1, sm: 0 } }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 40, marginRight: 8 }}
            aria-label="Logo"
          />
          <Chip label="v.4.0" size="small" sx={{ fontSize: '0.72rem', height: 22, mb: 0.5 }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "center", sm: "center" },
            justifyContent: { xs: "center", sm: "flex-end" },
            gap: { xs: 1.5, sm: 1 },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {/* Buscador en su propia fila para móviles */}
          <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
            <TextField
              fullWidth
              size="small"
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  searchValue ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Limpiar búsqueda"
                        title="Borrar"
                        edge="end"
                        onClick={() => onSearchChange && onSearchChange("")}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                ),
              }}
            />
          </Box>
          {/* Fila compacta en móviles: menú a la izquierda y avatar a la derecha */}
          <Box
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              // justifyContent: 'space-between',
              width: '100%',
              gap: 10
            }}
          >
            <IconButton
              aria-label="Abrir menú de acciones"
              title="Menú"
              size="small"
              onClick={handleOpenActions}
              sx={{ color: '#616161' }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '60%', justifyContent: 'flex-end' }}>
              <Avatar sx={{ bgcolor: '#e0e0e0', width: 22, height: 22, cursor: 'pointer' }} aria-label="Usuario" onClick={handleOpenUserMenu}>
                <PersonIcon fontSize="small" style={{ color: '#757575' }} />
              </Avatar>
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight={500}
                sx={{
                  fontSize: 13,
                  display: { xs: 'inline', sm: 'none' },
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={usuarioActivo || ''}
              >
                {usuarioActivo ? usuarioActivo.split("@")[0] : ""}
              </Typography>
            </Box>
          </Box>
          {/* Menú de usuario en móviles */}
          <Menu
            anchorEl={userAnchor}
            open={userMenuOpen}
            onClose={handleCloseUserMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ display: { xs: 'block', sm: 'none' } }}
          >
            <MenuItem onClick={() => { handleCloseUserMenu(); onLogout && onLogout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Cerrar sesión" />
            </MenuItem>
          </Menu>
          <Box sx={{ display: "flex", flexDirection: { xs: "row" }, alignItems: "center", justifyContent: { xs: "center", sm: "flex-end" }, gap: 1, width: { xs: "100%", sm: "auto" } }}>
            {/* Buscador global (desktop/tablet) */}
            <Box sx={{ display: { xs: 'none', sm: 'block' }, width: { sm: 320, md: 360 } }}>
              <TextField
                fullWidth
                size="small"
                value={searchValue}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    searchValue ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Limpiar búsqueda"
                          title="Borrar"
                          edge="end"
                          onClick={() => onSearchChange && onSearchChange("")}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  ),
                }}
              />
            </Box>
            {/* Grupo de accesos rápidos: visible solo en desktop/tablet */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Tooltip title="Nómina" arrow>
                <span>
                  <IconButton
                    color="default"
                    size="small"
                    sx={{ color: "#757575" }}
                    onClick={() => navigate("/nomina")}
                    aria-label="Ir a cálculo de nómina"
                  >
                    <GroupIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Inventario" arrow>
                <span>
                  <IconButton
                    color="default"
                    size="small"
                    sx={{ color: "#757575" }}
                    onClick={() => navigate("/inventario")}
                    aria-label="Ir a inventario"
                  >
                    <Inventory2OutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
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
            {/* Botón de acciones: visible solo en móviles */}
            <IconButton
              aria-label="Abrir menú de acciones"
              title="Menú"
              size="small"
              onClick={handleOpenActions}
              sx={{ display: { xs: 'none', sm: 'none' }, color: '#616161' }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={actionsAnchor}
              open={actionsOpen}
              onClose={handleCloseActions}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { handleCloseActions(); navigate('/nomina'); }}>
                <ListItemIcon><GroupIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Nómina" />
              </MenuItem>
              <MenuItem onClick={() => { handleCloseActions(); navigate('/inventario'); }}>
                <ListItemIcon><Inventory2OutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Inventario" />
              </MenuItem>
              <MenuItem onClick={() => { handleCloseActions(); navigate('/historial'); }}>
                <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Historial" />
              </MenuItem>
              <MenuItem onClick={() => { handleCloseActions(); navigate('/cierredia'); }}>
                <ListItemIcon><PointOfSaleIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cierre del día" />
              </MenuItem>
              <MenuItem onClick={() => { handleCloseActions(); navigate('/configuracion'); }}>
                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Configuración" />
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={() => { handleCloseActions(); onLogout && onLogout(); }}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cerrar sesión" />
              </MenuItem>
            </Menu>
          </Box>
          <Divider orientation="horizontal" flexItem sx={{ display: { xs: 'none', sm: 'block' }, my: { xs: 0, sm: 0 }, mx: { xs: 0, sm: 2 }, width: { xs: 0, sm: 0 }, height: { xs: 0, sm: 28 } }} />
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: "center", justifyContent: { xs: "center", sm: "flex-end" }, gap: 1, width: { xs: "100%", sm: "auto" } }}>
            <Avatar sx={{ bgcolor: "#e0e0e0", width: 22, height: 22 }} aria-label="Usuario">
              <PersonIcon fontSize="small" style={{ color: "#757575" }} />
            </Avatar>
            <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: 13, display: { xs: 'none', sm: 'block' } }}>
              {usuarioActivo ? usuarioActivo.split("@")[0] : ""}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              sx={{ minWidth: 0, px: 1, fontSize: 12, display: { xs: 'none', sm: 'inline-flex' } }}
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
