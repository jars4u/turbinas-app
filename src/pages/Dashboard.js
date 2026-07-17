import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  TextField,
  Snackbar,
  Alert,
  useMediaQuery,
  Container,
  Skeleton,
  Fade,
  Tooltip,
  IconButton,
} from "@mui/material";
import VehicleCard from "../components/VehicleCard";
import Layout from "../components/Layout";
import { obtenerFactorConversion } from "../lib/factorConversionFirebase";
import {
  obtenerVehiculos,
  escucharVehiculos,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
} from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import { formatTiempoRelativo, obtenerColorAging } from "../lib/dateUtils";
import AddIcon from "@mui/icons-material/Add";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import ReporteDia from "../components/ReporteDia";
import PaymentModal from "../components/PaymentModal";
import { obtenerInicioSnapshot, crearInicioSnapshotSiNoExiste } from "../lib/reporteDiaSnapshotFirebase";
import ServicioEditorDialog from "../components/dashboard/ServicioEditorDialog";
import EstadoChangeDialog from "../components/dashboard/EstadoChangeDialog";
import { normalizeClientes } from "../lib/clientesFirebase";

// Sanitiza cualquier undefined en null, recursivamente
function sanitizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    Object.keys(obj).forEach((k) => {
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

// Log condicional para depuración del Reporte del Día
const debugReporte = (...args) => {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('debugReporteDia') === '1') {
      console.debug('[ReporteDia][DBG]', ...args);
    }
  } catch (_) { /* noop */ }
};

