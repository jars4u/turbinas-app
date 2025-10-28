import React, { useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Grid,
  Paper,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AddTaskIcon from "@mui/icons-material/AddTask";
import DoneAllIcon from "@mui/icons-material/DoneAll";
// PendingActionsIcon eliminado: no se usa actualmente
import { obtenerConfiguracionReporte } from "../lib/configuracionReporteFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import { obtenerInicioSnapshot } from "../lib/reporteDiaSnapshotFirebase";

// props: servicios (array de servicios), fecha (string 'YYYY-MM-DD' o Date)
export default function ReporteDia({ open, onClose, servicios = [], fecha }) {
  // Log condicional opcional controlado con localStorage.debugReporteDia === '1'
  const debugReporte = React.useCallback((...args) => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('debugReporteDia') === '1') {
        console.debug('[ReporteDia][DBG]', ...args);
      }
    } catch (_) { /* noop */ }
  }, []);
  // Configuración del reporte en state (se cargará desde Firestore)
  const [configReporte, setConfigReporte] = React.useState(null);
  React.useEffect(() => {
    let mounted = true;
    obtenerConfiguracionReporte()
      .then(cfg => {
        if (!mounted) return;
        setConfigReporte(cfg || {});
      })
      .catch(e => console.warn('No se pudo cargar configReporte desde Firestore', e));
    return () => { mounted = false; };
  }, []);
  // Lista de estados cargada desde Firestore para resolver labels
  const [estadosServicio, setEstadosServicio] = React.useState([]);
  React.useEffect(() => {
    let mounted = true;
    obtenerEstadosServicio()
      .then(list => {
        if (!mounted) return;
        if (Array.isArray(list)) setEstadosServicio(list);
      })
      .catch(e => console.warn('No se pudieron cargar estados de servicio:', e));
    return () => { mounted = false; };
  }, []);

  // Función para resolver un código/nombre de estado a su label (si existe)
  const resolveStateLabel = React.useCallback((codeOrName) => {
    if (!codeOrName) return null;
    const found = estadosServicio.find(e => e.nombre === codeOrName || e.id === codeOrName || e.value === codeOrName || e.label === codeOrName);
    if (found) return found.label || found.nombre || codeOrName;
    return codeOrName;
  }, [estadosServicio]);
  // Normalizar fecha a string 'YYYY-MM-DD'
  const fechaStr = useMemo(() => {
    if (!fecha) return "";
    if (typeof fecha === "string" && fecha.includes("-")) return fecha;
    if (typeof fecha === "string" && fecha.includes("/")) {
      // dd/mm/yyyy
      const [d, m, y] = fecha.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (fecha instanceof Date) {
      return fecha.toISOString().slice(0, 10);
    }
    return fecha;
  }, [fecha]);

  // Calcular resumen del día
  const resumen = useMemo(() => {
    if (!Array.isArray(servicios) || !fechaStr) return { inicio: 0, registrados: 0, entregados: 0, pendientes: 0 };
    // Cargar configuración de estados: prioridad a configReporte (Firestore), luego localStorage como fallback
    let config = {};
    if (configReporte && Object.keys(configReporte).length > 0) {
      config = configReporte;
    } else {
      try {
        const raw = localStorage.getItem("configReporteStates");
        if (raw) config = JSON.parse(raw);
      } catch (e) {
        console.warn("No se pudo leer configReporteStates:", e);
      }
    }

    const estadosRegistrados = Array.isArray(config.registrados) ? config.registrados : [];
    const estadosEntregados = Array.isArray(config.entregados) ? config.entregados : [];
    const estadosPendientes = Array.isArray(config.pendientes) ? config.pendientes : [];

    // Helpers
  // Convierte distintos formatos a milisegundos epoch (Number) o null
    const toMillis = (v) => {
      if (!v) return null;
      // Firestore timestamp
      if (v && typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        // ISO
        if (v.includes('T')) {
          const t = Date.parse(v);
          return Number.isNaN(t) ? null : t;
        }
        // dd/mm/yyyy or dd/mm/yyyy hh:mm
        if (v.includes('/')) {
          const [datePart, timePart] = v.split(' ');
          const [d, m, y] = datePart.split('/');
          const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${timePart ? 'T' + timePart : 'T00:00:00'}`;
          const t = Date.parse(iso);
          return Number.isNaN(t) ? null : t;
        }
        // plain date 'YYYY-MM-DD' or datetime without T
        if (v.length >= 10) {
          const iso = v.includes('-') ? (v.includes(' ') ? v.replace(' ', 'T') : (v.length === 10 ? v + 'T00:00:00' : v)) : v;
          const t = Date.parse(iso);
          return Number.isNaN(t) ? null : t;
        }
      }
      return null;
    };

    const millisToDateOnly = (ms) => {
      if (!ms && ms !== 0) return null;
      const d = new Date(ms);
      return `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const extractHistorialTransitions = (s) => {
      const arr = [];
      // arrivalTime as initial presence marker (useful if no historial)
      const regMillis = toMillis(s.arrivalTime);
      const currentState = s.status || s.estado || null;
      if (regMillis && currentState) arr.push({ ts: regMillis, state: currentState, type: 'registro' });
      // historial entries: try to support common shapes
      if (Array.isArray(s.historial)) {
        s.historial.forEach(h => {
          let hMillis = null;
          if (h.fecha) hMillis = toMillis(h.fecha);
          if (!hMillis && h._fechaDate) hMillis = toMillis(h._fechaDate);
          if (!hMillis && h.createdAt) hMillis = toMillis(h.createdAt);
          const state = h.nuevoEstado || h.estado || h.to || h.newState || h.estadoNuevo || null;
          if (hMillis && state) arr.push({ ts: hMillis, state, type: 'historial' });
        });
      }
      // fechaEntrega as 'entregado' marker
      if (s.fechaEntrega) {
        const fEnt = toMillis(s.fechaEntrega);
        if (fEnt) arr.push({ ts: fEnt, state: 'entregado', type: 'entrega' });
      }
      // If no transitions but we have currentState and arrival, infer
      if (!arr.length && currentState && regMillis) arr.push({ ts: regMillis, state: currentState, type: 'inferred' });
      // sort by timestamp asc
      return arr.sort((a,b) => (a.ts || 0) - (b.ts || 0));
    };

    const stateAt = (s, target, preferTransitions = true) => {
      // target can be Date or string 'YYYY-MM-DD' or ISO
      let targetMillis = null;
      if (target instanceof Date) targetMillis = target.getTime();
      else if (typeof target === 'string') {
        // If only date 'YYYY-MM-DD', interpret as end of that day
        if (/^\d{4}-\d{2}-\d{2}$/.test(target)) {
          targetMillis = Date.parse(target + 'T23:59:59');
        } else {
          targetMillis = toMillis(target);
        }
      }
      const transitions = extractHistorialTransitions(s);
      let last = null;
      transitions.forEach(t => {
        if (!t.ts) return;
        if (targetMillis === null || t.ts <= targetMillis) last = t.state;
      });
      // If no transition before targetMillis, consider fechaEntrega or fallback to status
      if (!last) {
        // if delivered before target, it was 'entregado'
        if (s.fechaEntrega) {
          const entMillis = toMillis(s.fechaEntrega);
          if (entMillis && targetMillis !== null && entMillis <= targetMillis) return 'entregado';
        }
        return s.status || s.estado || null;
      }
      return last;
    };

    // registrados: arrivalTime == fechaStr OR state transition into any estadosRegistrados on fechaStr
  let registradosCount = 0;
  let entregadosCount = 0;
  let inicioCount = 0;
  let pendientesCount = 0;

  const inicioServices = [];
  servicios.forEach(s => {
      const regDate = millisToDateOnly(toMillis(s.arrivalTime));
      let countedAsRegistrado = false;
      if (regDate === fechaStr) {
        registradosCount++;
        countedAsRegistrado = true;
      }

      // Si la configuración define estadosRegistrados, considera transiciones en historial
      if (!countedAsRegistrado && estadosRegistrados.length > 0 && Array.isArray(s.historial)) {
        const becameRegistered = s.historial.some(h => {
          const hDate = millisToDateOnly(toMillis(h.fecha || h._fechaDate || h.createdAt));
          const newState = h.nuevoEstado || h.estado || h.to || h.newState || h.estadoNuevo || null;
          const newStateLabel = resolveStateLabel(newState);
          return hDate === fechaStr && estadosRegistrados.includes(newStateLabel);
        });
        if (becameRegistered) {
          registradosCount++;
          countedAsRegistrado = true;
        }
      }

      // entregados: if fechaEntrega == fechaStr OR historial transition to entregado or any configured entregado state on fechaStr
      const entDate = millisToDateOnly(toMillis(s.fechaEntrega));
      if (entDate === fechaStr) {
        entregadosCount++;
      } else if (Array.isArray(s.historial) && s.historial.some(h => {
        const hDate = millisToDateOnly(toMillis(h.fecha || h._fechaDate || h.createdAt));
        const newState = h.nuevoEstado || h.estado || h.to || h.newState || h.estadoNuevo || null;
        const newStateLabel = resolveStateLabel(newState);
        return hDate === fechaStr && (estadosEntregados.length === 0 ? (newStateLabel === 'entregado') : estadosEntregados.includes(newStateLabel));
      })) {
        entregadosCount++;
      }

      // inicio (criterio requerido): contar servicios cuyo status (código) NO sea 'entregado' NI 'por_cobrar'.
      // Ignora timestamps; se basa únicamente en el atributo status/estado almacenado en el documento.
      const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase().replace(/\s+/g, '_');
      const currentStatusCode = normalize(s.status || s.estado);
      if (currentStatusCode !== 'entregado' && currentStatusCode !== 'por_cobrar') {
        inicioCount++;
        inicioServices.push({ id: s.id || s._id || s.vehiculo || '(no-id)', status: currentStatusCode, criterio: 'status!=entregado|por_cobrar' });
      }


    // Log opcional de depuración
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('debugReporteDia') === '1') {
        console.debug('[ReporteDia][DBG] fecha:', fechaStr, 'inicioServicesCount:', inicioServices.length);
        if (console.table) console.table(inicioServices.slice(0, 200));
      }
    } catch (e) {
      // silencio
    }
      // pendientes: state at end of fechaStr (i.e., stateAt with fechaStr) in estadosPendientes or no entrega yet
      const stateEnd = stateAt(s, fechaStr);
      if (estadosPendientes.length > 0) {
        const stateEndLabel = resolveStateLabel(stateEnd);
        if (stateEndLabel && estadosPendientes.includes(stateEndLabel)) pendientesCount++;
      } else {
        const ent = millisToDateOnly(toMillis(s.fechaEntrega));
        if (regDate && regDate <= fechaStr && (!ent || ent > fechaStr)) pendientesCount++;
      }
    });

    return {
      inicioCalculado: inicioCount,
      registrados: registradosCount,
      entregados: entregadosCount,
      pendientes: pendientesCount,
    };
  }, [servicios, fechaStr, configReporte, resolveStateLabel]);

  // Estado para fijar el valor de "inicio" desde Firestore (snapshot diario)
  const [inicioFijo, setInicioFijo] = React.useState(null);

  // Cargar snapshot al cambiar la fecha
  React.useEffect(() => {
    let mounted = true;
    async function cargarSnapshot() {
      if (!fechaStr) return;
      try {
        const snap = await obtenerInicioSnapshot(fechaStr);
        if (!mounted) return;
        if (snap && typeof snap.inicio === 'number') {
          setInicioFijo(snap.inicio);
          debugReporte('snapshot cargado', { fecha: fechaStr, inicio: snap.inicio });
        } else {
          setInicioFijo(null);
          debugReporte('snapshot no encontrado', { fecha: fechaStr });
        }
      } catch (e) {
        console.warn('No se pudo cargar snapshot de inicio para', fechaStr, e);
        setInicioFijo(null);
        debugReporte('error al cargar snapshot', { fecha: fechaStr, error: e?.message || e });
      }
    }
    setInicioFijo(null);
    cargarSnapshot();
    return () => { mounted = false; };
  }, [fechaStr, debugReporte, open]);

  // Ya no se crea snapshot automáticamente desde el reporte; sólo se lee el valor fijado
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 0.2 }}>
            Resumen de servicios
          </Typography>
          <Box sx={{ my: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {fechaStr || fecha}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Cerrar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 3, pb: 3 }}>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} sm={4}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 1, display: "flex", flexDirection: 'column', alignItems: "center", gap: 1.5, minHeight: 140, justifyContent: 'center', bgcolor: 'background.paper' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main', color: 'common.white', mb: 0.5 }}>
                <AssignmentIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} color="text.primary">
                  {inicioFijo !== null ? inicioFijo : (resumen?.inicioCalculado ?? 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Al inicio del día
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 1, display: "flex", flexDirection: 'column', alignItems: "center", gap: 1.5, minHeight: 140, justifyContent: 'center', bgcolor: 'background.paper' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'warning.main', color: 'common.white', mb: 0.5 }}>
                <AddTaskIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} color="text.primary">
                  {resumen.registrados}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Registrados hoy
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 1, display: "flex", flexDirection: 'column', alignItems: "center", gap: 1.5, minHeight: 140, justifyContent: 'center', bgcolor: 'background.paper' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'success.main', color: 'common.white', mb: 0.5 }}>
                <DoneAllIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} color="text.primary">
                  {resumen.entregados}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Entregados hoy
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
