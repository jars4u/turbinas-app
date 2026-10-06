import React from "react";
import Layout from "../components/Layout";
import { eliminarNomina } from "../lib/eliminarNominaFirebase";
import Popover from "@mui/material/Popover";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { obtenerNominas } from "../lib/obtenerNominasFirebase";
import { guardarNomina } from "../lib/nominasFirebase";
import { obtenerConfiguracionNomina } from "../lib/configuracionNominaFirebase";
import { useState, useEffect } from "react";
import {
  Button,
  Container,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  TextField,
  Divider,
} from "@mui/material";
import { FormGroup, FormControlLabel, Checkbox } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { LinearProgress } from "@mui/material";
import { obtenerCargos } from "../lib/cargosFirebase";
import { obtenerEmpleados } from "../lib/empleadosFirebase";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

// Genera y descarga un .xlsx de una hoja. xlsx se carga solo al exportar.
async function descargarExcel(data, nombreHoja, nombreArchivo) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, nombreArchivo);
}

export default function CalculoNomina() {
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState([]);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [nominaAEliminar, setNominaAEliminar] = useState(null);
  const [eliminandoNominaId, setEliminandoNominaId] = useState(null);
  const [modalDetalleNomina, setModalDetalleNomina] = useState(false);
  const [nominaDetalle, setNominaDetalle] = useState(null);
  const [highlightedNominaId, setHighlightedNominaId] = useState(null);
  const [modalSobreescribir, setModalSobreescribir] = useState(false);
  const [nominaPendiente, setNominaPendiente] = useState(null);
  const [savingNomina, setSavingNomina] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  useEffect(() => {
    import("../lib/estadosServicioFirebase").then((mod) => {
      mod.obtenerEstadosServicio().then((estados) => {
        setEstadosServicio(estados);
        if (estados.length > 0) setEstadosSeleccionados([estados[0].id]);
      });
    });
  }, []);
  // Estado para nóminas históricas
  const [nominasGuardadas, setNominasGuardadas] = useState([]);

  useEffect(() => {
    obtenerNominas().then(setNominasGuardadas);
  }, []);
  // Días de semana laboral (sincronizado con Firestore)
  const [diasSemanaLaboral, setDiasSemanaLaboral] = useState(5);
  const [loading, setLoading] = useState(false);
  const [mostrarTabla, setMostrarTabla] = useState(false);
  const navigate = useNavigate();
  const [empleados, setEmpleados] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [totalServicios, setTotalServicios] = useState(0); // total de servicios facturados en el rango
  // Estado para servicios y bono por empleado
  const [serviciosPorEmpleado, setServiciosPorEmpleado] = useState({}); // { id: cantidad }
  const [bonosPorEmpleado, setBonosPorEmpleado] = useState({}); // { id: bono }
  // Estado para observaciones por empleado
  const [observacionesPorEmpleado, setObservacionesPorEmpleado] = useState({}); // { id: texto }
  // Modalidad de cálculo de nómina
  const [modalidad, setModalidad] = useState("automatico");

  useEffect(() => {
    obtenerConfiguracionNomina().then((cfg) => {
      setDiasSemanaLaboral(cfg.diasSemanaLaboral || 5);
      localStorage.setItem("diasSemanaLaboral", cfg.diasSemanaLaboral || 5);
    });
  }, []);
  // Inicializar serviciosPorEmpleado en ceros al cambiar a modo manual
  useEffect(() => {
    if (modalidad === "manual" && empleados.length > 0) {
      const serviciosInit = {};
      empleados.forEach(e => { serviciosInit[e.id] = 0; });
      setServiciosPorEmpleado(serviciosInit);
    }
  }, [modalidad, empleados]);
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  // Formato/parsing de fechas tipo YYYY-MM-DD en hora local para evitar desfases por UTC.
  const formatLocalYMD = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    const y = String(date.getFullYear()).padStart(4, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseLocalYMDNoon = (ymd) => {
    if (!ymd || typeof ymd !== "string") return new Date();
    const [y, m, d] = ymd.split("-");
    const yy = Number(y);
    const mm = Number(m);
    const dd = Number(d);
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return new Date();
    return new Date(yy, mm - 1, dd, 12, 0, 0);
  };

  const [fechaInicio, setFechaInicio] = useState(formatLocalYMD(monday));
  const [fechaFin, setFechaFin] = useState(formatLocalYMD(friday));

  useEffect(() => {
    // Obtener cargos y empleados desde Firestore
    obtenerCargos().then(setCargos);
    obtenerEmpleados().then((emps) => {
      setEmpleados(emps);
      // Inicializar servicios, bonos y observaciones por empleado
      const bonosInit = {};
      const obsInit = {};
      emps.forEach((e) => {
        bonosInit[e.id] = 0;
        obsInit[e.id] = "";
      });
      setBonosPorEmpleado(bonosInit);
      setObservacionesPorEmpleado(obsInit);
      // Solo inicializar serviciosPorEmpleado si modalidad es automático
      if (modalidad === "automatico") {
        const serviciosInit = {};
        emps.forEach((e) => {
          serviciosInit[e.id] = totalServicios;
        });
        setServiciosPorEmpleado(serviciosInit);
      }
    });
  }, [totalServicios, modalidad]);

  useEffect(() => {
    // Consultar Firestore para obtener el total de servicios facturados en el rango y con los estados seleccionados
    const cargarServicios = async () => {
      const d1 = parseLocalYMDNoon(fechaInicio);
      const d2 = parseLocalYMDNoon(fechaFin);
      // Filtrar por rango de fechas y estados seleccionados
      const vehiculos = await import("../lib/vehiculosFirebase").then((mod) =>
        mod.obtenerVehiculos()
      );
      const serviciosEnRango = vehiculos.filter((v) => {
        if (!v.arrivalTime) return false;
        let fechaVehiculo;
        if (typeof v.arrivalTime === "number") {
          fechaVehiculo = new Date(v.arrivalTime);
        } else {
          fechaVehiculo = new Date(v.arrivalTime);
        }
        if (
          Array.isArray(estadosSeleccionados) &&
          estadosSeleccionados.length > 0 &&
          !estadosSeleccionados.includes(v.status)
        )
          return false;
        return fechaVehiculo >= d1 && fechaVehiculo <= d2;
      });
      setTotalServicios(serviciosEnRango.length);
    };
    cargarServicios();
  }, [fechaInicio, fechaFin, estadosSeleccionados, empleados]);

  // Calcula el monto total a pagar según el cargo y cantidad de servicios en el rango
  const calcularMonto = (empleado) => {
    const cargoObj = cargos.find((c) => c.id === empleado.cargo);
    const cantidad = serviciosPorEmpleado[empleado.id] ?? totalServicios;
    const bono = bonosPorEmpleado[empleado.id] ?? 0;
    if (!cargoObj) return bono;
    // Calcular días del rango
    let diasRango = 1;
    if (fechaInicio && fechaFin) {
      const d1 = parseLocalYMDNoon(fechaInicio);
      const d2 = parseLocalYMDNoon(fechaFin);
      diasRango = Math.max(
        1,
        Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
      );
    }
    let monto = 0;
    // Comisión: salario * cantidad de servicios
    if (cargoObj.tipo === "comision") {
      monto = (cargoObj.salario || 0) * cantidad;
    } else if (cargoObj.tipo === "dia") {
      monto = (cargoObj.salario || 0) * diasRango;
    } else if (cargoObj.tipo === "semana") {
      monto = (cargoObj.salario || 0) * (diasRango / diasSemanaLaboral);
    } else if (cargoObj.tipo === "mes") {
      monto = (cargoObj.salario || 0) * (diasRango / 30);
    } else {
      monto = cargoObj.salario || 0;
    }
    return monto + bono;
  };

  return (
    <Layout headerMaxWidth="lg">
      <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate("/dashboard")}
      >
        Atrás
      </Button>
      <Typography variant="h4" gutterBottom>
        <span style={{ fontWeight: 600 }}>Cálculo de nómina</span>
      </Typography>
      <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Modalidad de cálculo:</Typography>
        <FormGroup row sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <FormControlLabel
            control={<Checkbox checked={modalidad === "automatico"} onChange={() => setModalidad("automatico")} />}
            label="Automático"
          />
          <FormControlLabel
            control={<Checkbox checked={modalidad === "manual"} onChange={() => setModalidad("manual")} />}
            label="Manual"
          />
        </FormGroup>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Selecciona el rango de fechas para calcular la nómina a pagar.
      </Typography>
      <Box sx={{ display: "flex", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
        <TextField
          label="Desde"
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        />
      </Box>
      {modalidad === "automatico" && (
        <>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: 'column', sm: 'row' },
              minWidth: 220,
              justifyContent: "space-between",
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              gap: 2,
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
              <span
                style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: 2 }}
              >
                Seleccione los estados para el cálculo
              </span>
              <FormGroup row sx={{ flexWrap: "wrap", gap: 1 }}>
                {estadosServicio.map((e) => (
                  <FormControlLabel
                    key={e.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={estadosSeleccionados.includes(e.nombre)}
                        onChange={(ev) => {
                          const checked = ev.target.checked;
                          setEstadosSeleccionados((prev) => {
                            if (checked) {
                              return prev.includes(e.nombre)
                                ? prev
                                : [...prev, e.nombre];
                            } else {
                              return prev.filter((nombre) => nombre !== e.nombre);
                            }
                          });
                        }}
                        sx={{ p: 0.2 }}
                      />
                    }
                    label={
                      <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
                        {e.label || e.nombre || e.id}
                      </span>
                    }
                    sx={{ m: 0, p: 0.2 }}
                  />
                ))}
              </FormGroup>
            </Box>
            <Button
              variant="outlined"
              sx={{ ml: { xs: 0, sm: 'auto' }, minWidth: 140, width: { xs: '100%', sm: 'auto' } }}
              disabled={loading || !fechaInicio || !fechaFin}
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                  setMostrarTabla(true);
                }, 1200); // Simula cálculo de nómina
              }}
            >
              Calcular nómina
            </Button>
          </Box>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
        </>
      )}
      {(modalidad === "manual" || mostrarTabla) && (
        <>
        {/* Vista desktop/tablet: tabla completa */}
        <Paper sx={{ p: 2, minWidth: 900, overflowX: "auto", display: { xs: 'none', sm: 'block' } }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Cédula</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Servicios</TableCell>
                <TableCell>Bono ($)</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell>Monto a pagar ($)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empleados.map((empleado, idx) => {
                const cargoObj = cargos.find((c) => c.id === empleado.cargo);
                return (
                  <TableRow key={idx}>
                    <TableCell>{empleado.nombre}</TableCell>
                    <TableCell>{empleado.cedula}</TableCell>
                    <TableCell>{cargoObj ? cargoObj.nombre : ""}</TableCell>
                    <TableCell>
                      {modalidad === "manual" ? (
                        <TextField
                          value={serviciosPorEmpleado[empleado.id] ?? 0}
                          type="number"
                          size="small"
                          sx={{ width: 80 }}
                          inputProps={{ min: 0, step: 1 }}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setServiciosPorEmpleado((prev) => ({ ...prev, [empleado.id]: val }));
                          }}
                        />
                      ) : (
                        totalServicios
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={bonosPorEmpleado[empleado.id] ?? 0}
                        type="number"
                        size="small"
                        sx={{ width: 80 }}
                        inputProps={{ min: 0, step: "0.01" }}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setBonosPorEmpleado((prev) => ({ ...prev, [empleado.id]: val }));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={observacionesPorEmpleado[empleado.id] ?? ""}
                        size="small"
                        sx={{ width: 180 }}
                        onChange={(e) => {
                          setObservacionesPorEmpleado((prev) => ({ ...prev, [empleado.id]: e.target.value }));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {calcularMonto(empleado).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
              {empleados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                    No hay empleados registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
              gap: 12,
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              disabled={savingNomina}
              onClick={async (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                // Verificar si ya existe una nómina para el mismo rango
                const existe = nominasGuardadas.some(
                  (n) =>
                    n.fechaInicio === fechaInicio && n.fechaFin === fechaFin
                );
                const nomina = {
                  fechaInicio,
                  fechaFin,
                  empleados: empleados.map((empleado) => {
                    const cargoObj = cargos.find(
                      (c) => c.id === empleado.cargo
                    );
                    return {
                      id: empleado.id,
                      nombre: empleado.nombre,
                      cedula: empleado.cedula,
                      cargo: cargoObj ? cargoObj.nombre : "",
                      servicios:
                        serviciosPorEmpleado[empleado.id] ?? totalServicios,
                      bono: bonosPorEmpleado[empleado.id] ?? 0,
                      observaciones:
                        observacionesPorEmpleado[empleado.id] ?? "",
                      monto: calcularMonto(empleado),
                    };
                  }),
                };
                if (existe) {
                  setNominaPendiente(nomina);
                  setModalSobreescribir(true);
                  return;
                }
                setSavingNomina(true);
                try {
                  const docRef = await guardarNomina(nomina);
                  setSnackbar({
                    open: true,
                    message: "Nómina guardada correctamente en el histórico.",
                    severity: "success",
                  });
                  obtenerNominas().then((nominas) => {
                    setNominasGuardadas(nominas);
                    // Resaltar la nueva nómina
                    setHighlightedNominaId(docRef?.id || null);
                    setTimeout(() => setHighlightedNominaId(null), 2200);
                  });
                } catch (err) {
                  setSnackbar({
                    open: true,
                    message: "Error al guardar la nómina.",
                    severity: "error",
                  });
                }
                setSavingNomina(false);
              }}
            >
              {savingNomina ? "Guardando..." : "Guardar nómina"}
            </Button>
            {/* Modal de advertencia de sobreescritura */}
            <Dialog
              open={modalSobreescribir}
              onClose={() => setModalSobreescribir(false)}
            >
              <DialogTitle>Advertencia</DialogTitle>
              <DialogContent>
                <Typography>
                  Ya existe una nómina guardada para el rango seleccionado.
                  <br />
                  ¿Desea sobreescribirla? Se perderán los datos anteriores.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setModalSobreescribir(false)}
                  color="primary"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    setSavingNomina(true);
                    setModalSobreescribir(false);
                    try {
                      // Eliminar nómina anterior
                      const anterior = nominasGuardadas.find(
                        (n) =>
                          n.fechaInicio === fechaInicio &&
                          n.fechaFin === fechaFin
                      );
                      if (anterior && anterior.id) {
                        // Eliminar el documento anterior
                        const { getFirestore, doc, deleteDoc } = await import(
                          "firebase/firestore"
                        );
                        const db = getFirestore();
                        await deleteDoc(doc(db, "nominas", anterior.id));
                      }
                      const docRef = await guardarNomina(nominaPendiente);
                      setSnackbar({
                        open: true,
                        message: "Nómina sobreescrita correctamente.",
                        severity: "success",
                      });
                      obtenerNominas().then((nominas) => {
                        setNominasGuardadas(nominas);
                        setHighlightedNominaId(docRef?.id || null);
                        setTimeout(() => setHighlightedNominaId(null), 2200);
                      });
                    } catch (err) {
                      setSnackbar({
                        open: true,
                        message: "Error al sobreescribir la nómina.",
                        severity: "error",
                      });
                    }
                    setSavingNomina(false);
                    setNominaPendiente(null);
                  }}
                  color="error"
                  variant="contained"
                >
                  Sobreescribir
                </Button>
              </DialogActions>
            </Dialog>
            <Button
              variant="outlined"
              color="success"
              size="small"
              onClick={() => {
                // Generar datos para Excel
                const data = empleados.map((empleado) => {
                  const cargoObj = cargos.find((c) => c.id === empleado.cargo);
                  return {
                    Nombre: empleado.nombre,
                    Cedula: empleado.cedula,
                    Cargo: cargoObj ? cargoObj.nombre : "",
                    Servicios:
                      serviciosPorEmpleado[empleado.id] ?? totalServicios,
                    Bono: bonosPorEmpleado[empleado.id] ?? 0,
                    Observaciones: observacionesPorEmpleado[empleado.id] ?? "",
                    "Monto a pagar ($)": calcularMonto(empleado),
                  };
                });
                descargarExcel(data, "Nomina", `nomina_${fechaInicio}_${fechaFin}.xlsx`);
              }}
              startIcon={<DownloadIcon />}
            >
              Exportar a Excel
            </Button>
          </div>
          <Snackbar
            open={snackbar.open}
            autoHideDuration={3500}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <MuiAlert
              elevation={6}
              variant="filled"
              onClose={() => setSnackbar({ ...snackbar, open: false })}
              severity={snackbar.severity}
              sx={{ width: "100%" }}
            >
              {snackbar.message}
            </MuiAlert>
          </Snackbar>
        </Paper>
        {/* Vista móvil: tarjetas por empleado */}
        <Paper sx={{ p: 2, display: { xs: 'block', sm: 'none' } }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Empleados
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {empleados.length === 0 && (
              <Box sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No hay empleados registrados.</Box>
            )}
            {empleados.map((empleado) => {
              const cargoObj = cargos.find((c) => c.id === empleado.cargo);
              const monto = calcularMonto(empleado);
              return (
                <Box key={empleado.id} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{empleado.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">CI: {empleado.cedula} • {cargoObj ? cargoObj.nombre : ''}</Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label="Servicios"
                      value={modalidad === 'manual' ? (serviciosPorEmpleado[empleado.id] ?? 0) : totalServicios}
                      type="number"
                      size="small"
                      sx={{ width: '50%' }}
                      inputProps={{ min: 0, step: 1, readOnly: modalidad !== 'manual' }}
                      onChange={(e) => {
                        if (modalidad !== 'manual') return;
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setServiciosPorEmpleado((prev) => ({ ...prev, [empleado.id]: val }));
                      }}
                    />
                    <TextField
                      label="Bono ($)"
                      value={bonosPorEmpleado[empleado.id] ?? 0}
                      type="number"
                      size="small"
                      sx={{ width: '50%' }}
                      inputProps={{ min: 0, step: '0.01' }}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setBonosPorEmpleado((prev) => ({ ...prev, [empleado.id]: val }));
                      }}
                    />
                  </Box>
                  <TextField
                    label="Observaciones"
                    value={observacionesPorEmpleado[empleado.id] ?? ''}
                    size="small"
                    fullWidth
                    onChange={(e) => {
                      setObservacionesPorEmpleado((prev) => ({ ...prev, [empleado.id]: e.target.value }));
                    }}
                  />
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              disabled={savingNomina}
              onClick={async (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                const existe = nominasGuardadas.some(
                  (n) => n.fechaInicio === fechaInicio && n.fechaFin === fechaFin
                );
                const nomina = {
                  fechaInicio,
                  fechaFin,
                  empleados: empleados.map((empleado) => {
                    const cargoObj = cargos.find((c) => c.id === empleado.cargo);
                    return {
                      id: empleado.id,
                      nombre: empleado.nombre,
                      cedula: empleado.cedula,
                      cargo: cargoObj ? cargoObj.nombre : '',
                      servicios: serviciosPorEmpleado[empleado.id] ?? totalServicios,
                      bono: bonosPorEmpleado[empleado.id] ?? 0,
                      observaciones: observacionesPorEmpleado[empleado.id] ?? '',
                      monto: calcularMonto(empleado),
                    };
                  }),
                };
                if (existe) {
                  setNominaPendiente(nomina);
                  setModalSobreescribir(true);
                  return;
                }
                setSavingNomina(true);
                try {
                  const docRef = await guardarNomina(nomina);
                  setSnackbar({ open: true, message: 'Nómina guardada correctamente en el histórico.', severity: 'success' });
                  obtenerNominas().then((nominas) => {
                    setNominasGuardadas(nominas);
                    setHighlightedNominaId(docRef?.id || null);
                    setTimeout(() => setHighlightedNominaId(null), 2200);
                  });
                } catch (err) {
                  setSnackbar({ open: true, message: 'Error al guardar la nómina.', severity: 'error' });
                }
                setSavingNomina(false);
              }}
              fullWidth
            >
              {savingNomina ? 'Guardando...' : 'Guardar nómina'}
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => {
                const data = empleados.map((empleado) => {
                  const cargoObj = cargos.find((c) => c.id === empleado.cargo);
                  return {
                    Nombre: empleado.nombre,
                    Cedula: empleado.cedula,
                    Cargo: cargoObj ? cargoObj.nombre : '',
                    Servicios: serviciosPorEmpleado[empleado.id] ?? totalServicios,
                    Bono: bonosPorEmpleado[empleado.id] ?? 0,
                    Observaciones: observacionesPorEmpleado[empleado.id] ?? '',
                    'Monto a pagar ($)': calcularMonto(empleado),
                  };
                });
                descargarExcel(data, "Nomina", `nomina_${fechaInicio}_${fechaFin}.xlsx`);
              }}
              startIcon={<DownloadIcon />}
              fullWidth
            >
              Exportar a Excel
            </Button>
          </Box>
          <Snackbar
            open={snackbar.open}
            autoHideDuration={3500}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <MuiAlert elevation={6} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </MuiAlert>
          </Snackbar>
        </Paper>
        </>
      )}
      {/* Lista de nóminas guardadas */}
      <Divider />
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Historial de nóminas guardadas
        </Typography>
        {/* Desktop/tablet */}
        {nominasGuardadas.length > 0 ? (
          <>
          <Table size="small" sx={{ minWidth: 700, display: { xs: 'none', sm: 'table' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Fecha guardado</TableCell>
                <TableCell>Rango</TableCell>
                <TableCell>Empleados</TableCell>
                <TableCell>Monto total ($)</TableCell>
                <TableCell align="center">Eliminar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nominasGuardadas.map((nomina) => (
                <TableRow
                  key={nomina.id}
                  sx={
                    highlightedNominaId === nomina.id
                      ? {
                          backgroundColor: "rgba(76, 175, 80, 0.18)",
                          transition: "background-color 1.2s",
                        }
                      : { transition: "background-color 1.2s" }
                  }
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    // Evitar abrir modal si se hace click en el icono de eliminar
                    if (e.target.closest(".delete-nomina-icon")) return;
                    setNominaDetalle(nomina);
                    setModalDetalleNomina(true);
                  }}
                >
                  <TableCell>
                    {nomina.fechaGuardado?.toDate
                      ? nomina.fechaGuardado.toDate().toLocaleString()
                      : ""}
                  </TableCell>
                  <TableCell>
                    {nomina.fechaInicio} a {nomina.fechaFin}
                  </TableCell>
                  <TableCell>{nomina.empleados?.length ?? 0}</TableCell>
                  <TableCell>
                    {(
                      nomina.empleados?.reduce(
                        (acc, e) => acc + (e.monto || 0),
                        0
                      ) ?? 0
                    ).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      color="error"
                      className="delete-nomina-icon"
                      disabled={eliminandoNominaId === nomina.id}
                      onClick={(ev) => {
                        if (ev) ev.stopPropagation();
                        setPopoverAnchor(ev.currentTarget);
                        setNominaAEliminar(nomina);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </Button>
                  </TableCell>
                  {/* Popover de confirmación de eliminación */}
                  <Popover
                    open={Boolean(popoverAnchor)}
                    anchorEl={popoverAnchor}
                    onClose={() => {
                      setPopoverAnchor(null);
                      setNominaAEliminar(null);
                    }}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                    transformOrigin={{ vertical: "top", horizontal: "center" }}
                  >
                    <Box sx={{ p: 2, maxWidth: 260 }}>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        ¿Seguro que deseas eliminar esta nómina?
                        <br />
                        Esta acción no se puede deshacer.
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 1,
                        }}
                      >
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverAnchor(null);
                            setNominaAEliminar(null);
                          }}
                          color="primary"
                          variant="outlined"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="contained"
                          disabled={eliminandoNominaId === nominaAEliminar?.id}
                          onClick={async () => {
                            setEliminandoNominaId(nominaAEliminar.id);
                            setPopoverAnchor(null);
                            try {
                              await eliminarNomina(nominaAEliminar.id);
                              setSnackbar({
                                open: true,
                                message: "Nómina eliminada correctamente.",
                                severity: "success",
                              });
                              obtenerNominas().then(setNominasGuardadas);
                              // Si la nómina eliminada está abierta en el modal, ciérralo
                              if (nominaDetalle?.id === nominaAEliminar.id) {
                                setModalDetalleNomina(false);
                                setNominaDetalle(null);
                              }
                            } catch (err) {
                              setSnackbar({
                                open: true,
                                message: "Error al eliminar la nómina.",
                                severity: "error",
                              });
                            }
                            setEliminandoNominaId(null);
                            setNominaAEliminar(null);
                          }}
                        >
                          Eliminar
                        </Button>
                      </Box>
                    </Box>
                  </Popover>
                </TableRow>
              ))}
              {/* Modal detalle nómina guardada */}
              <Dialog
                open={modalDetalleNomina}
                onClose={() => setModalDetalleNomina(false)}
                maxWidth="md"
                fullWidth
              >
                <DialogTitle>Detalle de nómina</DialogTitle>
                <DialogContent>
                  {nominaDetalle && (
                    <>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        Rango: {nominaDetalle.fechaInicio} a{" "}
                        {nominaDetalle.fechaFin}
                      </Typography>
                      <Table size="small" sx={{ minWidth: 700, mb: 2 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Nombre</TableCell>
                            <TableCell>Cédula</TableCell>
                            <TableCell>Cargo</TableCell>
                            <TableCell>Servicios</TableCell>
                            <TableCell>Bono</TableCell>
                            <TableCell>Observaciones</TableCell>
                            <TableCell>Monto a pagar ($)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {nominaDetalle.empleados?.map((e, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{e.nombre}</TableCell>
                              <TableCell>{e.cedula}</TableCell>
                              <TableCell>{e.cargo}</TableCell>
                              <TableCell>{e.servicios}</TableCell>
                              <TableCell>{e.bono}</TableCell>
                              <TableCell>{e.observaciones}</TableCell>
                              <TableCell>
                                {e.monto?.toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setModalDetalleNomina(false)}
                    color="primary"
                  >
                    Cerrar
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    onClick={() => {
                      if (!nominaDetalle) return;
                      const data =
                        nominaDetalle.empleados?.map((e) => ({
                          Nombre: e.nombre,
                          Cedula: e.cedula,
                          Cargo: e.cargo,
                          Servicios: e.servicios,
                          Bono: e.bono,
                          Observaciones: e.observaciones,
                          "Monto a pagar ($)": e.monto,
                        })) || [];
                      descargarExcel(data, "Nomina", `nomina_${nominaDetalle.fechaInicio}_${nominaDetalle.fechaFin}.xlsx`);
                    }}
                    startIcon={<DownloadIcon />}
                  >
                    Exportar a Excel
                  </Button>
                </DialogActions>
              </Dialog>
            </TableBody>
          </Table>
          {/* Móvil */}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            {nominasGuardadas.map((nomina) => (
              <Box
                key={nomina.id}
                sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5, mb: 1 }}
                onClick={(e) => {
                  if (e.target.closest('.delete-nomina-icon')) return;
                  setNominaDetalle(nomina);
                  setModalDetalleNomina(true);
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{nomina.fechaInicio} a {nomina.fechaFin}</Typography>
                  <Button
                    size="small"
                    color="error"
                    className="delete-nomina-icon"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setPopoverAnchor(ev.currentTarget);
                      setNominaAEliminar(nomina);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Guardado: {nomina.fechaGuardado?.toDate ? nomina.fechaGuardado.toDate().toLocaleString() : ''}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2">Empleados: {nomina.empleados?.length ?? 0}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {(
                      nomina.empleados?.reduce((acc, e) => acc + (e.monto || 0), 0) ?? 0
                    ).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </Typography>
                </Box>
              </Box>
            ))}
            {/* Popover reutilizado para confirmar eliminación */}
            <Popover
              open={Boolean(popoverAnchor)}
              anchorEl={popoverAnchor}
              onClose={() => {
                setPopoverAnchor(null);
                setNominaAEliminar(null);
              }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <Box sx={{ p: 2, maxWidth: 260 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  ¿Seguro que deseas eliminar esta nómina?
                  <br />
                  Esta acción no se puede deshacer.
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); setPopoverAnchor(null); setNominaAEliminar(null); }} color="primary" variant="outlined">
                    Cancelar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    disabled={eliminandoNominaId === nominaAEliminar?.id}
                    onClick={async () => {
                      setEliminandoNominaId(nominaAEliminar.id);
                      setPopoverAnchor(null);
                      try {
                        await eliminarNomina(nominaAEliminar.id);
                        setSnackbar({ open: true, message: 'Nómina eliminada correctamente.', severity: 'success' });
                        obtenerNominas().then(setNominasGuardadas);
                        if (nominaDetalle?.id === nominaAEliminar.id) {
                          setModalDetalleNomina(false);
                          setNominaDetalle(null);
                        }
                      } catch (err) {
                        setSnackbar({ open: true, message: 'Error al eliminar la nómina.', severity: 'error' });
                      }
                      setEliminandoNominaId(null);
                      setNominaAEliminar(null);
                    }}
                  >
                    Eliminar
                  </Button>
                </Box>
              </Box>
            </Popover>
          </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No hay nóminas guardadas en el histórico.
          </Typography>
        )}
      </Box>
      </Container>
    </Layout>
  );
}