export default function Dashboard() {
  const isXs = useMediaQuery('(max-width:600px)');
  const [factorConversion, setFactorConversion] = useState(1);
  const [openReporteDia, setOpenReporteDia] = useState(false);
  // Modal para fijar manualmente "servicios al inicio" al comenzar el día
  const [openInicioModal, setOpenInicioModal] = useState(false);
  const [inicioSugerido, setInicioSugerido] = useState(0);
  const [inicioManual, setInicioManual] = useState("");
  // Estado de 'inicio hoy' eliminado para evitar variable no usada
  // Bloqueo de navegación atrás en móviles
  useEffect(() => {
    const handlePopState = (e) => {
      // Evita salir del dashboard, redirige a la misma página
      window.history.pushState(null, '', window.location.pathname);
    };
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  // Estado para el modal de confirmación de ocultar servicio (migrado al componente EstadoChangeDialog)
  const { usuario, isObserver } = useAuth();
  // Estado para modal de cambio de estado
  const [openEstadoModal, setOpenEstadoModal] = useState(false);
  const [vehiculoEstadoModal, setVehiculoEstadoModal] = useState(null);
  // Clientes base: extraer de vehículos
  const [clientes, setClientes] = useState([]);
  useEffect(() => {
    const unsubscribe = escucharVehiculos((data) => {
      const clientesNormalizados = normalizeClientes(
        data.map((vehiculo) => ({
          nombre: vehiculo.customerName,
          telefono: vehiculo.customerPhone,
        }))
      );
      setClientes(clientesNormalizados);
    });
    return () => unsubscribe();
  }, []);

  // Cargar factor de conversión al iniciar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const val = await obtenerFactorConversion();
        if (mounted && typeof val === 'number' && !isNaN(val) && val > 0) {
          setFactorConversion(val);
          // Si ya hay precio en $, recalcular Bs automáticamente con el factor cargado
          setForm((prev) => {
            const p = parseFloat(prev?.precio);
            if (!isNaN(p)) {
              const bs = (p * val).toFixed(2);
              return { ...prev, precioBs: bs };
            }
            return prev;
          });
        }
      } catch (_) {
        // en caso de error, mantener factor por defecto (1)
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [facturaOpen, setFacturaOpen] = useState(false);
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [ordenEstado, setOrdenEstado] = useState("");
  const [ordenAsc, setOrdenAsc] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [now, setNow] = useState(Date.now());

  // Actualizar el tiempo transcurrido cada minuto (para el indicador de aging en móvil)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  // Cambiar status y guardar en la base de datos
  // const navigate = useNavigate(); // no usado directamente tras Layout
  // usuario.email está disponible desde el contexto
  const usuarioActivo = usuario?.email || "";
  const handleStatusChange = async (id, newStatus) => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes cambiar estados.");
      setSnackbarOpen(true);
      return;
    }
    const vehiculo = vehiculos.find((v) => v.id === id);
    if (!vehiculo) return;
    // Verificar si el estado destino es "dejar de mostrar"
    const estadoObj = estadosServicio.find(e => e.nombre === newStatus);
    const esOcultar = !!estadoObj?.dejarDeMostrar;
    const payload = {
      ...vehiculo,
      status: newStatus,
      // Si es estado final (ocultar), fijar fecha de entrega y quién entregó
      ...(esOcultar ? { fechaEntrega: Date.now(), entregadoPor: (usuarioActivo ? String(usuarioActivo).split('@')[0] : null) } : {}),
    };
    // Limpiar undefined
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) payload[k] = null;
    });
    await actualizarVehiculo(id, payload);
    const actualizados = await obtenerVehiculos();
    setVehiculos(actualizados.filter(v => (v.status || v.estado) !== 'por_cobrar'));
  };
  const [vehiculosRaw, setVehiculosRaw] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [creatingSkeleton, setCreatingSkeleton] = useState(false);
  // Estado local para UI temporal (no usado actualmente)
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

  // Helper: normaliza status a código en minúsculas con underscores
  const normalizeStatus = (v) => (v == null ? '' : String(v)).trim().toLowerCase().replace(/\s+/g, '_');
  // Calcula "inicio" según criterio: status distinto de 'entregado' y 'por_cobrar'
  const calcularInicioHoy = React.useCallback((arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, s) => {
      const code = normalizeStatus(s.status || s.estado);
      return acc + (code !== 'entregado' && code !== 'por_cobrar' ? 1 : 0);
    }, 0);
  }, []);

  // Normalizador y coincidencia para el buscador (acentos-insensible, minúsculas)
  const normalizarTexto = (s) =>
    s ? String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  const coincideBusqueda = (v, q) => {
    const t = normalizarTexto(q);
    if (!t) return true;
    const blob = [
      v.vehiculo,
      v.placa,
      v.servicio,
      v.customerName,
      v.customerPhone,
      v.observaciones,
      v.status || v.estado,
    ]
      .map(normalizarTexto)
      .join(' ');
    return blob.includes(t);
  };

  // Si el snapshot de HOY no existe al cargar los vehículos, abrir modal para fijarlo manualmente
  useEffect(() => {
    async function checkTodayInicio() {
      try {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        debugReporte('inicio-manual: checking snapshot', { todayStr });
  const snap = await obtenerInicioSnapshot(todayStr);
        if (!snap) {
          // Calcular un valor sugerido (no se fija automáticamente)
          const arr = await obtenerVehiculos();
          const valor = calcularInicioHoy(Array.isArray(arr) ? arr : vehiculosRaw);
          setInicioSugerido(valor);
          setInicioManual(String(valor));
          setOpenInicioModal(true);
          debugReporte('inicio-manual: abrir modal', { sugerido: valor, totalVehiculosFetched: Array.isArray(arr) ? arr.length : 'n/a', totalVehiculosLocal: vehiculosRaw?.length ?? 'n/a' });
        } else {
          debugReporte('inicio-manual: snapshot ya existe', { fecha: todayStr, inicio: snap?.inicio });
        }
      } catch (e) {
        debugReporte('inicio-manual: error', e?.message || e);
        console.warn('No se pudo verificar snapshot de hoy', e);
      }
    }
    if (!loadingVehiculos) {
      checkTodayInicio();
    }
  }, [loadingVehiculos, calcularInicioHoy, vehiculosRaw]);

  const confirmarInicioDia = async () => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes guardar el inicio del día.");
      setSnackbarOpen(true);
      return;
    }
    try {
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const valor = Math.max(0, parseInt(String(inicioManual).replace(/[^\d-]/g, ''), 10) || 0);
      const snap = await obtenerInicioSnapshot(todayStr);
      if (snap && typeof snap.inicio === 'number') {
        setOpenInicioModal(false);
        setSnackbarMsg('El inicio del día ya estaba fijado');
        setSnackbarOpen(true);
        debugReporte('inicio-manual: ya existía snapshot hoy', { fecha: todayStr, inicio: snap.inicio });
        return;
      }
      // Crear solo si no existe (fijo por todo el día)
  const definitivo = await crearInicioSnapshotSiNoExiste(todayStr, valor, { fuente: 'manual', usuario: usuarioActivo || null });
      setOpenInicioModal(false);
      setSnackbarMsg('Inicio del día fijado');
      setSnackbarOpen(true);
      debugReporte('inicio-manual: snapshot creado', { fecha: todayStr, valor: definitivo });
    } catch (e) {
      console.warn('No se pudo fijar el inicio del día', e);
      debugReporte('inicio-manual: error al crear snapshot', e?.message || e);
    }
  };

  // Función abrirInicioManual eliminada (no utilizada)

  // Filtrar vehículos solo cuando ambos estados estén listos
  useEffect(() => {
    if (!loadingVehiculos && !loadingEstados) {
      const estadoOcultar = estadosServicio.find((e) => e.dejarDeMostrar);
      const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;
      const filtrados = vehiculosRaw.filter(
        (v) =>
          (v.status || v.estado) !== nombreOcultar &&
          (v.status !== 'por_cobrar') &&
          (!ordenEstado || (v.status || v.estado) === ordenEstado)
      );
      setVehiculos(filtrados);
    }
  }, [
    vehiculosRaw,
    estadosServicio,
    ordenEstado,
    loadingVehiculos,
    loadingEstados,
  ]);
  const [open, setOpen] = useState(false);
  // Estado para el modal de confirmación de eliminación
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    vehiculo: "",
    placa: "",
    servicio: "",
    precio: "",
    precioBs: "",
    customerName: "",
    customerPhone: "+58",
    observaciones: "",
  });
  const [formOriginal, setFormOriginal] = useState(null);
  const [editSection, setEditSection] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  // Estado para controlar edición de todas las secciones al registrar
  const isRegistering = editId === null;

  const handleOpen = (vehiculo) => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes registrar ni editar servicios.");
      setSnackbarOpen(true);
      return;
    }
    if (vehiculo) {
      const nuevoForm = {
        vehiculo: vehiculo.vehiculo || "",
        placa: vehiculo.placa || "",
        servicio: vehiculo.servicio || "",
        precio: vehiculo.precio || "",
        precioBs: vehiculo.precioBs || "",
        customerName: vehiculo.customerName || "",
        customerPhone: vehiculo.customerPhone || "+58",
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
        precioBs: "",
        customerName: "",
        customerPhone: "+58",
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
      precioBs: "",
      customerName: "",
      customerPhone: "+58",
      observaciones: "",
    });
    setFormOriginal(null);
    setEditId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const f = parseFloat(factorConversion);
    if (name === "precio") {
      const p = parseFloat(value);
      let nuevoPrecioBs = "";
      if (!isNaN(p) && !isNaN(f) && f > 0) {
        nuevoPrecioBs = (p * f).toFixed(2);
      }
      setForm({ ...form, precio: value, precioBs: nuevoPrecioBs });
    } else if (name === "precioBs") {
      const bs = parseFloat(value);
      let nuevoPrecio = "";
      if (!isNaN(bs) && !isNaN(f) && f > 0) {
        nuevoPrecio = (bs / f).toFixed(2);
      }
      setForm({ ...form, precioBs: value, precio: nuevoPrecio });
    } else {
      setForm({ ...form, [name]: value });
    }
    setIsEditing(true);
  };

  const getDefaultStatus = () => {
    const def = estadosServicio.find((e) => e.defaultEstado);
    return def ? def.nombre : "servicio";
  };

  const handleSave = async () => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes guardar cambios.");
      setSnackbarOpen(true);
      return;
    }

    // Bloquear edición si el servicio está cerrado (estado defaultFacturar)
    if (editId) {
      const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar)?.nombre;
      const vehiculoActual = vehiculos.find((v) => v.id === editId);
      const estadoActual = vehiculoActual?.status || vehiculoActual?.estado;
      if (estadoFacturar && estadoActual === estadoFacturar) {
        const labelFacturar = estadosServicio.find((e) => e.defaultFacturar)?.label || estadoFacturar;
        setSnackbarMsg(`Este servicio está cerrado (${labelFacturar}) y no puede editarse.`);
        setSnackbarOpen(true);
        return;
      }
    }

    // Validación y normalización del teléfono: formato +58 seguido de 10 dígitos, sin ceros iniciales
    let telefono = (form.customerPhone || "").trim();
    telefono = telefono.replace(/[-\s]/g, "");
    if (telefono) {
      // Si no empieza con +58, intentar normalizar de formatos comunes (0412..., 412..., etc)
      if (!telefono.startsWith("+58")) {
        if (telefono.startsWith("58")) {
          telefono = "+" + telefono;
        } else if (telefono.startsWith("0") && telefono.length >= 11) {
          telefono = "+58" + telefono.slice(1); // quita el 0 inicial
        } else if (/^\d{10}$/.test(telefono)) {
          telefono = "+58" + telefono;
        }
      }
      // Asegurar que no haya ceros iniciales en la parte local después de +58
      if (telefono.startsWith("+58")) {
        const local = telefono.slice(3).replace(/[^\d]/g, "");
        telefono = "+58" + local.replace(/^0+/, "");
      }
      // Validar finalmente el patrón requerido
      if (!/^\+58\d{10}$/.test(telefono)) {
        setSnackbarMsg("Teléfono inválido: use +58 y 10 dígitos sin ceros iniciales.");
        setSnackbarOpen(true);
        return;
      }
    }
    const vehiculoData = {
      vehiculo: form.vehiculo ? form.vehiculo.toUpperCase() : "",
      placa: form.placa ? form.placa.toUpperCase() : "",
      servicio: form.servicio ? form.servicio.toUpperCase() : "",
      arrivalTime: editId
        ? vehiculos.find((v) => v.id === editId)?.arrivalTime
        : Date.now(),
      customerName: form.customerName ? form.customerName.toUpperCase() : "",
      customerPhone: telefono || "",
      observaciones: form.observaciones ? form.observaciones.toUpperCase() : "",
      status: editId
        ? vehiculos.find((v) => v.id === editId)?.status || getDefaultStatus()
        : getDefaultStatus(),
      precio: form.precio === "" ? null : Number(form.precio),
      precioBs: form.precioBs === "" ? null : Number(form.precioBs),
      monto2:
        form.precio !== undefined && form.precio !== "" && form.precio !== null
          ? Number(form.precio)
          : null,
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
  if (!editId) setCreatingSkeleton(true);
    // Limpiar campos undefined
    Object.keys(vehiculoData).forEach((k) => {
      if (vehiculoData[k] === undefined) vehiculoData[k] = null;
    });
    // Guardar cliente en la colección 'clientes' si no existe
    try {
      const nombreCliente = vehiculoData.customerName?.trim().toUpperCase();
      const telefonoCliente = vehiculoData.customerPhone?.trim();
      if (nombreCliente && telefonoCliente) {
        const { getFirestore, collection, getDocs, query, where, addDoc, updateDoc, doc } = await import("firebase/firestore");
        const db = getFirestore();
        const clientesRef = collection(db, "clientes");
        const q = query(clientesRef, where("nombre", "==", nombreCliente), where("telefono", "==", telefonoCliente));
        const snapshot = await getDocs(q);
        // Nuevo registro de modelo/servicio
        const nuevoModeloServicio = {
          fecha: Date.now(),
          modelo: vehiculoData.vehiculo,
          servicio: vehiculoData.servicio,
          nombre: nombreCliente,
          telefono: telefonoCliente
        };
        if (snapshot.empty) {
          await addDoc(clientesRef, {
            nombre: nombreCliente,
            telefono: telefonoCliente,
            modelosServicios: [nuevoModeloServicio]
          });
        } else {
          // Actualizar el historial del cliente existente
          const clienteDoc = snapshot.docs[0];
          const modelosServiciosPrevios = clienteDoc.data().modelosServicios || [];
          await updateDoc(doc(db, "clientes", clienteDoc.id), {
            modelosServicios: [...modelosServiciosPrevios, nuevoModeloServicio]
          });
        }
      }
    } catch (e) {
      // No bloquear el registro si falla el guardado del cliente
    }
    if (editId) {
      await actualizarVehiculo(editId, vehiculoData);
      // Actualización normal: ocultar loading y refrescar
      setActionLoading(false);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados.filter(v => (v.status || v.estado) !== 'por_cobrar'));
    } else {
      // CREACIÓN NUEVA: ocultamos inmediatamente el skeleton de la lista y mantenemos el overlay del modal
      setCreatingSkeleton(false); // oculta skeleton ANTES de que aparezca el nuevo card
      await crearVehiculo(vehiculoData);
      // Refrescar lista
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados.filter(v => (v.status || v.estado) !== 'por_cobrar'));
      setActionLoading(false);
    }
    setOpen(false);
    setEditSection(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes eliminar servicios.");
      setSnackbarOpen(true);
      return;
    }
    if (!editId) {
      setSnackbarMsg("No se pudo eliminar: servicio no válido.");
      setSnackbarOpen(true);
      return;
    }

    // Bloquear eliminación si el servicio está cerrado (estado defaultFacturar)
    {
      const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar)?.nombre;
      const vehiculoActual = vehiculos.find((v) => v.id === editId);
      const estadoActual = vehiculoActual?.status || vehiculoActual?.estado;
      if (estadoFacturar && estadoActual === estadoFacturar) {
        const labelFacturar = estadosServicio.find((e) => e.defaultFacturar)?.label || estadoFacturar;
        setSnackbarMsg(`Este servicio está cerrado (${labelFacturar}) y no puede eliminarse.`);
        setSnackbarOpen(true);
        return;
      }
    }

    setActionLoading(true);
    try {
      await eliminarVehiculo(editId);
      const actualizados = await obtenerVehiculos();
      setVehiculos(actualizados.filter(v => (v.status || v.estado) !== 'por_cobrar'));
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

  const estadoOcultar = estadosServicio.find((e) => e.dejarDeMostrar);
  const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;

  // Lista única de servicios filtrados (estado + búsqueda) y ordenados, reutilizada
  // por el contador del título, la vista móvil y la vista desktop.
  const serviciosFiltrados = [...vehiculos]
    .filter(
      (v) =>
        (v.status || v.estado) !== nombreOcultar &&
        (!ordenEstado || (v.status || v.estado) === ordenEstado) &&
        coincideBusqueda(v, busqueda)
    )
    .sort((a, b) => {
      if (!ordenEstado)
        return ordenAsc
          ? a.arrivalTime - b.arrivalTime
          : b.arrivalTime - a.arrivalTime;
      if (ordenAsc)
        return (
          (a.status || a.estado).localeCompare(b.status || b.estado) ||
          a.arrivalTime - b.arrivalTime
        );
      return (
        (b.status || b.estado).localeCompare(a.status || a.estado) ||
        b.arrivalTime - a.arrivalTime
      );
    });

  const hayFiltrosActivos = Boolean(ordenEstado) || Boolean(busqueda);

  const EstadoVacio = () => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: 6,
        px: 2,
        color: "text.secondary",
      }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
      <Typography variant="body2" sx={{ mb: hayFiltrosActivos ? 1.5 : 0 }}>
        {hayFiltrosActivos
          ? "No hay servicios que coincidan con este filtro"
          : "No hay turbinas en servicio en este momento"}
      </Typography>
      {hayFiltrosActivos && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setOrdenEstado("");
            setBusqueda("");
          }}
        >
          Quitar filtros
        </Button>
      )}
    </Box>
  );

  return (
    <Layout searchValue={busqueda} onSearchChange={setBusqueda}>
      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 2, sm: 4 },
          maxWidth: "100%",
          width: "100%",
          px: { xs: 2, sm: 4 },
        }}
      >
      <Divider sx={{ mb: { xs: 1.5, sm: 2 } }} />
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          mb: { xs: 1.5, sm: 2 },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: { xs: "center", sm: "flex-start" },
            gap: 1,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              m: 0,
              fontSize: { xs: "1.25rem", sm: "2rem" },
              fontWeight: 600,
              textAlign: { xs: "center", sm: "left" },
            }}
          >
            Turbinas en servicio
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 400,
              fontSize: { xs: "1rem", sm: "1.25rem" },
              color: "text.secondary",
            }}
          >
            (
            {serviciosFiltrados.length}
            )
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            justifyContent: { xs: "center", sm: "flex-end" },
          }}
        >
          <Tooltip title="Reporte semanal" arrow>
            <IconButton
              size="small"
              onClick={() => setOpenReporteDia(true)}
              aria-label="Ver reporte semanal"
              sx={{
                color: "#616161",
                border: "1px solid #bdbdbd",
                borderRadius: 1.5,
              }}
            >
              <AssessmentOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
            disabled={isObserver}
            sx={{
              boxShadow: "none",
              width: { xs: "100%", sm: "auto" },
              maxWidth: { xs: 320, sm: "none" },
            }}
          >
            Registrar servicio
          </Button>
        </Box>
      {/* Modal ReporteDia */}
      <ReporteDia
        open={openReporteDia}
        onClose={() => setOpenReporteDia(false)}
        servicios={vehiculosRaw}
        fecha={(() => { const d = new Date(); const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; })()}
      />
      {/* Modal: Fijar servicios al inicio del día (manual) */}
      <Dialog
        open={openInicioModal}
        fullWidth
        maxWidth="xs"
        onClose={() => setOpenInicioModal(false)}
      >
        <DialogTitle>Servicios al inicio del día</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Puedes fijar manualmente el número de servicios al inicio del día.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Sugerido: {inicioSugerido}
          </Typography>
          <TextField
            label="Servicios al inicio"
            type="number"
            fullWidth
            size="small"
            value={inicioManual}
            onChange={(e) => setInicioManual(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInicioModal(false)} color="inherit" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Cancelar
          </Button>
          <Button onClick={confirmarInicioDia} variant="contained" color="primary" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
      {/* Barra unificada: filtro por estado (chips) + orden */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 2,
          overflowX: "auto",
          overflowY: "hidden",
          pb: 0.5,
          "&::-webkit-scrollbar": { height: 4 },
        }}
      >
        <Chip
          label={`Todos (${
            vehiculosRaw.filter(
              (v) =>
                (v.status || v.estado) !== nombreOcultar &&
                v.status !== "por_cobrar" &&
                coincideBusqueda(v, busqueda)
            ).length
          })`}
          size="small"
          onClick={() => setOrdenEstado("")}
          color={!ordenEstado ? "primary" : "default"}
          variant={!ordenEstado ? "filled" : "outlined"}
          sx={{ flexShrink: 0 }}
        />
        {estadosServicio
          .filter((estado) => estado.nombre !== "entregado")
          .map((estado) => {
            const validColors = [
              "default",
              "primary",
              "secondary",
              "error",
              "info",
              "success",
              "warning",
            ];
            const chipColor = validColors.includes(estado.color)
              ? estado.color
              : "default";
            const count = vehiculosRaw.filter(
              (v) =>
                (v.status || v.estado) === estado.nombre &&
                v.status !== "por_cobrar" &&
                coincideBusqueda(v, busqueda)
            ).length;
            const active = ordenEstado === estado.nombre;
            return (
              <Chip
                key={estado.nombre}
                label={`${estado.label} (${count})`}
                size="small"
                onClick={() => setOrdenEstado(active ? "" : estado.nombre)}
                color={active ? chipColor : "default"}
                variant={active ? "filled" : "outlined"}
                sx={{ flexShrink: 0 }}
              />
            );
          })}
        <Box sx={{ flex: 1, minWidth: 8 }} />
        <Tooltip title={ordenAsc ? "Más antiguos primero" : "Más recientes primero"} arrow>
          <IconButton
            size="small"
            onClick={() => setOrdenAsc((prev) => !prev)}
            aria-label="Cambiar orden"
            sx={{ color: "text.secondary", flexShrink: 0 }}
          >
            {ordenAsc ? (
              <ArrowUpwardIcon fontSize="small" />
            ) : (
              <ArrowDownwardIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      {loadingVehiculos || loadingEstados ? (
        isXs ? (
          <Box sx={{ mt: 1 }}>
            {[...Array(14)].map((_, idx) => (
              <Box
                key={idx}
                sx={{
                  mb: 1.5,
                  p: 1,
                  borderRadius: 1.5,
                  boxShadow: 1,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Encabezado: título izquierda + chip derecha */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Skeleton variant="text" width="40%" height={24} />
                  <Skeleton variant="rounded" width={80} height={22} />
                </Box>
                {/* Servicio */}
                <Skeleton variant="text" width="60%" sx={{ mb: 0.5 }} />
                {/* Bloque datos + fecha/hora */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Skeleton variant="text" width={160} height={18} sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width={100} height={14} />
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Skeleton variant="text" width={70} height={14} />
                    <Skeleton variant="text" width={50} height={14} />
                  </Box>
                </Box>
                {/* Observaciones */}
                <Skeleton variant="text" width="80%" height={14} sx={{ mt: 0.5 }} />
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 3,
              mt: 1,
            }}
          >
            {[...Array(12)].map((_, idx) => (
              <Box key={idx}>
                <Box
                  sx={{
                    width: "100%",
                    minHeight: 180,
                    display: "flex",
                    flexDirection: "column",
                    p: 0.8,
                    borderRadius: 2,
                    boxShadow: 2,
                    bgcolor: "background.paper",
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Fila superior: fecha/hora a la izquierda y chip a la derecha */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Skeleton variant="text" width={70} height={12} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width={90} height={12} />
                    </Box>
                    <Skeleton variant="rounded" width={90} height={22} />
                  </Box>
                  {/* Divider simulado */}
                  <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 1, opacity: 0.4 }} />
                  {/* Cliente y teléfono */}
                  <Box sx={{ mb: 0.5 }}>
                    <Skeleton variant="text" width={150} height={14} sx={{ mb: 0.3 }} />
                    <Skeleton variant="text" width={110} height={14} />
                  </Box>
                  {/* Subtítulo */}
                  <Skeleton variant="text" width={140} height={16} sx={{ mb: 0.5 }} />
                  {/* Vehículo y servicio */}
                  <Skeleton variant="rectangular" width={180} height={18} sx={{ mb: 0.5 }} />
                  <Skeleton variant="rectangular" width={160} height={18} sx={{ mb: 0.5 }} />
                  {/* Observaciones */}
                  <Skeleton variant="text" width={150} height={14} />
                </Box>
              </Box>
            ))}
          </Box>
        )
      ) : (
        <>
          {/* Vista móvil: lista tipo tarjeta */}
          <Box
            sx={{
              display: { xs: "block", sm: "none" },
              width: "100%",
            }}
          >
            {serviciosFiltrados.length === 0 ? (
              <EstadoVacio />
            ) : (
              serviciosFiltrados.map((v) => {
                const estadoObj = estadosServicio.find(
                  (e) => e.nombre === (v.status || v.estado)
                );
                const validColors = [
                  "default",
                  "primary",
                  "secondary",
                  "error",
                  "info",
                  "success",
                  "warning",
                ];
                const chipColor = validColors.includes(estadoObj?.color)
                  ? estadoObj?.color
                  : "default";
                const dt = new Date(
                  typeof v.arrivalTime === "string"
                    ? Number(v.arrivalTime)
                    : v.arrivalTime
                );
                const fechaStr = dt.toLocaleDateString("es-VE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                });
                const horaStr = dt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const elapsedMinutes = Math.max(0, Math.floor((now - dt.getTime()) / 60000));
                const agingColor = obtenerColorAging(elapsedMinutes);
                const fechaAbsoluta = `${fechaStr} · ${horaStr}`;
                return (
                  <Box
                    key={v.id}
                    onClick={() => handleOpen(v)}
                    sx={{
                      mb: 1.5,
                      p: 1,
                      borderRadius: 1.5,
                      boxShadow: 1,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>
                        {v.vehiculo ? String(v.vehiculo).toUpperCase() : ''}
                      </Typography>
                      <Chip
                        label={estadoObj?.label || v.status || v.estado || 'Sin estado'}
                        color={chipColor}
                        size="small"
                        sx={{ height: 22, fontSize: '0.75rem' }}
                      />
                    </Box>
                    {v.servicio && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        {v.servicio}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2, mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.customerName || ''}
                        </Typography>
                        {v.customerPhone && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {v.customerPhone}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Tooltip title={fechaAbsoluta} arrow placement="top-end">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end', cursor: 'default' }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: agingColor, flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {formatTiempoRelativo(elapsedMinutes)}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </Box>
                    </Box>
                    {v.observaciones && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                        {v.observaciones}
                      </Typography>
                    )}
                  </Box>
                );
              })
            )}
            {/* Skeleton de creación mientras se registra un nuevo servicio (al final, con fade) */}
            <Fade in={creatingSkeleton && isRegistering} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
              <Box
                    sx={{
                  mb: 1.5,
                  p: 1,
                  borderRadius: 1.5,
                  boxShadow: 1,
                      bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Skeleton variant="text" width="40%" height={24} />
                  <Skeleton variant="rounded" width={80} height={22} />
                </Box>
                <Skeleton variant="text" width="60%" sx={{ mb: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Skeleton variant="text" width={160} height={18} sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width={100} height={14} />
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Skeleton variant="text" width={70} height={14} />
                    <Skeleton variant="text" width={50} height={14} />
                  </Box>
                </Box>
                <Skeleton variant="text" width="80%" height={14} sx={{ mt: 0.5 }} />
                {/* <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Guardando servicio...
                </Typography> */}
              </Box>
            </Fade>
          </Box>
          {/* Vista cards en desktop/tablet */}
          <Box
            sx={{
              display: { xs: "none", sm: "grid" },
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 3,
              mt: 1,
            }}
          >
            {(() => {
              if (serviciosFiltrados.length === 0) {
                return (
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <EstadoVacio />
                  </Box>
                );
              }
              // Estimar el alto máximo de los VehicleCard por cantidad de líneas de texto
              const heights = serviciosFiltrados.map((v) => {
                let base = 180;
                if (v.observaciones) base += 18;
                if (v.servicio) base += 18;
                if (v.vehiculo) base += 18;
                return base;
              });
              const maxHeight = Math.max(...heights, 180);
              return serviciosFiltrados.map((v) => (
                  <Box key={v.id}>
                    <VehicleCard
                      vehiculo={v}
                      onEdit={() => handleOpen(v)}
                      onStatusChange={(newStatus) =>
                        handleStatusChange(v.id, newStatus)
                      }
                      usuarioActivo={usuarioActivo}
                      height={maxHeight}
                    />
                  </Box>
                ));
            })()}
            {/* Skeleton de creación en escritorio mientras se registra (al final, con fade) */}
            <Fade in={creatingSkeleton && isRegistering} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
              <Box>
                <Box
                  sx={{
                    width: "100%",
                    minHeight: 180,
                    display: "flex",
                    flexDirection: "column",
                    p: 0.8,
                    borderRadius: 2,
                    boxShadow: 2,
                    bgcolor: "background.paper",
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Skeleton variant="text" width={70} height={12} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width={90} height={12} />
                    </Box>
                    <Skeleton variant="rounded" width={90} height={22} />
                  </Box>
                  <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 1, opacity: 0.4 }} />
                  <Box sx={{ mb: 0.5 }}>
                    <Skeleton variant="text" width={150} height={14} sx={{ mb: 0.3 }} />
                    <Skeleton variant="text" width={110} height={14} />
                  </Box>
                  <Skeleton variant="text" width={140} height={16} sx={{ mb: 0.5 }} />
                  <Skeleton variant="rectangular" width={180} height={18} sx={{ mb: 0.5 }} />
                  <Skeleton variant="rectangular" width={160} height={18} sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width={150} height={14} />
                  {/* <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Guardando servicio...
                  </Typography> */}
                </Box>
              </Box>
            </Fade>
          </Box>
        </>
      )}
      <ServicioEditorDialog
        open={open}
        isXs={isXs}
        onDialogClose={(event, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") return;
          handleClose();
        }}
        actionLoading={actionLoading}
        editId={editId}
        onDeleteClick={handleDeleteClick}
        onClose={handleClose}
        estadoActual={(() => {
          const v = vehiculos.find((x) => x.id === editId);
          return estadosServicio.find(
            (e) => e.nombre === (v?.status || v?.estado)
          );
        })()}
        vehiculoActual={vehiculos.find((v) => v.id === editId)}
        chipColor={(() => {
          const v = vehiculos.find((x) => x.id === editId);
          const est = estadosServicio.find(
            (e) => e.nombre === (v?.status || v?.estado)
          );
          const validColors = [
            "default",
            "primary",
            "secondary",
            "error",
            "info",
            "success",
            "warning",
          ];
          return validColors.includes(est?.color) ? est?.color : "default";
        })()}
        onOpenEstadoModal={() => {
          const v = vehiculos.find((x) => x.id === editId);
          setVehiculoEstadoModal(v);
          setOpenEstadoModal(true);
        }}
        confirmDeleteOpen={confirmDeleteOpen}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleDelete}
        form={form}
        onChange={handleChange}
        editSection={editSection}
        setEditSection={setEditSection}
        isRegistering={isRegistering}
        clientes={clientes}
        onClienteInputChange={(e, newInputValue, reason) => {
          if (reason === "input") {
            setForm((prev) => ({ ...prev, customerName: newInputValue }));
            setIsEditing(true);
          }
        }}
        onClienteChange={(e, value) => {
          if (value && value.nombre) {
            setForm((prev) => ({
              ...prev,
              customerName: value.nombre,
              customerPhone: value.telefono,
            }));
            setIsEditing(true);
          }
        }}
        onCustomerPhoneChange={(e) => {
          let value = e.target.value;
          if (!value.startsWith("+58")) {
            value = "+58" + value.replace(/^0+/, "");
          }
          value = value.replace(/^\+58/, "+58");
          const soloNumeros = value.slice(3).replace(/[^\d]/g, "");
          value = "+58" + soloNumeros;
          setForm((prev) => ({ ...prev, customerPhone: value }));
          setIsEditing(true);
        }}
        isEditing={isEditing}
        onSave={handleSave}
        onCancelEditSection={() => {
          if (formOriginal) {
            setForm(formOriginal);
          }
          setEditSection(null);
          setIsEditing(false);
        }}
        onRegisterSave={() => {
          handleSave();
          setOpen(false);
          setEditSection(null);
          setIsEditing(false);
        }}
        onWhatsAppSend={() => {
          if (form.customerPhone) {
            let phone = form.customerPhone.trim();
            phone = phone.replace(/[-\s]/g, "");
            phone = phone.replace(/^\+/, "");
            if (phone.startsWith("58")) {
            } else if (phone.startsWith("0")) {
              phone = "58" + phone.slice(1);
            }
            window.open(`https://wa.me/${phone}`, "_blank");
          }
        }}
        onPorCobrar={async () => {
          const { crearCuentaPorCobrar } = await import('../lib/cuentasPorCobrarFirebase');
          // La fecha del servicio (creación original) debe preservarse tal
          // cual: no se sustituye por el momento en que se envía a cuentas
          // por cobrar, para no perder la antigüedad real de la deuda.
          const fechaServicioOriginal = editId
            ? vehiculos.find((v) => v.id === editId)?.arrivalTime || Date.now()
            : Date.now();
          await crearCuentaPorCobrar({
            vehiculoId: editId || null,
            vehiculo: form.vehiculo,
            placa: form.placa,
            servicio: form.servicio,
            precio: form.precio,
            precioBs: form.precioBs,
            observaciones: form.observaciones,
            customerName: form.customerName,
            customerPhone: form.customerPhone,
            fechaRegistro: fechaServicioOriginal,
            arrivalTime: fechaServicioOriginal,
          });
          try {
            if (editId) {
              const vehiculoActual = vehiculos.find(v => v.id === editId);
              if (vehiculoActual) {
                const data = sanitizeDeep({ ...vehiculoActual, status: 'por_cobrar' });
                await actualizarVehiculo(editId, data);
              } else {
                await actualizarVehiculo(editId, { status: 'por_cobrar' });
              }
            }
          } catch (e) {
            console.error('Error actualizando estado a por_cobrar:', e);
          }
          if (editId) {
            setVehiculos(prev => prev.filter(v => v.id !== editId));
          }
          setSnackbarMsg('Servicio enviado a cuentas por cobrar');
          setSnackbarOpen(true);
          setOpen(false);
        }}
        porCobrarDisabled={(() => {
          const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.nombre;
          const vehiculoActual = vehiculos.find(v => v.id === editId);
          const actual = vehiculoActual?.status || vehiculoActual?.estado;
          if (!actual) return false;
          return (estadoFact && actual === estadoFact) || actual === 'por_cobrar';
        })()}
        porCobrarTitle={(() => {
          const estadoFactObj = estadosServicio.find(e => e.defaultFacturar);
          const estadoFact = estadoFactObj?.nombre;
          const vehiculoActual = vehiculos.find(v => v.id === editId);
          const actual = vehiculoActual?.status || vehiculoActual?.estado;
          if (!actual) return undefined;
          if (estadoFact && actual === estadoFact) {
            return `Este servicio ya está en estado "${estadoFactObj?.label || estadoFact}" y no puede ir a Por Cobrar`;
          }
          if (actual === 'por_cobrar') {
            return 'Este servicio ya está en Por Cobrar';
          }
          return undefined;
        })()}
        onOpenFactura={() => setFacturaOpen(true)}
        facturarDisabled={(() => {
          const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.nombre;
          if (!estadoFact) return false;
          const vehiculoActual = vehiculos.find(v => v.id === editId);
          const actual = vehiculoActual?.status || vehiculoActual?.estado;
          return actual === estadoFact;
        })()}
        facturarTitle={(() => {
          const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.label || estadosServicio.find(e => e.defaultFacturar)?.nombre;
          const vehiculoActual = vehiculos.find(v => v.id === editId);
          const actual = vehiculoActual?.status || vehiculoActual?.estado;
          return actual && estadoFact && actual === (estadosServicio.find(e => e.defaultFacturar)?.nombre)
            ? 'Este servicio ya está en el estado final de facturación'
            : undefined;
        })()}
      />
      <PaymentModal
        open={facturaOpen}
        onClose={() => setFacturaOpen(false)}
        form={form}
        onRegister={async (facturaData) => {
          if (isObserver) {
            setSnackbarMsg("Rol observador: no puedes registrar pagos.");
            setSnackbarOpen(true);
            return;
          }
          // Validar que exista al menos un precio
          if (
            (form.precio === "" || form.precio === null) &&
            (form.precioBs === "" || form.precioBs === null)
          ) {
            setSnackbarMsg(
              "No se ha definido un precio para este servicio. No se puede registrar el pago."
            );
            setSnackbarOpen(true);
            return;
          }
          let nuevoIngreso = {
            descripcion: `${form.vehiculo} - ${form.servicio}`,
            factura: facturaData.numeroFactura,
            fecha: new Date().toLocaleDateString("es-VE"),
            vehiculoId: editId || null,
            customerName: form.customerName ? String(form.customerName).toUpperCase() : undefined,
            customerPhone: form.customerPhone || undefined,
            montoBs:
              form.precioBs !== undefined &&
                form.precioBs !== "" &&
                form.precioBs !== null
                ? Number(form.precioBs)
                : null,
            monto2:
              form.precio !== undefined &&
                form.precio !== "" &&
                form.precio !== null
                ? Number(form.precio)
                : null,
          };
          nuevoIngreso.monto2 =
            form.precio !== undefined &&
              form.precio !== "" &&
              form.precio !== null
              ? Number(form.precio)
              : null;
          if (
            Array.isArray(facturaData.formasPago) &&
            facturaData.formasPago.length > 0
          ) {
            nuevoIngreso.formasPago = facturaData.formasPago;
          } else {
            let monto =
              facturaData.monto !== undefined &&
                facturaData.monto !== null &&
                facturaData.monto !== ""
                ? Number(facturaData.monto)
                : facturaData.formaPago &&
                  /pago[ _-]?movil/i.test(facturaData.formaPago)
                  ? Number(form.precioBs) || 0
                  : facturaData.formaPago &&
                    (/zelle/i.test(facturaData.formaPago) || /efectivo/i.test(facturaData.formaPago) || /binance/i.test(facturaData.formaPago))
                    ? Number(form.precio) || 0
                    : Number(form.precio) || Number(form.precioBs) || 0;
            nuevoIngreso.monto = monto;
            nuevoIngreso.formaPago = facturaData.formaPago;
            nuevoIngreso.referencia = facturaData.referencia;
          }
          try {
            const { guardarIngreso } = await import("../lib/ingresosFirebase");
            await guardarIngreso(nuevoIngreso);
          } catch (e) {
            setSnackbarMsg("Error al registrar el ingreso");
            setSnackbarOpen(true);
            return;
          }
          if (editId) {
            const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar);
            const statusFacturar = estadoFacturar ? estadoFacturar.nombre : "entregado";
            const vehiculoUpdate = {
              ...form,
              status: statusFacturar,
              entregadoPor: (usuarioActivo ? String(usuarioActivo).split('@')[0] : null),
              fechaEntrega: Date.now(),
              registradoPor:
                vehiculos.find((v) => v.id === editId)?.registradoPor ||
                vehiculos.find((v) => v.id === editId)?.usuario ||
                null,
              precioBs: Number(form.precioBs) || null,
            };
            Object.keys(vehiculoUpdate).forEach((k) => {
              if (vehiculoUpdate[k] === undefined) vehiculoUpdate[k] = null;
            });
            await actualizarVehiculo(editId, vehiculoUpdate);
            const actualizados = await obtenerVehiculos();
            setVehiculos(actualizados.filter(v => (v.status || v.estado) !== 'por_cobrar'));
          }
          setSnackbarMsg("Pago registrado exitosamente");
          setSnackbarOpen(true);
          setOpen(false);
        }}
      />
        {/* Modal para cambiar estado extraído */}
        <EstadoChangeDialog
          open={openEstadoModal}
          onClose={() => setOpenEstadoModal(false)}
          estados={estadosServicio}
          vehiculo={vehiculoEstadoModal}
          onApplyEstado={async (estado, { ocultar }) => {
            if (isObserver) {
              setSnackbarMsg("Rol observador: no puedes cambiar estados.");
              setSnackbarOpen(true);
              return;
            }
            if (!vehiculoEstadoModal) return;

            const data = sanitizeDeep({
              ...vehiculoEstadoModal,
              status: estado.nombre,
              ...(ocultar
                ? {
                    fechaEntrega: Date.now(),
                    entregadoPor: usuarioActivo
                      ? String(usuarioActivo).split("@")[0]
                      : null,
                  }
                : {}),
            });
            await actualizarVehiculo(vehiculoEstadoModal.id, data);
            const actualizados = await obtenerVehiculos();
            setVehiculos(
              actualizados.filter(
                (v) => (v.status || v.estado) !== "por_cobrar"
              )
            );

            // Si se confirmó un estado que oculta el servicio, cerrar también el dialogo
            // de información/edición del servicio (ya no tiene sentido mantenerlo abierto).
            if (ocultar) {
              setOpenEstadoModal(false);
              handleClose();
            }
          }}
        />
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
    </Layout>
  );
}
