import React from "react";
import { useLocation } from "react-router-dom";
import { AppBar, Toolbar, Box, Chip, Avatar, Typography, Button, Divider, Tooltip, IconButton, TextField, InputAdornment, Menu, MenuItem, ListItemIcon, ListItemText, Badge, Container } from "@mui/material";
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
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";

export default function AppHeader({ usuarioActivo, onLogout, navigate, isObserver = false, searchValue = "", onSearchChange, searchPlaceholder = "Buscar cliente, modelo, servicio...", maxWidth = "xl" }) {
  const location = useLocation();
  const pathname = location?.pathname || "";
  const isActive = (path) => pathname.startsWith(path);
  const showSearch = pathname === "/dashboard";
  const [actionsAnchor, setActionsAnchor] = React.useState(null);
  const actionsOpen = Boolean(actionsAnchor);
  const handleOpenActions = (e) => setActionsAnchor(e.currentTarget);
  const handleCloseActions = () => setActionsAnchor(null);
  // Menú de usuario (solo se usa en móviles)
  const [userAnchor, setUserAnchor] = React.useState(null);
  const userMenuOpen = Boolean(userAnchor);
  const handleOpenUserMenu = (e) => setUserAnchor(e.currentTarget);
  const handleCloseUserMenu = () => setUserAnchor(null);
  // Notificaciones de vencimiento (campana)
  const [notiAnchor, setNotiAnchor] = React.useState(null);
  const notiMenuOpen = Boolean(notiAnchor);
  const handleOpenNoti = (e) => {
    setNotiAnchor(e.currentTarget);
    // Marcar como leídas para el día actual
    const hoy = new Date();
    const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    try {
      localStorage.setItem('notiSeenDate', todayStr);
      localStorage.setItem('notiSeenCount', String(pendingItems.length || 0));
    } catch (_) {}
    setHasUnread(false);
  };
  const handleCloseNoti = () => setNotiAnchor(null);
  // Pendientes: vencidas y ≤2 días. Todas: ≤7 días.
  const [pendingItems, setPendingItems] = React.useState([]);
  const [hasUnread, setHasUnread] = React.useState(false);

  React.useEffect(() => {
    let unsubscribe;
    // Suscribir a cuentasPorPagar y calcular vencimientos cercanos (<=2 días)
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, onSnapshot }) => {
        unsubscribe = onSnapshot(collection(db, 'cuentasPorPagar'), (snapshot) => {
          const hoy = new Date();
          const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
          const msDay = 24 * 60 * 60 * 1000;
          const base = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .map(c => {
              const vStr = c?.vencimiento || '';
              const parts = vStr.split('/');
              let daysLeft = null;
              if (parts.length === 3) {
                const dd = Number(parts[0]);
                const mm = Number(parts[1]);
                const yyyy = Number(parts[2]);
                const due = new Date(yyyy, mm - 1, dd);
                const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
                daysLeft = Math.floor((dueMid - hoyMid) / msDay);
              }
              return {
                id: c.id,
                proveedor: c.proveedor || '-',
                documento: c.documento || '-',
                vencimiento: vStr || '-',
                daysLeft,
              };
            });
          const pend = base.filter(x => x.daysLeft !== null && x.daysLeft <= 2);
          setPendingItems(pend);
          // Determinar si hay "no leídas" según el día
          const hoy2 = new Date();
          const todayStr = `${hoy2.getFullYear()}-${String(hoy2.getMonth() + 1).padStart(2, '0')}-${String(hoy2.getDate()).padStart(2, '0')}`;
          let seenDate = null;
          let seenCount = null;
          try {
            seenDate = localStorage.getItem('notiSeenDate');
            seenCount = localStorage.getItem('notiSeenCount');
          } catch (_) { seenDate = null; }
          const pendCount = pend.length;
          const seenCountNum = seenCount !== null ? Number(seenCount) : 0;
          if (pendCount > 0 && (seenDate !== todayStr || pendCount > seenCountNum)) {
            setHasUnread(true);
          } else {
            setHasUnread(false);
          }
        });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  return (
    <AppBar
      position={typeof window !== 'undefined' && window.matchMedia('(min-width:600px)').matches ? 'sticky' : 'static'}
      color="default"
      elevation={0}
      sx={{ background: "#fff", boxShadow: "none", m: 0, p: 0, top: 0, zIndex: (theme) => theme.zIndex.appBar }}
    >
      <Container maxWidth={maxWidth} sx={{ px: { xs: 2, sm: 4 } }}>
      <Toolbar
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          justifyContent: { xs: "center", sm: "space-between" },
          minHeight: 48,
          pt: 1,
          px: { xs: 1, sm: 0 },
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
            style={{ height: 40, marginRight: 8, cursor: 'pointer' }}
            onClick={() => navigate && navigate('/dashboard')}
            title="Ir al dashboard"
            aria-label="Logo"
          />
          <Chip label="v.5.5" size="small" sx={{ fontSize: '0.72rem', height: 22, mb: 0.5 }} />
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
          {/* Buscador en su propia fila para móviles (solo Dashboard) */}
          {showSearch && (
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
          )}
          {/* Fila compacta en móviles: menú a la izquierda y avatar a la derecha */}
          <Box
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              width: '100%',
              justifyContent: 'space-between'
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
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
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
              <IconButton
                aria-label="Notificaciones"
                title="Notificaciones"
              size="small"
              onClick={handleOpenNoti}
              sx={{ color: '#616161' }}
            >
                  <Badge
                    badgeContent={pendingItems.length}
                    color={hasUnread ? 'error' : 'default'}
                    overlap="circular"
                    slotProps={!hasUnread ? { badge: { sx: { bgcolor: 'grey.400', color: '#fff' } } } : undefined}
                  >
                    {pendingItems.length > 0 ? <NotificationsActiveOutlinedIcon /> : <NotificationsNoneOutlinedIcon />}
              </Badge>
            </IconButton>
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
            {/* Buscador global (desktop/tablet) (solo Dashboard) */}
            {showSearch && (
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
            )}
            {/* Grupo de accesos rápidos: visible solo en desktop/tablet */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Tooltip title="Notificaciones" arrow>
                <span>
                  <IconButton
                    color="default"
                    size="small"
                    sx={{ color: "#757575" }}
                    onClick={handleOpenNoti}
                    aria-label="Ver notificaciones"
                  >
                    <Badge
                      badgeContent={pendingItems.length}
                      color={hasUnread ? 'error' : 'default'}
                      overlap="circular"
                      slotProps={!hasUnread ? { badge: { sx: { bgcolor: 'grey.400', color: '#fff' } } } : undefined}
                    >
                      {pendingItems.length > 0 ? <NotificationsActiveOutlinedIcon /> : <NotificationsNoneOutlinedIcon />}
                    </Badge>
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Nómina" arrow>
                <span>
                  <IconButton
                    color="default"
                    size="small"
                    sx={(theme) => ({
                      color: isActive('/nomina') ? theme.palette.primary.main : "#757575",
                      borderBottom: isActive('/nomina') ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      borderRadius: 0
                    })}
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
                    sx={(theme) => ({
                      color: isActive('/inventario') ? theme.palette.primary.main : "#757575",
                      borderBottom: isActive('/inventario') ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      borderRadius: 0
                    })}
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
                    sx={(theme) => ({
                      color: isActive('/historial') ? theme.palette.primary.main : "#757575",
                      borderBottom: isActive('/historial') ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      borderRadius: 0
                    })}
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
                    sx={(theme) => ({
                      color: isActive('/cierredia') ? theme.palette.primary.main : "#757575",
                      borderBottom: isActive('/cierredia') ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      borderRadius: 0
                    })}
                    onClick={() => navigate("/cierredia")}
                    aria-label="Ir a cierre del día"
                  >
                    <PointOfSaleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isObserver ? "Sin acceso" : "Configuración"} arrow>
                <span>
                  <IconButton
                    color="default"
                    size="small"
                    sx={(theme) => ({
                      color: isActive('/configuracion') ? theme.palette.primary.main : "#757575",
                      borderBottom: isActive('/configuracion') ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      borderRadius: 0
                    })}
                    onClick={() => !isObserver && navigate("/configuracion")}
                    disabled={isObserver}
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
              <MenuItem disabled={isObserver} onClick={() => { handleCloseActions(); if (!isObserver) navigate('/configuracion'); }}>
                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Configuración" />
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={() => { handleCloseActions(); onLogout && onLogout(); }}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cerrar sesión" />
              </MenuItem>
            </Menu>
            <Menu
              anchorEl={notiAnchor}
              open={notiMenuOpen}
              onClose={handleCloseNoti}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {pendingItems.length === 0 ? (
                <MenuItem disabled>
                  <ListItemText primary="Sin vencimientos cercanos" />
                </MenuItem>
              ) : (
                <Box sx={{ p: 1, minWidth: 260 }}>
                  <Typography variant="subtitle2" sx={{ px: 1, pb: 0.5 }}>Vencen en ≤2 días</Typography>
                  {pendingItems.slice(0, 6).map(item => {
                    const label = (() => {
                      if (item.daysLeft === 0) return 'Hoy';
                      if (item.daysLeft === 1) return 'Mañana';
                      if (item.daysLeft === 2) return 'En 2 días';
                      if (item.daysLeft < 0) return `Vencida ${Math.abs(item.daysLeft)} días`;
                      return `En ${item.daysLeft} días`;
                    })();
                    const color = item.daysLeft < 0 ? 'error.main' : (item.daysLeft <= 1 ? 'warning.main' : 'text.secondary');
                    return (
                      <Box key={item.id} sx={{ px: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                          {item.proveedor.toUpperCase()} {item.documento !== '-' ? `• ${item.documento.toUpperCase()}` : ''}
                        </Typography>
                        <Typography variant="caption" sx={{ color }}>
                          Venc.: {item.vencimiento} — {label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
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
      </Container>
    </AppBar>
  );
}
