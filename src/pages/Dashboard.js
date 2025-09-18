import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Divider,
  Avatar,
  AppBar,
  Toolbar,
  Box,
  Tooltip,
  IconButton,
  Chip,
  Select,
  MenuItem,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { useNavigate } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import VehicleCard from "../components/VehicleCard";
import {
  obtenerVehiculos,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
} from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import SortIcon from '@mui/icons-material/Sort';

export default function Dashboard({ usuario, onLogout }) {
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [ordenEstado, setOrdenEstado] = useState("");
  const [ordenAsc, setOrdenAsc] = useState(true);
  // Cambiar status y guardar en la base de datos
  const navigate = useNavigate();
  // El usuario autenticado debe mantenerse fijo
  // Si el nombre cambia tras crear usuario, probablemente se está actualizando el prop "usuario" desde el padre
  // Solución: guardar el usuario autenticado en un estado local solo al montar
  const [usuarioActivo, setUsuarioActivo] = useState(usuario);
  useEffect(() => {
    // Solo inicializar una vez al montar
    setUsuarioActivo(usuario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleStatusChange = async (id, newStatus) => {
    const vehiculo = vehiculos.find((v) => v.id === id);
    if (!vehiculo) return;
    await actualizarVehiculo(id, { ...vehiculo, status: newStatus });
    const actualizados = await obtenerVehiculos();
    setVehiculos(actualizados);
  };
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // Cargar vehículos y estados desde la API al montar
  useEffect(() => {
    obtenerVehiculos().then((data) => {
      setVehiculos(data);
      setLoading(false);
    });
    obtenerEstadosServicio().then((data) => {
      setEstadosServicio(data);
    });
  }, []);
  const [open, setOpen] = useState(false);
  // Estado para el modal de confirmación de eliminación
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    vehiculo: "",
    placa: "",
    servicio: "",
    precio: "",
    customerName: "",
    customerPhone: "",
    observaciones: "",
  });
  const [editSection, setEditSection] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  // Estado para controlar edición de todas las secciones al registrar
  const isRegistering = editId === null;

  const handleOpen = (vehiculo) => {
    if (vehiculo) {
      setForm({
        vehiculo: vehiculo.vehiculo || "",
        placa: vehiculo.placa || "",
        servicio: vehiculo.servicio || "",
        precio: vehiculo.precio || "",
        customerName: vehiculo.customerName || "",
        customerPhone: vehiculo.customerPhone || "",
        observaciones: vehiculo.observaciones || "",
      });
      setEditId(vehiculo.id);
      setEditSection(null);
      setIsEditing(false);
    } else {
      setForm({
        vehiculo: "",
        placa: "",
        servicio: "",
        precio: "",
        customerName: "",
        customerPhone: "",
        observaciones: "",
      });
      setEditId(null);
      setEditSection("vehiculo"); // Abrir directamente en modo edición
      setIsEditing(true);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({
      vehiculo: "",
      placa: "",
      servicio: "",
      precio: "",
      customerName: "",
      customerPhone: "",
      observaciones: "",
    });
    setEditId(null);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setIsEditing(true);
  };

  const getDefaultStatus = () => {
    const def = estadosServicio.find((e) => e.defaultEstado);
    return def ? def.nombre : "servicio";
  };

  const handleSave = async () => {
    const vehiculoData = {
      vehiculo: form.vehiculo,
      placa: form.placa,
      servicio: form.servicio,
      arrivalTime: editId
        ? vehiculos.find((v) => v.id === editId)?.arrivalTime
        : Date.now(),
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      observaciones: form.observaciones,
      status: editId
        ? vehiculos.find((v) => v.id === editId)?.status || getDefaultStatus()
        : getDefaultStatus(),
      precio: form.precio === "" ? null : Number(form.precio),
    };
    setActionLoading(true);
    if (editId) {
      await actualizarVehiculo(editId, vehiculoData);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados);
    } else {
      await crearVehiculo(vehiculoData);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados);
    }
    setActionLoading(false);
    setOpen(false);
    setEditSection(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (editId) {
      setActionLoading(true);
      await eliminarVehiculo(editId);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados);
      setActionLoading(false);
      handleClose();
      setConfirmDeleteOpen(false);
    }
  };

  // Abrir modal de confirmación
  const handleDeleteClick = () => {
    setConfirmDeleteOpen(true);
  };

  // Cancelar eliminación
  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
  };

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 4, maxWidth: "100%", width: "100%", px: 4 }}
    >
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
            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 2, height: 28 }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Avatar
                sx={{ bgcolor: "#e0e0e0", width: 22, height: 22 }}
                aria-label="Usuario"
              >
                <PersonIcon fontSize="small" style={{ color: "#757575" }} />
              </Avatar>
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight={500}
                sx={{ fontSize: 13 }}
              >
                {usuarioActivo}
              </Typography>
              <Button
                variant="outlined"
                color="error"
                size="small"
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
                onClick={() => {
                  onLogout();
                  navigate("/");
                }}
                aria-label="Cerrar sesión"
              >
                Cerrar sesión
              </Button>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      <Divider sx={{ mb: 2 }} />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ m: 0 }}>
          <span style={{ fontWeight: 600 }}>
            Turbinas en servicio
            {vehiculos && (
              <span style={{ fontWeight: 400, marginLeft: 8, fontSize: '1rem' }}>
                ({vehiculos.length})
              </span>
            )}
          </span>
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Registrar servicio
        </Button>
      </Box>
      {/* Resumen de trabajos por estado sincronizado */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", gap: 4 }}>
          {estadosServicio.map((estado) => (
            <Typography
              key={estado.nombre}
              variant="body1"
              color={estado.color ? `${estado.color}.main` : "text.primary"}
              fontWeight={600}
            >
              {estado.label}: {vehiculos.filter((v) => (v.status || v.estado) === estado.nombre).length}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <SortIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Select
            size="small"
            value={ordenEstado}
            onChange={e => setOrdenEstado(e.target.value)}
            displayEmpty
            sx={{ minWidth: 120, color: 'text.secondary' }}
          >
            <MenuItem value="">Todos</MenuItem>
            {estadosServicio.map((estado) => (
              <MenuItem key={estado.nombre} value={estado.nombre}>{estado.label}</MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setOrdenAsc((prev) => !prev)}
            sx={{ minWidth: 36, px: 1, color: 'text.secondary', borderColor: '#b4b4b4ff', boxShadow: 'none', '&:hover': { bgcolor: '#e0e0e0' } }}
          >
            {ordenAsc ? "Asc" : "Desc"}
          </Button>
        </Box>
      </Box>
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <CircularProgress color="primary" size={48} />
        </Box>
      ) : (
        <Grid container spacing={2} columns={12}>
          {[...vehiculos]
            .filter(v => !ordenEstado || (v.status || v.estado) === ordenEstado)
            .sort((a, b) => {
              if (!ordenEstado) return ordenAsc ? a.arrivalTime - b.arrivalTime : b.arrivalTime - a.arrivalTime;
              // Ordenar por estado y luego arrivalTime
              if (ordenAsc) return (a.status || a.estado).localeCompare(b.status || b.estado) || a.arrivalTime - b.arrivalTime;
              return (b.status || b.estado).localeCompare(a.status || a.estado) || b.arrivalTime - a.arrivalTime;
            })
            .map((v) => (
              <Grid
                key={v.id}
                sx={{
                  mb: 3,
                  gridColumn: {
                    xs: "span 12",
                    sm: "span 6",
                    md: "span 3",
                    lg: "span 2",
                    xl: "span 2",
                  },
                }}
              >
                <VehicleCard
                  vehiculo={v}
                  onEdit={() => handleOpen(v)}
                  onStatusChange={(newStatus) =>
                    handleStatusChange(v.id, newStatus)
                  }
                />
              </Grid>
            ))}
        </Grid>
      )}
      <Dialog open={open} onClose={handleClose}>
        <DialogContent
          sx={{ minWidth: 400, maxWidth: 500, pt: 3, position: "relative" }}
        >
          {actionLoading && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                bgcolor: "rgba(255,255,255,0.7)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress color="primary" size={40} />
            </Box>
          )}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <Typography variant="h6">
              {editId ? "Información del servicio" : "Registrar servicio"}
            </Typography>
            {editId && (
              <Button
              onClick={handleDeleteClick}
              variant="outlined"
              size="small"
              color="error"
              >
                Eliminar
              </Button>
            )}
          </Box>
            {editId && (
              (() => {
                const vehiculoActual = vehiculos.find(v => v.id === editId);
                const estadoActual = estadosServicio.find(e => e.nombre === (vehiculoActual?.status || vehiculoActual?.estado));
                return (
                  <Box sx={{ width: '100%', display: 'block' }}>
                    <Chip
                      label={estadoActual?.label || (vehiculoActual?.status || vehiculoActual?.estado) || "Sin estado"}
                      color={estadoActual?.color || "default"}
                      size="small"
                      sx={{ fontSize: '0.85rem', height: 26, mx: 0 }}
                    />
                  </Box>
                );
              })()
            )}
          {/* Modal de confirmación para eliminar */}
          <Dialog open={confirmDeleteOpen} onClose={handleCancelDelete}>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogContent>
              <Typography>
                ¿Estás seguro que deseas eliminar este servicio? Esta acción no
                se puede deshacer.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelDelete} color="primary">
                Cancelar
              </Button>
              <Button onClick={handleDelete} color="error" variant="contained">
                Eliminar
              </Button>
            </DialogActions>
          </Dialog>
        </DialogContent>
        <DialogContent sx={{ minWidth: 400, maxWidth: 500 }}>
          {/* Sección: Datos de turbina */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="primary"
              gutterBottom
            >
              Datos de la turbina
            </Typography>
            {editSection !== "vehiculo" && !isRegistering && (
              <IconButton
                size="small"
                onClick={() => setEditSection("vehiculo")}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box
            sx={{
              minHeight: 80,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            {editSection === "vehiculo" || isRegistering ? (
              <>
                <TextField
                  margin="none"
                  label="Modelo"
                  name="vehiculo"
                  fullWidth
                  size="small"
                  value={form.vehiculo}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                />
              </>
            ) : (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                  }}
                >
                  Modelo
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.vehiculo && form.vehiculo.toUpperCase()}
                </Typography>
              </>
            )}
          </Box>

          {/* Sección: Datos del servicio */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="primary"
              gutterBottom
            >
              Datos del servicio
            </Typography>
            {editSection !== "servicio" && !isRegistering && (
              <IconButton
                size="small"
                onClick={() => setEditSection("servicio")}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box
            sx={{
              minHeight: 110,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            {editSection === "servicio" || isRegistering ? (
              <>
                <TextField
                  margin="none"
                  label="Servicio"
                  name="servicio"
                  fullWidth
                  size="small"
                  value={form.servicio}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                />
                <TextField
                  margin="none"
                  label="Observaciones"
                  name="observaciones"
                  fullWidth
                  size="small"
                  value={form.observaciones}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                />
                <TextField
                  margin="none"
                  label="Precio"
                  name="precio"
                  type="number"
                  fullWidth
                  size="small"
                  value={form.precio}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                />
              </>
            ) : (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                  }}
                >
                  Servicio
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.servicio}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  Observaciones
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.observaciones}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  Precio
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.precio}
                </Typography>
              </>
            )}
          </Box>

          {/* Sección: Datos del cliente */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 2,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="primary"
              gutterBottom
            >
              Datos del cliente
            </Typography>
            {editSection !== "cliente" && !isRegistering && (
              <IconButton
                size="small"
                onClick={() => setEditSection("cliente")}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box
            sx={{
              minHeight: 80,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            {editSection === "cliente" || isRegistering ? (
              <>
                <TextField
                  margin="none"
                  label="Cliente (Nombre)"
                  name="customerName"
                  fullWidth
                  size="small"
                  value={form.customerName}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                />
                <TextField
                  margin="none"
                  label="Cliente (Teléfono)"
                  name="customerPhone"
                  fullWidth
                  size="small"
                  value={
                    form.customerPhone.startsWith("+58")
                      ? form.customerPhone
                      : "+58" + form.customerPhone.replace(/^0+/, "")
                  }
                  onChange={(e) => {
                    let value = e.target.value;
                    // Forzar el prefijo +58
                    if (!value.startsWith("+58")) {
                      value = "+58" + value.replace(/^0+/, "");
                    }
                    // Solo permitir números después de +58
                    value = value.replace(/^\+58/, "+58");
                    const soloNumeros = value.slice(3).replace(/[^\d]/g, "");
                    value = "+58" + soloNumeros;
                    setForm({ ...form, customerPhone: value });
                  }}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                  placeholder="+58-424-xxxxxxx"
                  helperText={
                    /^\+58\d{10}$/.test(
                      form.customerPhone.replace(/[-\s]/g, "")
                    )
                      ? "Formato: +58-424-xxxxxxx"
                      : "Debe ser +58 seguido de 10 dígitos (ej: +584246065449)"
                  }
                  error={
                    !/^\+58\d{10}$/.test(
                      form.customerPhone.replace(/[-\s]/g, "")
                    )
                  }
                />
              </>
            ) : (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                  }}
                >
                  Cliente
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.customerName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.80rem",
                    display: "block",
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  Teléfono
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "1rem", display: "block", mt: 0.2 }}
                >
                  {form.customerPhone}
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ display: "flex", justifyContent: "space-between", px: 3 }}
        >
          {isRegistering ? (
            <>
              <Button
                onClick={handleClose}
                variant="outlined"
                size="small"
                color="error"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  handleSave();
                  setOpen(false);
                  setEditSection(null);
                  setIsEditing(false);
                }}
                variant="contained"
                size="small"
                color="primary"
                disabled={
                  !form.vehiculo ||
                  !/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))
                }
              >
                Guardar
              </Button>
            </>
          ) : (
            <>
              {editSection ? (
                <>
                  <Button
                    onClick={() => {
                      setEditSection(null);
                      setIsEditing(false);
                    }}
                    variant="outlined"
                    size="small"
                    color="error"
                  >
                    Cancelar
                  </Button>
                  {isEditing && (
                    <Button
                      onClick={handleSave}
                      variant="contained"
                      size="small"
                      color="primary"
                      disabled={actionLoading}
                      startIcon={actionLoading ? <CircularProgress color="inherit" size={18} /> : null}
                    >
                      {actionLoading ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      onClick={() => {
                        if (form.customerPhone) {
                          // Formato esperado: +58-424-6065449
                          let phone = form.customerPhone.trim();
                          // Eliminar espacios y guiones
                          phone = phone.replace(/[-\s]/g, "");
                          // Eliminar el símbolo + si existe
                          phone = phone.replace(/^\+/, "");
                          // Si comienza con 58, dejarlo así; si comienza con 0, convertir a 58
                          if (phone.startsWith("58")) {
                            // ya está en formato internacional
                          } else if (phone.startsWith("0")) {
                            phone = "58" + phone.slice(1);
                          }
                          window.open(`https://wa.me/${phone}`, "_blank");
                        }
                      }}
                      disabled={!form.customerPhone}
                    >
                      Enviar WhatsApp
                    </Button>
                  </Box>
                  <Button
                    onClick={handleClose}
                    variant="outlined"
                    size="small"
                    color="primary"
                  >
                    Volver
                  </Button>
                </>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
