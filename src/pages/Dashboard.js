import React, { useState } from "react";
import { useEffect } from "react";
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
} from "@mui/material";
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { useNavigate } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import VehicleCard from "../components/VehicleCard";
import { obtenerVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo } from "../lib/vehiculosFirebase";


export default function Dashboard({ usuario, onLogout }) {
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
  // Cargar vehículos desde la API al montar
  useEffect(() => {
    obtenerVehiculos().then((data) => {
      setVehiculos(data);
      setLoading(false);
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
      setEditSection('vehiculo'); // Abrir directamente en modo edición
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
        ? vehiculos.find((v) => v.id === editId)?.status || "servicio"
        : "servicio",
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
    <Container maxWidth="xl" sx={{ py: 4, maxWidth: "100%", width: "100%", px: 4 }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ background: 'none', boxShadow: 'none', m: 0, p: 0 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: 48, p: 0, m: 0, background: 'none' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="/logo.png" alt="Logo" style={{ height: 32, marginRight: 8 }} aria-label="Logo" />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Cierre del día" arrow>
                <span>
                  <IconButton color="default" size="small" sx={{ color: '#757575' }} onClick={() => navigate('/cierredia')} aria-label="Ir a cierre del día">
                    <PointOfSaleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Configuración" arrow>
                <span>
                  <IconButton color="default" size="small" sx={{ color: '#757575' }} onClick={() => navigate('/configuracion')} aria-label="Ir a configuración">
                    <SettingsIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 2, height: 28 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: '#e0e0e0', width: 22, height: 22 }} aria-label="Usuario">
                <PersonIcon fontSize="small" style={{ color: '#757575' }} />
              </Avatar>
              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: 13 }}>
                {usuarioActivo}
              </Typography>
              <Button variant="outlined" color="error" size="small" sx={{ minWidth: 0, px: 1, fontSize: 12 }} onClick={onLogout} aria-label="Cerrar sesión">
                Cerrar sesión
              </Button>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ m: 0 }}>
          <span style={{ fontWeight: 600 }}>Vehículos en servicio</span>
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Registrar Vehículo
        </Button>
      </Box>
      {/* Resumen de vehículos por estado */}
      <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
        <Typography variant="body1" color="primary" fontWeight={600}>
          En servicio: {vehiculos.filter(v => (v.status || v.estado) === 'servicio').length}
        </Typography>
        <Typography variant="body1" color="success.main" fontWeight={600}>
          Entregados: {vehiculos.filter(v => (v.status || v.estado) === 'entregado').length}
        </Typography>
        <Typography variant="body1" color="warning.main" fontWeight={600}>
          En espera: {vehiculos.filter(v => (v.status || v.estado) === 'espera').length}
        </Typography>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress color="primary" size={48} />
        </Box>
      ) : (
        <Grid container spacing={2} columns={12}>
          {[...vehiculos]
            .sort((a, b) => a.arrivalTime - b.arrivalTime)
            .map((v) => (
              <Grid
                key={v.id}
                sx={{ mb: 3, gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3', lg: 'span 2', xl: 'span 2' } }}
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
        <DialogContent sx={{ minWidth: 400, maxWidth: 500, pt: 3, position: 'relative' }}>
          {actionLoading && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress color="primary" size={40} />
            </Box>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">
              {editId ? "Información del Vehículo" : "Registrar Vehículo"}
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
          {/* Modal de confirmación para eliminar */}
          <Dialog open={confirmDeleteOpen} onClose={handleCancelDelete}>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogContent>
              <Typography>¿Estás seguro que deseas eliminar este vehículo? Esta acción no se puede deshacer.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelDelete} color="primary">Cancelar</Button>
              <Button onClick={handleDelete} color="error" variant="contained">Eliminar</Button>
            </DialogActions>
          </Dialog>
        </DialogContent>
        <DialogContent sx={{ minWidth: 400, maxWidth: 500 }}>
          {/* Sección: Datos del vehículo */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom sx={{ mt: 1 }}>
              Datos del vehículo
            </Typography>
            {editSection !== 'vehiculo' && (
              <IconButton size="small" onClick={() => setEditSection('vehiculo')}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ minHeight: 80, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(editSection === 'vehiculo' || isRegistering) ? (
              <>
                <TextField
                  margin="none"
                  label="Vehículo"
                  name="vehiculo"
                  fullWidth
                  size="small"
                  value={form.vehiculo}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
                <TextField
                  margin="none"
                  label="Placa"
                  name="placa"
                  fullWidth
                  size="small"
                  value={form.placa}
                  onChange={handleChange}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
              </>
            ) : (
              <>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary' }}>Vehículo</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.vehiculo && form.vehiculo.toUpperCase()}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary', mt: 1 }}>Placa</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.placa && form.placa.toUpperCase()}</Typography>
              </>
            )}
          </Box>

          {/* Sección: Datos del servicio */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom>
              Datos del servicio
            </Typography>
            {editSection !== 'servicio' && (
              <IconButton size="small" onClick={() => setEditSection('servicio')}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ minHeight: 110, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(editSection === 'servicio' || isRegistering) ? (
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
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
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
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
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
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
              </>
            ) : (
              <>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary' }}>Servicio</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.servicio}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary', mt: 1 }}>Observaciones</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.observaciones}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary', mt: 1 }}>Precio</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.precio}</Typography>
              </>
            )}
          </Box>

          {/* Sección: Datos del cliente */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom>
              Datos del cliente
            </Typography>
            {editSection !== 'cliente' && (
              <IconButton size="small" onClick={() => setEditSection('cliente')}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ minHeight: 80, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(editSection === 'cliente' || isRegistering) ? (
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
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
                <TextField
                  margin="none"
                  label="Cliente (Teléfono)"
                  name="customerPhone"
                  fullWidth
                  size="small"
                  value={form.customerPhone.startsWith('+58') ? form.customerPhone : '+58' + form.customerPhone.replace(/^0+/, '')}
                  onChange={e => {
                    let value = e.target.value;
                    // Forzar el prefijo +58
                    if (!value.startsWith('+58')) {
                      value = '+58' + value.replace(/^0+/, '');
                    }
                    // Solo permitir números después de +58
                    value = value.replace(/^\+58/, '+58');
                    const soloNumeros = value.slice(3).replace(/[^\d]/g, '');
                    value = '+58' + soloNumeros;
                    setForm({ ...form, customerPhone: value });
                  }}
                  sx={{ mb: 1.5 }}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                  placeholder="+58-424-xxxxxxx"
                  helperText={
                    /^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ''))
                      ? "Formato: +58-424-xxxxxxx"
                      : "Debe ser +58 seguido de 10 dígitos (ej: +584246065449)"
                  }
                  error={!/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ''))}
                />
              </>
            ) : (
              <>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary' }}>Cliente</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.customerName}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.80rem', display: 'block', color: 'text.secondary', mt: 1 }}>Teléfono</Typography>
                <Typography variant="caption" sx={{ fontSize: '1rem', display: 'block', mt: 0.2 }}>{form.customerPhone}</Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 3 }}>
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
                  !form.placa ||
                  !/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ''))
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
                      onClick={() => {
                        handleSave();
                        setEditSection(null);
                        setIsEditing(false);
                      }}
                      variant="contained"
                      size="small"
                      color="primary"
                    >
                      Guardar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
