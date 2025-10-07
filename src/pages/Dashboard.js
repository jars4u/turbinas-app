import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Container,
  Typography,
  Grid,
  Button,
  Divider,
  Box,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Autocomplete,
} from "@mui/material";
import Skeleton from "@mui/material/Skeleton";
import PaymentModal from "../components/PaymentModal";
import CircularProgress from "@mui/material/CircularProgress";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { useNavigate } from "react-router-dom";
import VehicleCard from "../components/VehicleCard";
import AppHeader from "../components/AppHeader";
import {
  obtenerVehiculos,
  escucharVehiculos,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
} from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import SortIcon from "@mui/icons-material/Sort";

// Sanitiza cualquier undefined en null, recursivamente
function sanitizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(k => {
      const val = obj[k];
      if (val === undefined) {
        newObj[k] = null;
      } else {
        newObj[k] = sanitizeDeep(val);
      }
    });
    return newObj;
  }
  return obj;
}

export default function Dashboard() {
  // Estado para el modal de confirmación de ocultar servicio
  const [confirmOcultar, setConfirmOcultar] = useState({ open: false, estado: null });
  const { usuario, handleLogout } = useAuth();
  // Estado para modal de cambio de estado
  const [openEstadoModal, setOpenEstadoModal] = useState(false);
  const [vehiculoEstadoModal, setVehiculoEstadoModal] = useState(null);
  // Clientes base: extraer de vehículos
  const [clientes, setClientes] = useState([]);
  useEffect(() => {
    const unsubscribe = escucharVehiculos((data) => {
      // Extraer clientes únicos por nombre y teléfono
      const clientesUnicos = [];
      const seen = new Set();
      data.forEach((v) => {
        const nombre = v.customerName?.trim() || "";
        const telefono = v.customerPhone?.trim() || "";
        if (nombre && telefono) {
          const key = nombre + "|" + telefono;
          if (!seen.has(key)) {
            clientesUnicos.push({ nombre, telefono });
            seen.add(key);
          }
        }
      });
      setClientes(clientesUnicos);
    });
    return () => unsubscribe();
  }, []);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [facturaOpen, setFacturaOpen] = useState(false);
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [ordenEstado, setOrdenEstado] = useState("");
  const [ordenAsc, setOrdenAsc] = useState(true);
  // Cambiar status y guardar en la base de datos
  const navigate = useNavigate();
  // usuario.email está disponible desde el contexto
  const usuarioActivo = usuario?.email || "";
  const handleStatusChange = async (id, newStatus) => {
    const vehiculo = vehiculos.find((v) => v.id === id);
    if (!vehiculo) return;
    // Limpiar campos undefined
    const data = { ...vehiculo, status: newStatus };
    Object.keys(data).forEach(k => {
      if (data[k] === undefined) data[k] = null;
    });
    await actualizarVehiculo(id, data);
    const actualizados = await obtenerVehiculos();
    setVehiculos(actualizados);
  };
  const [vehiculosRaw, setVehiculosRaw] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // Cargar vehículos y estados desde la API al montar
  useEffect(() => {
    const unsubscribe = escucharVehiculos((data) => {
      setVehiculosRaw(data);
      setLoadingVehiculos(false);
    });
    obtenerEstadosServicio().then((data) => {
      setEstadosServicio(data);
      setLoadingEstados(false);
    });
    return () => unsubscribe();
  }, []);

  // Filtrar vehículos solo cuando ambos estados estén listos
  useEffect(() => {
    if (!loadingVehiculos && !loadingEstados) {
      const estadoOcultar = estadosServicio.find(e => e.dejarDeMostrar);
      const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;
      const filtrados = vehiculosRaw.filter(
        (v) =>
          (v.status || v.estado) !== nombreOcultar &&
          (!ordenEstado || (v.status || v.estado) === ordenEstado)
      );
      setVehiculos(filtrados);
    }
  }, [vehiculosRaw, estadosServicio, ordenEstado, loadingVehiculos, loadingEstados]);
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
  const [formOriginal, setFormOriginal] = useState(null);
  const [editSection, setEditSection] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  // Estado para controlar edición de todas las secciones al registrar
  const isRegistering = editId === null;

  const handleOpen = (vehiculo) => {
    if (vehiculo) {
      const nuevoForm = {
        vehiculo: vehiculo.vehiculo || "",
        placa: vehiculo.placa || "",
        servicio: vehiculo.servicio || "",
        precio: vehiculo.precio || "",
        precioBs: vehiculo.precioBs || "",
        customerName: vehiculo.customerName || "",
        customerPhone: vehiculo.customerPhone || "",
        observaciones: vehiculo.observaciones || "",
      };
      setForm(nuevoForm);
      setFormOriginal(nuevoForm); // Guardar original
      setEditId(vehiculo.id);
      setEditSection(null);
      setIsEditing(false);
    } else {
      const nuevoForm = {
        vehiculo: "",
        placa: "",
        servicio: "",
        precio: "",
        customerName: "",
        customerPhone: "",
        observaciones: "",
      };
      setForm(nuevoForm);
      setFormOriginal(nuevoForm);
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
    setFormOriginal(null);
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
      vehiculo: form.vehiculo ? form.vehiculo.toUpperCase() : '',
      placa: form.placa ? form.placa.toUpperCase() : '',
      servicio: form.servicio ? form.servicio.toUpperCase() : '',
      arrivalTime: editId
        ? vehiculos.find((v) => v.id === editId)?.arrivalTime
        : Date.now(),
      customerName: form.customerName ? form.customerName.toUpperCase() : '',
      customerPhone: form.customerPhone,
      observaciones: form.observaciones ? form.observaciones.toUpperCase() : '',
      status: editId
        ? vehiculos.find((v) => v.id === editId)?.status || getDefaultStatus()
        : getDefaultStatus(),
      precio: form.precio === "" ? null : Number(form.precio),
      precioBs: form.precioBs === "" ? null : Number(form.precioBs),
      monto2: form.precio !== undefined && form.precio !== "" && form.precio !== null ? Number(form.precio) : null,
      usuario: usuarioActivo,
      registradoPor: usuarioActivo,
      entregadoPor: editId
        ? vehiculos.find((v) => v.id === editId)?.entregadoPor
        : null,
      fechaEntrega: editId
        ? vehiculos.find((v) => v.id === editId)?.fechaEntrega
        : null,
    };
    setActionLoading(true);
    // Limpiar campos undefined
    Object.keys(vehiculoData).forEach(k => {
      if (vehiculoData[k] === undefined) vehiculoData[k] = null;
    });
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
    if (!editId) {
      setSnackbarMsg("No se pudo eliminar: servicio no válido.");
      setSnackbarOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      await eliminarVehiculo(editId);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados);
      setActionLoading(false);
      handleClose();
      setConfirmDeleteOpen(false);
    } catch (e) {
      setActionLoading(false);
      setSnackbarMsg("Error al eliminar el servicio. Intente nuevamente.");
      setSnackbarOpen(true);
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

  const estadoOcultar = estadosServicio.find(e => e.dejarDeMostrar);
  const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: 4,
        maxWidth: "100%",
        width: "100%",
        px: { xs: 2, sm: 4 }
      }}
    >
      <AppHeader
        usuarioActivo={usuarioActivo}
        onLogout={() => {
          handleLogout();
          navigate("/");
        }}
        navigate={navigate}
      />
      <Divider sx={{ mb: 2 }} />
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          justifyContent: { xs: "center", sm: "space-between" },
          mb: 2,
          gap: { xs: 1.5, sm: 0 },
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", sm: "auto" },
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: { xs: "center", sm: "flex-start" },
          }}
        >
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              m: 0,
              fontSize: { xs: "1.25rem", sm: "2rem" },
              fontWeight: 600,
              textAlign: { xs: "center", sm: "left" },
              width: { xs: "auto", sm: "auto" },
            }}
          >
            Turbinas en servicio
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 400,
              fontSize: { xs: "1rem", sm: "1.25rem" },
              marginLeft: 1,
              textAlign: "center",
              minWidth: 40,
            }}
          >
            (
            {
              [...vehiculos].filter(
                (v) =>
                  (v.status || v.estado) !== nombreOcultar &&
                  (!ordenEstado || (v.status || v.estado) === ordenEstado)
              ).length
            }
            )
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={{
            width: { xs: "100%", sm: "auto" },
            maxWidth: { xs: 320, sm: "none" },
          }}
        >
          Registrar servicio
        </Button>
      </Box>
      {/* Resumen de trabajos por estado sincronizado */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          justifyContent: { xs: "center", sm: "space-between" },
          mb: 2,
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", sm: "row" },
            flexWrap: { xs: "wrap", sm: "nowrap" },
            gap: { xs: 1, sm: 4 },
            alignItems: { xs: "center", sm: "center" },
            width: { xs: "100%", sm: "auto" },
            justifyContent: { xs: "center", sm: "flex-start" },
          }}
        >
          {estadosServicio
            .filter((estado) => estado.nombre !== "entregado")
            .map((estado) => (
              <Typography
                key={estado.nombre}
                variant="body2"
                fontWeight={600}
                sx={{
                  textAlign: { xs: "center", sm: "left" },
                  width: { xs: "auto", sm: "auto" },
                  fontSize: { xs: "0.95rem", sm: "1.15rem" },
                  px: { xs: 0.5, sm: 0 },
                  color: estado.color === "grey"
                    ? '#757575'
                    : (theme) => theme.palette[estado.color]?.main || theme.palette.text.primary,
                }}
              >
                {estado.label}: {" "}
                {
                  vehiculos.filter(
                    (v) => (v.status || v.estado) === estado.nombre
                  ).length
                }
              </Typography>
            ))}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 1,
            width: { xs: "100%", sm: "auto" },
            mt: { xs: 1, sm: 0 },
          }}
        >
          <SortIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <Select
            size="small"
            value={ordenEstado}
            onChange={(e) => setOrdenEstado(e.target.value)}
            displayEmpty
            sx={{
              minWidth: 120,
              color: "text.secondary",
              width: { xs: "100%", sm: "auto" },
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {estadosServicio.map((estado) => (
              <MenuItem key={estado.nombre} value={estado.nombre}>
                {estado.label}
              </MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setOrdenAsc((prev) => !prev)}
            sx={{
              minWidth: 36,
              px: 1,
              color: "text.secondary",
              borderColor: "#b4b4b4ff",
              boxShadow: "none",
              width: { xs: "100%", sm: "auto" },
              mt: { xs: 1, sm: 0 },
              "&:hover": { bgcolor: "#e0e0e0" },
            }}
          >
            {ordenAsc ? "Asc" : "Desc"}
          </Button>
        </Box>
      </Box>
  {loadingVehiculos || loadingEstados ? (
        <Grid container spacing={3} columns={6} sx={{ mt: 1 }}>
          {[...Array(4)].map((_, idx) => (
            <Grid key={idx} sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 210,
                  minWidth: 210,
                  maxWidth: 210,
                  minHeight: 180,
                  mx: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: 0.8,
                  borderRadius: 2,
                  boxShadow: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Skeleton variant="rectangular" width={180} height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={120} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={80} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" width={180} height={18} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" width={60} height={32} sx={{ mt: 2 }} />
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          {/* Vista tabla en móviles */}
          <Box
            sx={{
              display: { xs: "block", sm: "none" },
              width: "100%",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                minWidth: 600,
                borderCollapse: "collapse",
                fontSize: "0.95rem",
                width: "100%",
              }}
            >
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Modelo
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Servicio
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Obs
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Hora
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...vehiculos]
                  .filter(
                    (v) =>
                      (v.status || v.estado) !== nombreOcultar &&
                      (!ordenEstado || (v.status || v.estado) === ordenEstado)
                  )
                  .sort((a, b) => {
                    if (!ordenEstado)
                      return ordenAsc
                        ? a.arrivalTime - b.arrivalTime
                        : b.arrivalTime - a.arrivalTime;
                    if (ordenAsc)
                      return (
                        (a.status || a.estado).localeCompare(
                          b.status || b.estado
                        ) || a.arrivalTime - b.arrivalTime
                      );
                    return (
                      (b.status || b.estado).localeCompare(
                        a.status || a.estado
                      ) || b.arrivalTime - a.arrivalTime
                    );
                  })
                  .map((v) => (
                    <tr
                      key={v.id}
                      style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                      onClick={() => handleOpen(v)}
                    >
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(
                          typeof v.arrivalTime === "string"
                            ? Number(v.arrivalTime)
                            : v.arrivalTime
                        ).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.vehiculo && v.vehiculo.toUpperCase()}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.servicio}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Chip
                          label={(() => {
                            const estadoObj = estadosServicio.find(
                              (e) => e.nombre === (v.status || v.estado)
                            );
                            return estadoObj?.label || v.status || v.estado;
                          })()}
                          color={(() => {
                            const estadoObj = estadosServicio.find(
                              (e) => e.nombre === (v.status || v.estado)
                            );
                            // Solo permitir colores válidos de MUI
                            const validColors = ["default", "primary", "secondary", "error", "info", "success", "warning"];
                            return validColors.includes(estadoObj?.color) ? estadoObj?.color : "default";
                          })()}
                          size="small"
                          sx={{ fontSize: "0.80rem", height: 24 }}
                        />
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.observaciones || "-"}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(
                          typeof v.arrivalTime === "string"
                            ? Number(v.arrivalTime)
                            : v.arrivalTime
                        ).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Box>
          {/* Vista cards en desktop/tablet */}
          <Grid
            container
            spacing={3}
            columns={6}
            sx={{ display: { xs: "none", sm: "flex" } }}
            mt={1}
          >
            {(() => {
              // Calcular el alto máximo de los VehicleCard
              const heights = [...vehiculos]
                .filter(
                  (v) =>
                    (v.status || v.estado) !== nombreOcultar &&
                    (!ordenEstado || (v.status || v.estado) === ordenEstado)
                )
                .map((v) => {
                  // Estimar el alto por cantidad de líneas de texto
                  let base = 180;
                  if (v.observaciones) base += 18;
                  if (v.servicio) base += 18;
                  if (v.vehiculo) base += 18;
                  return base;
                });
              const maxHeight = Math.max(...heights, 180);
              return [...vehiculos]
                .filter(
                  (v) =>
                    (v.status || v.estado) !== nombreOcultar &&
                    (!ordenEstado || (v.status || v.estado) === ordenEstado)
                )
                .sort((a, b) => {
                  if (!ordenEstado)
                    return ordenAsc
                      ? a.arrivalTime - b.arrivalTime
                      : b.arrivalTime - a.arrivalTime;
                  if (ordenAsc)
                    return (
                      (a.status || a.estado).localeCompare(
                        b.status || b.estado
                      ) || a.arrivalTime - b.arrivalTime
                    );
                  return (
                    (b.status || b.estado).localeCompare(a.status || a.estado) ||
                    b.arrivalTime - a.arrivalTime
                  );
                })
                .map((v) => (
                  <Grid
                    key={v.id}
                    sx={{ mb: 3 }}
                  >
                    <VehicleCard
                      vehiculo={v}
                      onEdit={() => handleOpen(v)}
                      onStatusChange={(newStatus) =>
                        handleStatusChange(v.id, newStatus)
                      }
                      height={maxHeight}
                    />
                  </Grid>
                ));
            })()}
          </Grid>
        </>
      )}
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
            handleClose();
          }
        }}
      >
        <DialogContent
          sx={{
            minWidth: { xs: "auto", sm: 400 },
            maxWidth: { xs: "100vw", sm: 500 },
            py: 2,
            position: "relative",
            display: { xs: "flex", sm: "block" },
            flexDirection: { xs: "column", sm: "initial" },
            alignItems: { xs: "center", sm: "initial" },
            justifyContent: { xs: "center", sm: "initial" },
            px: { xs: 2, sm: 3 },
          }}
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
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              {editId ? "Información del servicio" : "Registrar servicio"}
            </Typography>
            {editId && (
              <Box>
                <IconButton
                  onClick={handleDeleteClick}
                  color="error"
                  sx={{
                    display: { xs: "inline-flex", sm: "none" },
                    p: 0.5,
                    ml: 5,
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
                <Button
                  onClick={handleDeleteClick}
                  variant="outlined"
                  size="small"
                  color="error"
                  sx={{
                    display: { xs: "none", sm: "inline-flex" },
                    minWidth: 40,
                    px: 2,
                  }}
                >
                  Eliminar
                </Button>
              </Box>
            )}
          </Box>
          {editId &&
            (() => {
              const vehiculoActual = vehiculos.find((v) => v.id === editId);
              const estadoActual = estadosServicio.find(
                (e) =>
                  e.nombre ===
                  (vehiculoActual?.status || vehiculoActual?.estado)
              );
              // Validar color permitido por MUI
              const validColors = ["default", "primary", "secondary", "error", "info", "success", "warning"];
              const chipColor = validColors.includes(estadoActual?.color) ? estadoActual?.color : "default";
              return (
                <Box sx={{ width: "100%", display: "block" }}>
                  <Chip
                    label={
                      estadoActual?.label ||
                      vehiculoActual?.status ||
                      vehiculoActual?.estado ||
                      "Sin estado"
                    }
                    color={chipColor}
                    size="small"
                    sx={{
                      fontSize: "0.85rem",
                      height: 26,
                      mx: 0,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setVehiculoEstadoModal(vehiculoActual);
                      setOpenEstadoModal(true);
                    }}
                  />
                </Box>
              );
            })()}
          {/* Modal para cambiar estado */}
          <Dialog
            open={openEstadoModal}
            onClose={() => setOpenEstadoModal(false)}
          >
            <DialogTitle>Cambiar estado</DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 220,
                }}
              >
                {estadosServicio
                  .map((estado) => {
                    const validColors = ["default", "primary", "secondary", "error", "info", "success", "warning"];
                    let buttonColor = validColors.includes(estado.color) ? estado.color : "primary";
                    let sxButton = {
                      justifyContent: "flex-start",
                      textTransform: "none",
                      fontWeight: 600,
                    };
                    if (estado.color === "grey") {
                      buttonColor = "inherit";
                      sxButton = {
                        ...sxButton,
                        bgcolor: "#e0e0e0",
                        color: "#424242",
                        '&:hover': { bgcolor: "#bdbdbd" }
                      };
                    }
                    const esOcultar = !!estado.dejarDeMostrar;
                    return (
                      <>
                        <Button
                          key={estado.nombre}
                          variant={
                            vehiculoEstadoModal &&
                            (vehiculoEstadoModal.status === estado.nombre ||
                              vehiculoEstadoModal.estado === estado.nombre)
                              ? "contained"
                              : "outlined"
                          }
                          color={buttonColor}
                          onClick={() => {
                            if (!vehiculoEstadoModal) return;
                            if (esOcultar) {
                              setConfirmOcultar({ open: true, estado });
                            } else {
                              setOpenEstadoModal(false);
                              const data = sanitizeDeep({ ...vehiculoEstadoModal, status: estado.nombre });
                              actualizarVehiculo(vehiculoEstadoModal.id, data).then(async () => {
                                const actualizados = await obtenerVehiculos();
                                setVehiculos(actualizados);
                              });
                            }
                          }}
                          sx={sxButton}
                        >
                          {estado.label}
                        </Button>
                        {/* Modal de confirmación para dejar de mostrar */}
                        {esOcultar && confirmOcultar?.open && confirmOcultar.estado?.nombre === estado.nombre && (
                          <Dialog open={true} onClose={() => setConfirmOcultar({ open: false, estado: null })}>
                            <DialogTitle>Confirmar acción</DialogTitle>
                            <DialogContent>
                              <Typography>Este servicio desaparecerá del Dashboard. ¿Desea continuar?</Typography>
                            </DialogContent>
                            <DialogActions>
                              <Button onClick={() => setConfirmOcultar({ open: false, estado: null })} color="primary">Cancelar</Button>
                              <Button onClick={async () => {
                                setConfirmOcultar({ open: false, estado: null });
                                setOpenEstadoModal(false);
                                const data = sanitizeDeep({ ...vehiculoEstadoModal, status: estado.nombre });
                                await actualizarVehiculo(vehiculoEstadoModal.id, data);
                                const actualizados = await obtenerVehiculos();
                                setVehiculos(actualizados);
                              }} color="error" variant="contained">Confirmar</Button>
                            </DialogActions>
                          </Dialog>
                        )}
                      </>
                    );
                  })}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenEstadoModal(false)} color="primary">
                Cancelar
              </Button>
            </DialogActions>
          </Dialog>
          {/* Modal de confirmación para eliminar */}
          <Dialog
            open={confirmDeleteOpen}
            onClose={(event, reason) => {
              if (reason !== "backdropClick") {
                handleCancelDelete();
              }
            }}
          >
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
        <DialogContent
          sx={{
            minWidth: { xs: "auto", sm: 400 },
            maxWidth: { xs: "100vw", sm: 500 },
            display: { xs: "flex", sm: "block" },
            flexDirection: { xs: "column", sm: "initial" },
            alignItems: { xs: "center", sm: "initial" },
            justifyContent: { xs: "center", sm: "initial" },
            px: { xs: 1, sm: 3 },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: { xs: 0, sm: 1 },
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
          <Divider sx={{ mb: { xs: 0, sm: 1 } }} />
          <Box
            sx={{
              minHeight: 80,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              alignItems: { xs: "center", sm: "flex-start" },
              width: { xs: "100%", sm: "auto" },
              pl: { xs: 1, sm: 0 },
            }}
          >
            {editSection === "vehiculo" || isRegistering ? (
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
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "row", sm: "column" },
                  alignItems: { xs: "center", sm: "flex-start" },
                  gap: { xs: 1, sm: 0 },
                  width: "100%",
                  mb: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: { xs: "0.90rem", sm: "0.80rem" },
                    color: "text.secondary",
                    minWidth: 60,
                  }}
                >
                  Modelo:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: { xs: "1rem", sm: "1rem" },
                    fontWeight: 500,
                  }}
                >
                  {form.vehiculo && form.vehiculo.toUpperCase()}
                </Typography>
              </Box>
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
          <Divider sx={{ mb: { xs: 0, sm: 1 } }} />
          <Box
            sx={{
              minHeight: 110,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              alignItems: { xs: "center", sm: "flex-start" },
              width: { xs: "100%", sm: "auto" },
              pl: { xs: 1, sm: 0 },
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
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <TextField
                    margin="none"
                    label="Precio en $"
                    name="precio"
                    type="number"
                    size="small"
                    value={form.precio}
                    onChange={handleChange}
                    InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    margin="none"
                    label="Precio en Bs"
                    name="precioBs"
                    type="number"
                    size="small"
                    value={form.precioBs || ""}
                    onChange={handleChange}
                    InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                    sx={{ flex: 1 }}
                  />
                </Box>
                {/* Resultado de conversión */}
                {/* <PrecioConvertido precio={form.precio} /> */}
              </>
            ) : (
              <>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    alignItems: { xs: "flex-start", sm: "flex-start" },
                    gap: { xs: 0.5, sm: 0 },
                    width: "100%",
                    mb: 0.5,
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "0.90rem", sm: "0.80rem" },
                      color: "text.secondary",
                      minWidth: 60,
                      flexShrink: 0,
                    }}
                  >
                    Servicio:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1rem" },
                      fontWeight: 500,
                      wordBreak: "break-word",
                      whiteSpace: { xs: "pre-line", sm: "normal" },
                      maxWidth: { xs: "calc(100% - 70px)", sm: "100%" },
                    }}
                  >
                    {form.servicio}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    alignItems: { xs: "flex-start", sm: "flex-start" },
                    gap: { xs: 0.5, sm: 0 },
                    width: "100%",
                    mb: 0.5,
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "0.90rem", sm: "0.80rem" },
                      color: "text.secondary",
                      minWidth: 60,
                      flexShrink: 0,
                    }}
                  >
                    Observaciones:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1rem" },
                      fontWeight: 500,
                      wordBreak: "break-word",
                      whiteSpace: { xs: "pre-line", sm: "normal" },
                      maxWidth: { xs: "calc(100% - 70px)", sm: "100%" },
                    }}
                  >
                    {form.observaciones}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '1rem', color: 'text.secondary', minWidth: 60, flexShrink: 0 }}
                  >
                    Precio:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '1rem', fontWeight: 500, wordBreak: 'break-word', maxWidth: '100%' }}
                  >
                    ${form.precio} / Bs {form.precioBs || "-"}
                  </Typography>
                </Box>
                {/* <PrecioConvertido precio={form.precio} /> */}
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
              alignItems: { xs: "center", sm: "flex-start" },
              width: { xs: "100%", sm: "auto" },
              pl: { xs: 1, sm: 0 },
            }}
          >
            {editSection === "cliente" || isRegistering ? (
              <>
                <Autocomplete
                  options={clientes}
                  getOptionLabel={(opt) =>
                    opt.nombre + (opt.telefono ? ` (${opt.telefono})` : "")
                  }
                  value={null}
                  inputValue={form.customerName}
                  onInputChange={(e, newInputValue, reason) => {
                    if (reason === 'input') {
                      setForm({ ...form, customerName: newInputValue });
                      setIsEditing(true);
                    }
                  }}
                  onChange={(e, value) => {
                    if (value && value.nombre) {
                      setForm({
                        ...form,
                        customerName: value.nombre,
                        customerPhone: value.telefono,
                      });
                      setIsEditing(true);
                    }
                  }}
                  sx={{ width: "100%" }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      margin="none"
                      label="Cliente (Nombre)"
                      name="customerName"
                      fullWidth
                      size="small"
                      sx={{ mb: 1.5, width: "100%" }}
                      InputProps={{
                        ...params.InputProps,
                        sx: { fontSize: "1rem", py: 0.5 },
                      }}
                    />
                  )}
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
                    setIsEditing(true);
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
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    alignItems: { xs: "center", sm: "flex-start" },
                    gap: { xs: 1, sm: 0 },
                    width: "100%",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "0.90rem", sm: "0.80rem" },
                      color: "text.secondary",
                      minWidth: 60,
                    }}
                  >
                    Cliente:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1rem" },
                      fontWeight: 500,
                    }}
                  >
                    {form.customerName}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    alignItems: { xs: "center", sm: "flex-start" },
                    gap: { xs: 1, sm: 0 },
                    width: "100%",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "0.90rem", sm: "0.80rem" },
                      color: "text.secondary",
                      minWidth: 60,
                    }}
                  >
                    Teléfono:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1rem" },
                      fontWeight: 500,
                    }}
                  >
                    {form.customerPhone}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            px: 3,
            mb: 2,
            gap: { xs: 1, sm: 0 },
          }}
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
                      if (formOriginal) {
                        setForm(formOriginal);
                      }
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
                      startIcon={
                        actionLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null
                      }
                    >
                      {actionLoading ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {/* WhatsApp button: en una fila separada en móvil, inline en desktop */}
                  <Box
                    sx={{
                      width: "100%",
                      display: { xs: "flex", sm: "inline-flex" },
                      flexDirection: { xs: "row", sm: "row" },
                      justifyContent: { xs: "center", sm: "flex-start" },
                      mb: { xs: 1, sm: 0 },
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      startIcon={<WhatsAppIcon />}
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
                      sx={{
                        minWidth: 120,
                        justifyContent: "center",
                        textAlign: "center",
                        px: 2,
                      }}
                    >
                      <Box sx={{ display: { xs: "inline", sm: "none" } }}>
                        Enviar
                      </Box>
                      <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                        Enviar WhatsApp
                      </Box>
                    </Button>
                  </Box>
                  {/* Botones Facturar y Volver juntos en la esquina inferior derecha */}
                  {editId && !editSection && !isRegistering && (
                    <Box
                      sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: { xs: "center", sm: "flex-end" },
                        gap: 1,
                        pb: 0,
                      }}
                    >
                      <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        color="primary"
                      >
                        Volver
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<PointOfSaleIcon />}
                        onClick={() => setFacturaOpen(true)}
                      >
                        Facturar
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </DialogActions>
        <PaymentModal
          open={facturaOpen}
          onClose={() => setFacturaOpen(false)}
          form={form}
          onRegister={async (facturaData) => {
            // Validar que exista al menos un precio
            if ((form.precio === "" || form.precio === null) && (form.precioBs === "" || form.precioBs === null)) {
              setSnackbarMsg("No se ha definido un precio para este servicio. No se puede registrar el pago.");
              setSnackbarOpen(true);
              return;
            }
            // Si el modal envía formasPago, usarlo y eliminar los campos sueltos
            let nuevoIngreso = {
              descripcion: `${form.vehiculo} - ${form.servicio}`,
              factura: facturaData.numeroFactura,
              fecha: new Date().toLocaleDateString("es-VE"),
              vehiculoId: editId || null,
              montoBs: form.precioBs !== undefined && form.precioBs !== "" && form.precioBs !== null ? Number(form.precioBs) : null,
              monto2: form.precio !== undefined && form.precio !== "" && form.precio !== null ? Number(form.precio) : null,
            };
            // monto2 SIEMPRE debe crearse con el input precio en $
            nuevoIngreso.monto2 = form.precio !== undefined && form.precio !== "" && form.precio !== null ? Number(form.precio) : null;
            if (Array.isArray(facturaData.formasPago) && facturaData.formasPago.length > 0) {
              nuevoIngreso.formasPago = facturaData.formasPago;
            } else {
              // Lógica anterior para una sola forma de pago
              let monto = facturaData.monto !== undefined && facturaData.monto !== null && facturaData.monto !== ""
                ? Number(facturaData.monto)
                : (facturaData.formaPago && /pago[ _-]?movil/i.test(facturaData.formaPago)
                    ? Number(form.precioBs) || 0
                    : (facturaData.formaPago && (/zelle/i.test(facturaData.formaPago) || /efectivo/i.test(facturaData.formaPago))
                        ? Number(form.precio) || 0
                        : Number(form.precio) || Number(form.precioBs) || 0));
              nuevoIngreso.monto = monto;
              nuevoIngreso.formaPago = facturaData.formaPago;
              nuevoIngreso.referencia = facturaData.referencia;
            }
            try {
              const { guardarIngreso } = await import(
                "../lib/ingresosFirebase"
              );
              await guardarIngreso(nuevoIngreso);
            } catch (e) {
              setSnackbarMsg("Error al registrar el ingreso");
              setSnackbarOpen(true);
              return;
            }
            // Actualizar el estado del vehículo al estado defaultFacturar y guardar entregadoPor y fechaEntrega
            if (editId) {
              // Buscar el estado defaultFacturar
              const estadoFacturar = estadosServicio.find(
                (e) => e.defaultFacturar
              );
              const statusFacturar = estadoFacturar
                ? estadoFacturar.nombre
                : "entregado";
              const vehiculoUpdate = {
                ...form,
                status: statusFacturar,
                entregadoPor: usuarioActivo,
                fechaEntrega: Date.now(),
                registradoPor:
                  vehiculos.find((v) => v.id === editId)?.registradoPor ||
                  vehiculos.find((v) => v.id === editId)?.usuario ||
                  null,
                precioBs: Number(form.precioBs) || null,
              };
              Object.keys(vehiculoUpdate).forEach(k => {
                if (vehiculoUpdate[k] === undefined) vehiculoUpdate[k] = null;
              });
              await actualizarVehiculo(editId, vehiculoUpdate);
              const actualizados = await obtenerVehiculos();
              setVehiculos(actualizados);
            }
            setSnackbarMsg("Pago registrado exitosamente");
            setSnackbarOpen(true);
            setOpen(false);
          }}
        />
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
