import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import useFactorConversion from "../hooks/useFactorConversion";
import {
  escucharVehiculos,
  actualizarVehiculo,
} from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import { formatTiempoRelativo, obtenerColorAging } from "../lib/dateUtils";
import AddIcon from "@mui/icons-material/Add";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import ReporteDia from "../components/ReporteDia";
import { obtenerInicioSnapshot, crearInicioSnapshotSiNoExiste } from "../lib/reporteDiaSnapshotFirebase";
import ServicioEditor from "../components/dashboard/ServicioEditor";
import { normalizeClientes } from "../lib/clientesFirebase";

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
  // Factor de conversión vigente (manual, BCV dólar o BCV euro según configuración)
  const { factor: factorConversion, detalle: detalleFactor } = useFactorConversion();
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
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
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
  // Mensaje en el snackbar (estable, para pasarlo al editor memoizado)
  const notificar = useCallback((msg) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  }, []);
  const handleStatusChange = async (id, newStatus) => {
    if (isObserver) {
      setSnackbarMsg("Rol observador: no puedes cambiar estados.");
      setSnackbarOpen(true);
      return false;
    }
    const vehiculo = vehiculos.find((v) => v.id === id);
    if (!vehiculo) return false;
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
    // El listener de vehículos refleja el cambio; no hace falta recargar la colección
    await actualizarVehiculo(id, payload);
    return true;
  };
  const [vehiculosRaw, setVehiculosRaw] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);
  const [loadingEstados, setLoadingEstados] = useState(true);
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

  // Clientes base para el autocompletado, derivados de los vehículos ya escuchados
  const clientes = useMemo(
    () =>
      normalizeClientes(
        vehiculosRaw.map((vehiculo) => ({
          nombre: vehiculo.customerName,
          telefono: vehiculo.customerPhone,
        }))
      ),
    [vehiculosRaw]
  );

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
  // Texto de búsqueda normalizado por vehículo: se calcula solo cuando cambian los datos,
  // no en cada render ni por cada contador de estado.
  const textoBusquedaPorId = useMemo(() => {
    const mapa = new Map();
    vehiculosRaw.forEach((v) => {
      mapa.set(
        v.id,
        [
          v.vehiculo,
          v.placa,
          v.servicio,
          v.customerName,
          v.customerPhone,
          v.observaciones,
          v.status || v.estado,
        ]
          .map(normalizarTexto)
          .join(' ')
      );
    });
    return mapa;
  }, [vehiculosRaw]);
  const busquedaNormalizada = normalizarTexto(busqueda);
  const coincideBusqueda = (v) =>
    !busquedaNormalizada || (textoBusquedaPorId.get(v.id) || '').includes(busquedaNormalizada);

  // Si el snapshot de HOY no existe al cargar los vehículos, abrir modal para fijarlo manualmente.
  // Se verifica una vez por día (al cargar y si cambia la fecha con la app abierta),
  // no con cada cambio de un vehículo.
  const vehiculosRawRef = useRef(vehiculosRaw);
  vehiculosRawRef.current = vehiculosRaw;
  const fechaHoy = (() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  useEffect(() => {
    if (loadingVehiculos) return;
    let cancelado = false;
    async function checkTodayInicio() {
      try {
        debugReporte('inicio-manual: checking snapshot', { todayStr: fechaHoy });
        const snap = await obtenerInicioSnapshot(fechaHoy);
        if (cancelado) return;
        if (!snap) {
          // Calcular un valor sugerido (no se fija automáticamente) con los datos del listener
          const valor = calcularInicioHoy(vehiculosRawRef.current);
          setInicioSugerido(valor);
          setInicioManual(String(valor));
          setOpenInicioModal(true);
          debugReporte('inicio-manual: abrir modal', { sugerido: valor, totalVehiculosLocal: vehiculosRawRef.current?.length ?? 'n/a' });
        } else {
          debugReporte('inicio-manual: snapshot ya existe', { fecha: fechaHoy, inicio: snap?.inicio });
        }
      } catch (e) {
        debugReporte('inicio-manual: error', e?.message || e);
        console.warn('No se pudo verificar snapshot de hoy', e);
      }
    }
    checkTodayInicio();
    return () => { cancelado = true; };
  }, [loadingVehiculos, calcularInicioHoy, fechaHoy]);

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

  // Vehículos visibles, derivados del listener (filtrados solo cuando ambos datos están listos).
  // Al ser derivados, cualquier guardado se refleja solo, sin recargar la colección.
  const vehiculos = useMemo(() => {
    if (loadingVehiculos || loadingEstados) return [];
    const estadoOcultar = estadosServicio.find((e) => e.dejarDeMostrar);
    const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;
    return vehiculosRaw.filter(
      (v) =>
        (v.status || v.estado) !== nombreOcultar &&
        (v.status !== 'por_cobrar') &&
        (!ordenEstado || (v.status || v.estado) === ordenEstado)
    );
  }, [vehiculosRaw, estadosServicio, ordenEstado, loadingVehiculos, loadingEstados]);
  const estadoOcultar = estadosServicio.find((e) => e.dejarDeMostrar);
  const nombreOcultar = estadoOcultar ? estadoOcultar.nombre : null;

  // Lista única de servicios filtrados (estado + búsqueda) y ordenados, reutilizada
  // por el contador del título, la vista móvil y la vista desktop.
  // Memoizada: no se recalcula al escribir en el formulario ni al abrir/cerrar modales
  const serviciosFiltrados = useMemo(() => [...vehiculos]
    .filter(
      (v) =>
        (v.status || v.estado) !== nombreOcultar &&
        (!ordenEstado || (v.status || v.estado) === ordenEstado) &&
        coincideBusqueda(v)
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehiculos, nombreOcultar, ordenEstado, ordenAsc, busquedaNormalizada, textoBusquedaPorId]
  );

  // Contadores de los chips de estado en una sola pasada sobre los vehículos
  const conteoPorEstado = useMemo(() => {
    const conteo = { todos: 0, porEstado: {} };
    vehiculosRaw.forEach((v) => {
      if (v.status === "por_cobrar" || !coincideBusqueda(v)) return;
      const est = v.status || v.estado;
      conteo.porEstado[est] = (conteo.porEstado[est] || 0) + 1;
      if (est !== nombreOcultar) conteo.todos += 1;
    });
    return conteo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculosRaw, nombreOcultar, busquedaNormalizada, textoBusquedaPorId]);

  // Callbacks estables para las tarjetas (React.memo): siempre llaman a la versión más reciente
  const editorRef = useRef(null);
  const handleStatusChangeRef = useRef(null);
  handleStatusChangeRef.current = handleStatusChange;
  const onCardEdit = useCallback((v) => editorRef.current?.abrir(v), []);
  const onCardStatusChange = useCallback(
    (id, newStatus) => handleStatusChangeRef.current(id, newStatus),
    []
  );

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
            onClick={() => editorRef.current?.abrir()}
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
          label={`Todos (${conteoPorEstado.todos})`}
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
            const count = conteoPorEstado.porEstado[estado.nombre] || 0;
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
                    onClick={() => onCardEdit(v)}
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
            <Fade in={creatingSkeleton} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
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
                      estadosServicio={estadosServicio}
                      now={now}
                      onEdit={onCardEdit}
                      onStatusChange={onCardStatusChange}
                      usuarioActivo={usuarioActivo}
                      height={maxHeight}
                    />
                  </Box>
                ));
            })()}
            {/* Skeleton de creación en escritorio mientras se registra (al final, con fade) */}
            <Fade in={creatingSkeleton} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
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
      {/* Editor (formulario + pago + cambio de estado): su estado vive aparte para
          que escribir en el modal no re-renderice la lista */}
      <ServicioEditor
        ref={editorRef}
        vehiculos={vehiculos}
        estadosServicio={estadosServicio}
        clientes={clientes}
        usuarioActivo={usuarioActivo}
        isObserver={isObserver}
        isXs={isXs}
        factorConversion={factorConversion}
        detalleFactor={detalleFactor}
        notificar={notificar}
        onCreatingChange={setCreatingSkeleton}
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
