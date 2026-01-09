import React, { useEffect } from "react";
import { useCuentasPorCobrarServicios } from "../lib/useCuentasPorCobrarServicios";
import { auth } from "../firebase";
import { guardarColumnasUsuario, obtenerColumnasUsuario } from "../lib/columnasUsuario";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";

import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  Paper,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  ToggleButton,
  ToggleButtonGroup,
  TablePagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import ServicioTimeline from "../components/ServicioTimeline";
import HistoryIcon from "@mui/icons-material/History";
import { obtenerIngresos } from "../lib/ingresosFirebase";

function ServicioHistorialModal({ open, onClose, servicio }) {
  const eventos = React.useMemo(() => {
    if (!servicio) return [];
    const arr = [];
    // Registro
    if (servicio.arrivalTime) {
      arr.push({
        titulo: "Registro del servicio",
        descripcion: `Servicio registrado: ${servicio.vehiculo || ""} - ${
          servicio.servicio || ""
        }`,
        usuario: servicio.registradoPor || servicio.usuario || "",
        fecha: servicio.arrivalTime,
        color: "primary",
      });
    }
    // Entrega
    if (servicio.entregadoPor && servicio.fechaEntrega) {
      arr.push({
        titulo: "Entrega del servicio",
        descripcion: "El servicio fue entregado al cliente.",
        usuario: servicio.entregadoPor,
        fecha: servicio.fechaEntrega,
        color: "success",
      });
    }
    // Pagos
    if (servicio.factura || servicio.formaPago || servicio.referencia) {
      arr.push({
        titulo: "Pago registrado",
        descripcion: `Factura: ${servicio.factura || "-"} | Forma de pago: ${
          servicio.formaPago || "-"
        }${servicio.referencia ? " | Ref: " + servicio.referencia : ""}`,
        usuario: servicio.registradoPor || servicio.usuario || "",
        fecha: servicio.fechaEntrega || servicio.arrivalTime,
        color: "info",
      });
    }
    // Eventos de historial de cambios
    if (Array.isArray(servicio.historial)) {
      servicio.historial.forEach((h) => {
        arr.push({
          titulo: `Cambio en '${h.campo}'`,
          descripcion: `De: ${h.valorAnterior ?? "-"} → A: ${
            h.valorNuevo ?? "-"
          }`,
          usuario: h.usuario || "",
          fecha: h.fecha,
          color: "warning",
        });
      });
    }
    // Ordenar por fecha de registro (arrivalTime) descendente por defecto
    return arr.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  }, [servicio]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Historial del servicio</DialogTitle>
      <DialogContent sx={{ px: { xs: 1, sm: 2 } }}>
        <ServicioTimeline eventos={eventos} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function HistorialVehiculos() {
  // Hook para cuentas por cobrar de servicios
  const cuentasPorCobrarServicios = useCuentasPorCobrarServicios();
  // Estados y refs al inicio
  const [loadingColumnas, setLoadingColumnas] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [vehiculos, setVehiculos] = React.useState([]);
  const [ordenCol, setOrdenCol] = React.useState("arrivalTime");
  const [ordenAsc, setOrdenAsc] = React.useState(false);
  const [openHistorial, setOpenHistorial] = React.useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = React.useState(null);
  const [openColumnModal, setOpenColumnModal] = React.useState(false);
  const [pageMobile, setPageMobile] = React.useState(0);
  const [rowsPerPageMobile, setRowsPerPageMobile] = React.useState(20);
  const [pageDesktop, setPageDesktop] = React.useState(0);
  const [rowsPerPageDesktop, setRowsPerPageDesktop] = React.useState(50);
  const defaultColumnas = React.useMemo(() => ({
    arrivalTime: true,
    fechaEntrega: true,
    vehiculo: true,
    servicio: true,
    customerName: true,
    customerPhone: true,
    precio: true,
    factura: true,
    formaPago: true,
    referencia: true,
    montoUSD: true,
    montoBs: true,
    status: true,
    registradoPor: true,
    entregadoPor: true,
  }), []);
  const [columnasVisibles, setColumnasVisibles] = React.useState(defaultColumnas);
  const columnasRef = React.useRef(columnasVisibles);
  React.useEffect(() => {
    columnasRef.current = columnasVisibles;
  }, [columnasVisibles]);

  const [estadosServicio, setEstadosServicio] = React.useState([]);

  React.useEffect(() => {
    // Cargar lista de estados para mostrar labels legibles en la tabla
    obtenerEstadosServicio()
      .then((data) => {
        if (Array.isArray(data)) setEstadosServicio(data);
      })
      .catch((err) => {
        console.warn('No se pudieron cargar los estados de servicio:', err);
      });
  }, []);

  useEffect(() => {
    // Si el usuario ya está autenticado, carga la config
    if (auth.currentUser) {
      obtenerColumnasUsuario().then((cols) => {
        console.log('Columnas recuperadas al montar:', cols);
        if (cols) setColumnasVisibles({ ...defaultColumnas, ...cols });
      });
    }
    // Además, escucha cambios de autenticación
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        obtenerColumnasUsuario().then((cols) => {
          console.log('Columnas recuperadas por cambio de auth:', cols);
          if (cols) setColumnasVisibles({ ...defaultColumnas, ...cols });
        });
      }
    });
    return () => unsubscribe();
  }, [defaultColumnas]);
  // Estados para el rango de fechas
  const [fechaInicio, setFechaInicio] = React.useState(null);
  const [fechaFin, setFechaFin] = React.useState(null);
  // Criterio de filtrado de fecha: 'registro' (arrivalTime) o 'entrega' (fechaEntrega)
  const [criterioFecha, setCriterioFecha] = React.useState('registro');
  const campoFecha = criterioFecha === 'entrega' ? 'fechaEntrega' : 'arrivalTime';
  React.useEffect(() => {
    setPageMobile(0);
    setPageDesktop(0);
  }, [busqueda, fechaInicio, fechaFin, criterioFecha, ordenCol, ordenAsc]);

  // Obtener label amigable del estado para usar también en búsqueda
  const getEstadoLabel = React.useCallback((codigo) => {
    if (!codigo) return '';
    const estadoObj = estadosServicio.find(
      (e) => e.nombre === codigo || e.id === codigo || e.value === codigo
    );
    return estadoObj ? estadoObj.label || estadoObj.nombre || codigo : codigo;
  }, [estadosServicio]);

  // Valores buscables (todas las columnas del historial)
  const getSearchableValues = React.useCallback((v) => {
    const values = [];
    // Fechas (como timestamp y formateadas)
    const fechas = ['arrivalTime', 'fechaEntrega'];
    fechas.forEach((f) => {
      const val = v[f];
      if (val) {
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            values.push(String(d.getTime()));
            values.push(
              `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            );
          }
        } catch {}
      }
    });
    // Texto
    ['vehiculo', 'servicio', 'customerName', 'customerPhone', 'factura', 'formaPago', 'referencia', 'registradoPor', 'entregadoPor', 'usuario', 'estadoFactura', 'status'].forEach((k) => {
      const val = v[k];
      if (val && typeof val === 'string') values.push(val);
    });
    // Estado legible
    const estadoLegible = getEstadoLabel(v.status || v.estado || v.estadoActual || v.currentStatus || '');
    if (estadoLegible) values.push(estadoLegible);
    // Números y montos
    ['precio', 'precioBs'].forEach((k) => {
      const val = v[k];
      if (val !== undefined && val !== null) values.push(String(val));
    });
    ['montoUSD', 'montoBs', 'monto'].forEach((k) => {
      const val = v[k];
      if (val) values.push(String(val));
    });
    return values;
  }, [getEstadoLabel]);

  // Coincidencia con búsqueda global (abarca todas las columnas)
  const matchesBusqueda = React.useCallback((v, term) => {
    const q = String(term || '').trim().toLowerCase();
    if (!q) return true;
    const vals = getSearchableValues(v);
    return vals.some((val) => String(val).toLowerCase().includes(q));
  }, [getSearchableValues]);

  // Filtro por rango de fechas (puede aplicar a registro, entrega o ambas)
  const inDateRange = React.useCallback((v) => {
    const hasRange = Boolean(fechaInicio || fechaFin);
    if (!hasRange) return true;
    const start = fechaInicio ? new Date(fechaInicio) : null;
    const end = fechaFin ? new Date(fechaFin + 'T23:59:59') : null;
    const checkDate = (val) => {
      if (!val) return false;
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      return (start ? d >= start : true) && (end ? d <= end : true);
    };
    if (criterioFecha === 'ambas') {
      return checkDate(v.arrivalTime) || checkDate(v.fechaEntrega);
    }
    const campo = campoFecha;
    return checkDate(v[campo]);
  }, [fechaInicio, fechaFin, criterioFecha, campoFecha]);

  // Utilidad: formatear fecha dd/mm/yyyy
  const formatFecha = React.useCallback((val) => {
    if (!val || val === '-') return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  // Cargar datos reales de Firestore y asociar factura
  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      import("../lib/vehiculosFirebase").then(({ obtenerVehiculos }) => obtenerVehiculos()),
      obtenerIngresos(),
    ]).then(([vehiculosObtenidos, ingresos]) => {
      // Relacionar ingresos por vehiculoId
      const vehiculosConPagos = vehiculosObtenidos.map((v) => {
        const ingresosRelacionados = ingresos.filter((i) => i.vehiculoId === v.id);
        let facturaValor = ingresosRelacionados.map((i) => i.factura).filter((f) => !!f).join(", ");
        if (!facturaValor) facturaValor = "-";
        let formasPago = [];
        let referencias = [];
        let montosUSD = [];
        let montosBs = [];
        let estadosFactura = [];
        const pagoMovilRegex = /pago[\s\u00A0_-]*m[oó]vil/i;
        const usdRegex = /zelle|efectivo|d[oó]lar(es)?|usd/i;
        ingresosRelacionados.forEach((ing) => {
          if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
            ing.formasPago.forEach((fp) => {
              formasPago.push(fp.formaPago || "-");
              referencias.push(fp.referencia || "-");
              if (fp.formaPago && pagoMovilRegex.test(fp.formaPago)) {
                if (fp.montoBs !== undefined) montosBs.push(`Bs. ${fp.montoBs}`);
                else if (fp.monto !== undefined) montosBs.push(`Bs. ${fp.monto}`);
              } else if (fp.formaPago && usdRegex.test(fp.formaPago)) {
                if (fp.monto !== undefined) montosUSD.push(`$${fp.monto}`);
              }
            });
          } else {
            formasPago.push(ing.formaPago || "-");
            referencias.push(ing.referencia || "-");
            if (ing.formaPago && pagoMovilRegex.test(ing.formaPago)) {
              if (ing.montoBs !== undefined) montosBs.push(`Bs. ${ing.montoBs}`);
              else if (ing.monto !== undefined) montosBs.push(`Bs. ${ing.monto}`);
            } else if (ing.formaPago && usdRegex.test(ing.formaPago)) {
              if (ing.monto !== undefined) montosUSD.push(`$${ing.monto}`);
            }
            if (ing.montoUSD !== undefined) montosUSD.push(`$${ing.montoUSD}`);
          }
          if (ing.estadoFactura) estadosFactura.push(ing.estadoFactura);
        });
        return {
          ...v,
          factura: facturaValor,
          formaPago: formasPago.length ? formasPago.join(", ") : "-",
          referencia: referencias.length ? referencias.join(", ") : "-",
          montoUSD: montosUSD.length ? montosUSD.join(", ") : "-",
          montoBs: montosBs.length ? montosBs.join(", ") : "-",
          estadoFactura: estadosFactura.length ? estadosFactura.join(", ") : "-",
        };
      });

      // Ingresos manuales: aquellos sin vehiculoId
      const ingresosManuales = ingresos.filter((i) => !i.vehiculoId);
      const ingresosManualesAdaptados = ingresosManuales.map((ing) => {
        let formasPago = [];
        let referencias = [];
        let montosUSD = [];
        let montosBs = [];
        const pagoMovilRegex = /pago[\s\u00A0_-]*m[oó]vil/i;
        const usdRegex = /zelle|efectivo|d[oó]lar(es)?|usd/i;
        if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
          ing.formasPago.forEach((fp) => {
            formasPago.push(fp.formaPago || "-");
            referencias.push(fp.referencia || "-");
            if (fp.formaPago && pagoMovilRegex.test(fp.formaPago)) {
              if (fp.montoBs !== undefined) montosBs.push(`Bs. ${fp.montoBs}`);
              else if (fp.monto !== undefined) montosBs.push(`Bs. ${fp.monto}`);
            } else if (fp.formaPago && usdRegex.test(fp.formaPago)) {
              if (fp.monto !== undefined) montosUSD.push(`$${fp.monto}`);
            }
          });
        } else {
          formasPago.push(ing.formaPago || "-");
          referencias.push(ing.referencia || "-");
          if (ing.formaPago && pagoMovilRegex.test(ing.formaPago)) {
            if (ing.montoBs !== undefined) montosBs.push(`Bs. ${ing.montoBs}`);
            else if (ing.monto !== undefined) montosBs.push(`Bs. ${ing.monto}`);
          } else if (ing.formaPago && usdRegex.test(ing.formaPago)) {
            if (ing.monto !== undefined) montosUSD.push(`$${ing.monto}`);
          }
          if (ing.montoUSD !== undefined) montosUSD.push(`$${ing.montoUSD}`);
        }
        return {
          id: ing.id,
          factura: ing.factura || "-",
          descripcion: ing.descripcion || "-",
          formaPago: formasPago.length ? formasPago.join(", ") : "-",
          referencia: referencias.length ? referencias.join(", ") : "-",
          montoUSD: montosUSD.length ? montosUSD.join(", ") : "-",
          montoBs: montosBs.length ? montosBs.join(", ") : "-",
          fecha: ing.fecha || "-",
        };
      });

      // Adaptar cuentas por cobrar de servicios para la tabla
      const cuentasPorCobrarAdaptadas = cuentasPorCobrarServicios.map((c) => ({
        id: c.id,
        vehiculo: c.vehiculo || '-',
        servicio: c.servicio || '-',
        customerName: c.observaciones?.split(' - ')[0] || '-',
        customerPhone: c.observaciones?.split(' - ')[1] || '-',
        precio: c.precio || '-',
        factura: '-',
        formaPago: '-',
        referencia: '-',
        montoUSD: '-',
        montoBs: c.precioBs || '-',
        fechaEntrega: '-',
        arrivalTime: c.fechaRegistro || '-',
        status: 'Por Cobrar',
        registradoPor: '-',
        entregadoPor: '-',
      }));
      // Combinar todos: vehículos, ingresos manuales y cuentas por cobrar de servicios
      setVehiculos([...vehiculosConPagos, ...ingresosManualesAdaptados, ...cuentasPorCobrarAdaptadas]);
      setLoading(false);
    });
  }, [cuentasPorCobrarServicios]);

  return (
    <>
      <Box sx={{ maxWidth: "100vw", mx: "auto", mt: 4, px: { xs: 1, md: 6 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          <Button
            variant="text"
            color="primary"
            size="small"
            onClick={() => window.history.back()}
            startIcon={
              <span style={{ fontSize: 18, marginRight: 2 }}>&larr;</span>
            }
            sx={{ textTransform: "uppercase", fontWeight: 700 }}
          >
            Atrás
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <HistoryIcon sx={{ fontSize: 28, mr: 1 }} />
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ fontFamily: "inherit", fontWeight: 900 }}
          >
            Historial de servicios
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            mb: 2,
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            gap: { xs: 1.5, md: 2 },
            flexWrap: { xs: "nowrap", md: "wrap" },
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "stretch", gap: { xs: 1, md: 1 }, width: { xs: "100%", md: "50%" }, flexDirection: { xs: 'column', md: 'row' }, overflow: { xs: 'hidden', md: 'visible' } }}>
            <input
              type="text"
              placeholder="Buscar por modelo, servicio, cliente, usuario, factura..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                padding: "8px 10px",
                fontSize: "clamp(12px, 3.5vw, 16px)",
                borderRadius: 6,
                border: "1px solid #bdbdbd",
                width: "100%",
                fontFamily: "Poppins, sans-serif",
                boxSizing: 'border-box',
              }}
            />
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={() => setOpenColumnModal(true)}
              aria-label="Seleccionar columnas"
              sx={{ width: { xs: '100%', md: 'min(100%, 320px)' }, flexShrink: 0, alignSelf: { xs: 'stretch', md: 'center' } }}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Seleccionar columnas</Box>
              <Box component="span" sx={{ display: { xs: 'inline-flex', md: 'none' }, alignItems: 'center' }}>
                <ViewColumnIcon fontSize="small" />
              </Box>
            </Button>
          </Box>
          {/* Filtros: versión móvil como Accordion */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, width: '100%' }}>
            <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="filtros-content" id="filtros-header">
                <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>Filtros</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "stretch",
                    flexDirection: "column",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'Poppins, sans-serif' }}>Desde</Typography>
                    <input
                      type="date"
                      value={fechaInicio || ""}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      aria-label="Fecha inicio"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #bdbdbd",
                        fontFamily: "Poppins, sans-serif",
                        fontSize: "clamp(12px, 3.5vw, 15px)",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    />
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'Poppins, sans-serif' }}>Hasta</Typography>
                    <input
                      type="date"
                      value={fechaFin || ""}
                      onChange={(e) => setFechaFin(e.target.value)}
                      aria-label="Fecha fin"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #bdbdbd",
                        fontFamily: "Poppins, sans-serif",
                        fontSize: "clamp(12px, 3.5vw, 15px)",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    />
                  </Box>
                  <ToggleButtonGroup
                    size="small"
                    value={criterioFecha}
                    exclusive
                    onChange={(e, val) => { if (val) setCriterioFecha(val); }}
                    sx={{
                      alignSelf: 'stretch',
                      width: '100%',
                    }}
                  >
                    <ToggleButton value="registro" sx={{ px: { xs: 0.75, md: 1.25 }, fontSize: { xs: 12, md: 'inherit' }, minWidth: { xs: 0, md: 40 }, fontFamily: 'Poppins, sans-serif' }}>Registro</ToggleButton>
                    <ToggleButton value="entrega" sx={{ px: { xs: 0.75, md: 1.25 }, fontSize: { xs: 12, md: 'inherit' }, minWidth: { xs: 0, md: 40 }, fontFamily: 'Poppins, sans-serif' }}>Entrega</ToggleButton>
                      <ToggleButton value="ambas" sx={{ px: { xs: 0.75, md: 1.25 }, fontSize: { xs: 12, md: 'inherit' }, minWidth: { xs: 0, md: 40 }, fontFamily: 'Poppins, sans-serif' }}>Ambas</ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ width: '100%' }}>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 600,
                        textTransform: "none",
                        boxShadow: "none",
                        width: '100%',
                      }}
                      onClick={() => {
                        const columnasOrden = [
                          "#",
                          "arrivalTime",
                          "fechaEntrega",
                          "vehiculo",
                          "servicio",
                          "customerName",
                          "customerPhone",
                          "precio",
                          "factura",
                          "formaPago",
                          "referencia",
                          "montoUSD",
                          "montoBs",
                          "estadoFactura",
                          "status",
                          "registradoPor",
                          "entregadoPor",
                        ];
                        const datosExportar = vehiculos
                          .filter((v) => matchesBusqueda(v, busqueda) && inDateRange(v))
                          .sort((a, b) => {
                            const fa = a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
                            const fb = b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;
                            return fa - fb;
                          })
                          .map((v, idx) => {
                            const fila = {};
                            fila["#"] = idx + 1;
                            columnasOrden.slice(1).forEach((col) => {
                              if (columnasVisibles[col]) fila[col] = v[col];
                            });
                            return fila;
                          });
                        import("../lib/exportarExcel").then(({ exportarExcel }) => {
                          exportarExcel(datosExportar, "historial-servicios.xlsx");
                        });
                      }}
                      startIcon={<FileDownloadIcon />}
                    >
                      Exportar
                    </Button>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>

          {/* Filtros: versión escritorio (sin cambios de diseño) */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              flexDirection: 'row',
              gap: 2,
              justifyContent: 'flex-end',
              flex: 1,
              width: 'auto',
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexDirection: "row",
                gap: 1,
                justifyContent: "flex-end",
                flex: 1,
                width: "100%",
                flexWrap: "nowrap",
              }}
            >
              <Typography
                variant="body2"
                sx={{ display: { xs: 'none', md: 'inline' }, mr: { xs: 0.5, md: 1 }, fontFamily: "Poppins, sans-serif" }}
              >
                Desde:
              </Typography>
              <input
                type="date"
                value={fechaInicio || ""}
                onChange={(e) => setFechaInicio(e.target.value)}
                aria-label="Fecha inicio"
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #bdbdbd",
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "1rem",
                  width: 130,
                }}
              />
              <Typography
                variant="body2"
                sx={{ display: { xs: 'inline', md: 'none' }, mx: 0.5, fontFamily: "Poppins, sans-serif" }}
              >
                -
              </Typography>
              <Typography
                variant="body2"
                sx={{ display: { xs: 'none', md: 'inline' }, mx: { xs: 0.5, md: 1 }, fontFamily: "Poppins, sans-serif" }}
              >
                a
              </Typography>
              <input
                type="date"
                value={fechaFin || ""}
                onChange={(e) => setFechaFin(e.target.value)}
                aria-label="Fecha fin"
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #bdbdbd",
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "1rem",
                  width: 130,
                }}
              />
            </Box>
            <ToggleButtonGroup
              size="small"
              value={criterioFecha}
              exclusive
              onChange={(e, val) => { if (val) setCriterioFecha(val); }}
              sx={{
                alignSelf: { xs: 'stretch', md: 'center' },
                width: { xs: '100%', md: 'auto' },
                mt: { xs: 1, md: 0 },
              }}
            >
              <ToggleButton value="registro" sx={{ px: 1.25, fontFamily: 'Poppins, sans-serif' }}>Registro</ToggleButton>
              <ToggleButton value="entrega" sx={{ px: 1.25, fontFamily: 'Poppins, sans-serif' }}>Entrega</ToggleButton>
                <ToggleButton value="ambas" sx={{ px: 1.25, fontFamily: 'Poppins, sans-serif' }}>Ambas</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ mt: { xs: 1, md: 0 }, width: { xs: '100%', md: 'auto' } }}>
              <Button
                variant="outlined"
                color="success"
                size="small"
                sx={{
                  fontFamily: "Poppins, sans-serif",
                  fontWeight: 600,
                  textTransform: "none",
                  boxShadow: "none",
                  width: { xs: '100%', md: 'auto' },
                }}
                onClick={() => {
                  const columnasOrden = [
                    "#",
                    "arrivalTime",
                    "fechaEntrega",
                    "vehiculo",
                    "servicio",
                    "customerName",
                    "customerPhone",
                    "precio",
                    "factura",
                    "formaPago",
                    "referencia",
                    "montoUSD",
                    "montoBs",
                    "estadoFactura",
                    "status",
                    "registradoPor",
                    "entregadoPor",
                  ];
                  const datosExportar = vehiculos
                    .filter((v) => matchesBusqueda(v, busqueda) && inDateRange(v))
                    .sort((a, b) => {
                      const fa = a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
                      const fb = b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;
                      return fa - fb;
                    })
                    .map((v, idx) => {
                      const fila = {};
                      fila["#"] = idx + 1;
                      columnasOrden.slice(1).forEach((col) => {
                        if (columnasVisibles[col]) fila[col] = v[col];
                      });
                      return fila;
                    });
                  import("../lib/exportarExcel").then(({ exportarExcel }) => {
                    exportarExcel(datosExportar, "historial-servicios.xlsx");
                  });
                }}
                startIcon={<FileDownloadIcon />}
              >
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Descargar Excel</Box>
                <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>Exportar</Box>
              </Button>
            </Box>
          </Box>
        </Box>
        {/* Vista móvil (cards) */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {loading ? (
            <Box>
              <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Skeleton variant="rounded" width={120} height={28} />
                <Skeleton variant="rounded" width={140} height={28} />
              </Box>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ p: 1.25, mb: 1, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, backgroundColor: '#fff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Skeleton variant="text" width={90} height={16} />
                    <Skeleton variant="rounded" width={80} height={18} />
                  </Box>
                  <Skeleton variant="text" width="70%" height={22} />
                  <Skeleton variant="text" width="50%" height={18} />
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Skeleton variant="text" width={120} height={16} />
                    <Skeleton variant="text" width={100} height={16} />
                  </Box>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Skeleton variant="rounded" width={160} height={28} />
              </Box>
            </Box>
          ) : (
            <Box>
              {(() => {
                const filteredSorted = vehiculos
                  .filter((v) => matchesBusqueda(v, busqueda) && inDateRange(v))
                  .sort((a, b) => {
                    let va = a[ordenCol] ?? '';
                    let vb = b[ordenCol] ?? '';
                    if (ordenCol === 'precio') { va = Number(va) || 0; vb = Number(vb) || 0; }
                    if (ordenCol === 'arrivalTime') { va = Number(va) || 0; vb = Number(vb) || 0; }
                    if (typeof va === 'string' && typeof vb === 'string') {
                      return ordenAsc ? va.localeCompare(vb) : vb.localeCompare(va);
                    }
                    return ordenAsc ? va - vb : vb - va;
                  });
                const totalCount = filteredSorted.length;
                const start = pageMobile * rowsPerPageMobile;
                const end = start + rowsPerPageMobile;
                const pageRows = filteredSorted.slice(start, end);
                const extractNumbers = (val) => {
                  if (val === null || val === undefined) return [];
                  const str = String(val);
                  const matches = str.match(/[-+]?[0-9]*\.?[0-9]+/g);
                  if (!matches) return [];
                  return matches.map((n) => parseFloat(n.replace(/,/g, ''))).filter((n) => !isNaN(n));
                };
                const totalUSD = pageRows.reduce((acc, v) => {
                  const source = v.monto ? v.monto : v.montoUSD;
                  const nums = extractNumbers(source);
                  const sum = nums.reduce((a, b) => a + b, 0);
                  return acc + sum;
                }, 0);
                const totalBs = pageRows.reduce((acc, v) => {
                  const nums = extractNumbers(v.montoBs);
                  const sum = nums.reduce((a, b) => a + b, 0);
                  return acc + sum;
                }, 0);
                return (
                  <>
                    <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Box sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: 'grey.100', fontWeight: 700 }}>
                        <span style={{ color: '#666', fontWeight: 500, marginRight: 6 }}>Total ($)</span>{totalUSD.toFixed(2)}
                      </Box>
                      <Box sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: 'grey.100', fontWeight: 700 }}>
                        <span style={{ color: '#666', fontWeight: 500, marginRight: 6 }}>Total (Bs)</span>{totalBs.toFixed(2)}
                      </Box>
                    </Box>
                    {pageRows.map((v, idx) => {
                      const estadoLabel = (() => {
                        const codigo = v.status || v.estado || v.estadoActual || v.currentStatus || '';
                        if (!codigo) return '-';
                        const estadoObj = estadosServicio.find((e) => e.nombre === codigo || e.id === codigo || e.value === codigo);
                        return estadoObj ? estadoObj.label || estadoObj.nombre || codigo : codigo;
                      })();
                      return (
                        <Box
                          key={v.id || start + idx}
                          onClick={() => { setServicioSeleccionado(v); setOpenHistorial(true); }}
                          sx={{ p: 1, mb: 0.75, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, backgroundColor: '#fff', cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">{formatFecha(v.arrivalTime)}</Typography>
                            <Box sx={{ px: 0.5, py: 0.2, borderRadius: 1, bgcolor: 'grey.100', color: 'text.secondary', fontSize: 11, fontWeight: 500 }}>{estadoLabel}</Box>
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.vehiculo || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.servicio || '-'}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ fontWeight: 600 }}>{v.customerName || '-'}</span>
                            {v.customerPhone ? <span style={{ color: '#757575' }}>{` · ${v.customerPhone}`}</span> : null}
                          </Typography>
                          {(v.factura && v.factura !== '-') || v.montoUSD || v.montoBs ? (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.factura && v.factura !== '-' ? `Fact: ${v.factura}` : ''}
                              {(v.factura && v.factura !== '-') && (v.montoUSD || v.montoBs) ? ' · ' : ''}
                              {(v.montoUSD || v.montoBs) ? `Monto: ${(v.montoUSD ? String(v.montoUSD) : '-') + (v.montoBs ? ' | ' + v.montoBs : '')}` : ''}
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <TablePagination
                        component="div"
                        count={totalCount}
                        page={pageMobile}
                        onPageChange={(e, newPage) => setPageMobile(newPage)}
                        rowsPerPage={rowsPerPageMobile}
                        onRowsPerPageChange={(e) => setRowsPerPageMobile(Number(e.target.value) || 20)}
                        rowsPerPageOptions={[20]}
                        labelRowsPerPage="Filas por página"
                      />
                    </Box>
                  </>
                );
              })()}
            </Box>
          )}
        </Box>

        {/* Vista escritorio (tabla original) */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {loading ? (
          <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', mb: 2 }}>
            <Table size="small" sx={{ minWidth: 900, whiteSpace: 'nowrap' }}>
              <TableHead>
                <TableRow>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <TableCell key={i}><Skeleton variant="text" width={i % 3 === 0 ? 100 : 80} /></TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 8 }).map((_, r) => (
                  <TableRow key={r}>
                    {Array.from({ length: 12 }).map((_, c) => (
                      <TableCell key={c}><Skeleton variant="text" width={c % 3 === 0 ? 120 : 80} /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          (() => {
            const filteredSorted = vehiculos
              .filter((v) => matchesBusqueda(v, busqueda) && inDateRange(v))
              .sort((a, b) => {
                let va = a[ordenCol] ?? "";
                let vb = b[ordenCol] ?? "";
                if (ordenCol === "precio") {
                  va = Number(va) || 0;
                  vb = Number(vb) || 0;
                }
                if (ordenCol === "arrivalTime") {
                  va = Number(va) || 0;
                  vb = Number(vb) || 0;
                }
                if (typeof va === "string" && typeof vb === "string") {
                  return ordenAsc ? va.localeCompare(vb) : vb.localeCompare(va);
                }
                return ordenAsc ? va - vb : vb - va;
              });
            const totalCount = filteredSorted.length;
            const start = pageDesktop * rowsPerPageDesktop;
            const end = start + rowsPerPageDesktop;
            const pageRows = filteredSorted.slice(start, end);
            const extractNumbers = (val) => {
              if (val === null || val === undefined) return [];
              const str = String(val);
              const matches = str.match(/[-+]?[0-9]*\.?[0-9]+/g);
              if (!matches) return [];
              return matches
                .map((n) => parseFloat(n.replace(/,/g, "")))
                .filter((n) => !isNaN(n));
            };
            const totalUSD = pageRows.reduce((acc, v) => {
              const source = v.monto ? v.monto : v.montoUSD;
              const nums = extractNumbers(source);
              const sum = nums.reduce((a, b) => a + b, 0);
              return acc + sum;
            }, 0);
            const totalBs = pageRows.reduce((acc, v) => {
              const nums = extractNumbers(v.montoBs);
              const sum = nums.reduce((a, b) => a + b, 0);
              return acc + sum;
            }, 0);
            const totalPrecioUSD = pageRows.reduce((acc, v) => acc + (Number(v.precio) || 0), 0);
            const totalPrecioBs = pageRows.reduce((acc, v) => acc + (Number(v.precioBs) || 0), 0);
            const precioTotalDisplay = (() => {
              const hasUSD = totalPrecioUSD > 0;
              const hasBs = totalPrecioBs > 0;
              if (hasUSD && hasBs) return "$" + totalPrecioUSD.toFixed(2) + " | Bs " + totalPrecioBs.toFixed(2);
              if (hasUSD) return "$" + totalPrecioUSD.toFixed(2);
              if (hasBs) return "Bs " + totalPrecioBs.toFixed(2);
              return "-";
            })();
            return (
              <>
                <TableContainer
                  component={Paper}
                  sx={{ width: "100%", overflowX: "auto", mb: 2, display: { xs: 'none', md: 'block' } }}
                >
                  <Table size="small" sx={{ minWidth: 900, whiteSpace: "nowrap" }}>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  {columnasVisibles.arrivalTime && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("arrivalTime") ||
                        setOrdenAsc(
                          ordenCol === "arrivalTime" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Fecha de registro{" "}
                      {ordenCol === "arrivalTime" ? (ordenAsc ? "▲" : "▼") : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.fechaEntrega && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("fechaEntrega") ||
                        setOrdenAsc(
                          ordenCol === "fechaEntrega" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Fecha de entrega{" "}
                      {ordenCol === "fechaEntrega"
                        ? ordenAsc
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.vehiculo && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("vehiculo") ||
                        setOrdenAsc(ordenCol === "vehiculo" ? !ordenAsc : false)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Modelo{" "}
                      {ordenCol === "vehiculo" ? (ordenAsc ? "▲" : "▼") : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.servicio && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("servicio") ||
                        setOrdenAsc(ordenCol === "servicio" ? !ordenAsc : false)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Servicio{" "}
                      {ordenCol === "servicio" ? (ordenAsc ? "▲" : "▼") : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.customerName && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("customerName") ||
                        setOrdenAsc(
                          ordenCol === "customerName" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Cliente{" "}
                      {ordenCol === "customerName"
                        ? ordenAsc
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.customerPhone && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("customerPhone") ||
                        setOrdenAsc(
                          ordenCol === "customerPhone" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Teléfono{" "}
                      {ordenCol === "customerPhone"
                        ? ordenAsc
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.precio && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("precio") ||
                        setOrdenAsc(ordenCol === "precio" ? !ordenAsc : false)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Precio{" "}
                      {ordenCol === "precio" ? (ordenAsc ? "▲" : "▼") : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.factura && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("factura") ||
                        setOrdenAsc(ordenCol === "factura" ? !ordenAsc : false)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Factura
                    </TableCell>
                  )}
                  {columnasVisibles.formaPago && (
                    <TableCell>Forma de pago</TableCell>
                  )}
                  {columnasVisibles.referencia && (
                    <TableCell>Referencia</TableCell>
                  )}
                  {columnasVisibles.montoUSD && (
                    <TableCell>Monto pagado ($)</TableCell>
                  )}
                  {columnasVisibles.montoBs && (
                    <TableCell>Monto pagado (Bs)</TableCell>
                  )}
                  {/* columna estadoFactura eliminada */}
                  {columnasVisibles.status && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("status") ||
                        setOrdenAsc(ordenCol === "status" ? !ordenAsc : false)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Estado{" "}
                      {ordenCol === "status" ? (ordenAsc ? "▲" : "▼") : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.registradoPor && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("registradoPor") ||
                        setOrdenAsc(
                          ordenCol === "registradoPor" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Registrado por{" "}
                      {ordenCol === "registradoPor"
                        ? ordenAsc
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableCell>
                  )}
                  {columnasVisibles.entregadoPor && (
                    <TableCell
                      onClick={() =>
                        setOrdenCol("entregadoPor") ||
                        setOrdenAsc(
                          ordenCol === "entregadoPor" ? !ordenAsc : false
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Entregado por{" "}
                      {ordenCol === "entregadoPor"
                        ? ordenAsc
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {vehiculos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{ color: "text.secondary" }}
                    >
                      Sin vehículos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows
                    .map((v, idx) => (
                      <TableRow
                        key={v.id || start + idx}
                        sx={{
                          bgcolor:
                            idx % 2 === 0 ? "background.paper" : "grey.100",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setServicioSeleccionado(v);
                          setOpenHistorial(true);
                        }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        {columnasVisibles.arrivalTime && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.arrivalTime
                              ? (() => {
                                  const d = new Date(v.arrivalTime);
                                  return `${String(d.getDate()).padStart(
                                    2,
                                    "0"
                                  )}/${String(d.getMonth() + 1).padStart(
                                    2,
                                    "0"
                                  )}/${d.getFullYear()}`;
                                })()
                              : "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.fechaEntrega && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.fechaEntrega
                              ? (() => {
                                  const d = new Date(v.fechaEntrega);
                                  return `${String(d.getDate()).padStart(
                                    2,
                                    "0"
                                  )}/${String(d.getMonth() + 1).padStart(
                                    2,
                                    "0"
                                  )}/${d.getFullYear()}`;
                                })()
                              : "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.vehiculo && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.vehiculo || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.servicio && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.servicio || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.customerName && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.customerName || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.customerPhone && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.customerPhone || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.precio && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {/* Mostrar precio y precioBs del objeto principal (vehículo) */}
                            {(() => {
                              const tienePrecio = Object.prototype.hasOwnProperty.call(v, "precio");
                              const tienePrecioBs = Object.prototype.hasOwnProperty.call(v, "precioBs");
                              if (tienePrecio && tienePrecioBs) return `$${v.precio} | Bs ${v.precioBs}`;
                              if (tienePrecio) return `$${v.precio}`;
                              if (tienePrecioBs) return `Bs ${v.precioBs}`;
                              return "-";
                            })()}
                          </TableCell>
                        )}
                        {columnasVisibles.factura && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.factura || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.formaPago && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.formaPago || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.referencia && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.referencia || "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.montoUSD && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.monto
                              ? `${v.monto}`
                              : v.montoUSD
                              ? `${v.montoUSD}`
                              : "-"}
                          </TableCell>
                        )}
                        {columnasVisibles.montoBs && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.montoBs && v.montoBs !== "-" ? v.montoBs : "-"}
                          </TableCell>
                        )}
                        {/* columna estadoFactura eliminada */}
                        {columnasVisibles.status && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {(() => {
                              const codigo = v.status || v.estado || v.estadoActual || v.currentStatus || "";
                              if (!codigo) return "-";
                              const estadoObj = estadosServicio.find((e) => e.nombre === codigo || e.id === codigo || e.value === codigo);
                              return estadoObj ? estadoObj.label || estadoObj.nombre || codigo : codigo;
                            })()}
                          </TableCell>
                        )}
                        {columnasVisibles.registradoPor && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {
                              (v.registradoPor || v.usuario || "-").split(
                                "@"
                              )[0]
                            }
                          </TableCell>
                        )}
                        {columnasVisibles.entregadoPor && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {(v.entregadoPor || "-").split("@")[0]}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell />
                  {columnasVisibles.arrivalTime && (<TableCell />)}
                  {columnasVisibles.fechaEntrega && (<TableCell />)}
                  {columnasVisibles.vehiculo && (<TableCell />)}
                  {columnasVisibles.servicio && (<TableCell />)}
                  {columnasVisibles.customerName && (<TableCell />)}
                  {columnasVisibles.customerPhone && (<TableCell />)}
                  {columnasVisibles.precio && (
                    <TableCell sx={{ fontWeight: 700 }}>{precioTotalDisplay}</TableCell>
                  )}
                  {columnasVisibles.factura && (<TableCell />)}
                  {columnasVisibles.formaPago && (<TableCell />)}
                  {columnasVisibles.referencia && (<TableCell />)}
                  {columnasVisibles.montoUSD && (
                    <TableCell sx={{ fontWeight: 700 }}>{totalUSD > 0 ? totalUSD.toFixed(2) : "-"}</TableCell>
                  )}
                  {columnasVisibles.montoBs && (
                    <TableCell sx={{ fontWeight: 700 }}>{totalBs > 0 ? totalBs.toFixed(2) : "-"}</TableCell>
                  )}
                  {columnasVisibles.status && (<TableCell />)}
                  {columnasVisibles.registradoPor && (<TableCell />)}
                  {columnasVisibles.entregadoPor && (<TableCell />)}
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end', mt: 1 }}>
            <TablePagination
              component="div"
              count={totalCount}
              page={pageDesktop}
              onPageChange={(e, newPage) => setPageDesktop(newPage)}
              rowsPerPage={rowsPerPageDesktop}
              onRowsPerPageChange={(e) => {
                const val = Number(e.target.value) || 50;
                setRowsPerPageDesktop(val);
                setPageDesktop(0);
              }}
              rowsPerPageOptions={[20, 50, 100]}
              labelRowsPerPage="Filas por página:"
            />
          </Box>
        </>
            );
          })()
        )}
        </Box>
        {/* Modal para seleccionar columnas */}
        <Dialog
          open={openColumnModal}
          onClose={() => setOpenColumnModal(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Seleccionar columnas</DialogTitle>
          <DialogContent sx={{ px: 2, maxHeight: { xs: 360, md: 'none' }, overflowY: { xs: 'auto', md: 'visible' } }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                sx={{
                  mb: 1,
                  width: "100%",
                  fontFamily: "Poppins, sans-serif",
                  textTransform: "none",
                  backgroundColor: "grey.100",
                  color: "grey.800",
                  borderColor: "grey.300",
                  "&:hover": { backgroundColor: "grey.200" },
                }}
                onClick={() => {
                  const allSelected = Object.values(columnasVisibles).every(
                    (v) => v
                  );
                  const nuevo = {};
                  Object.keys(columnasVisibles).forEach((col) => {
                    nuevo[col] = !allSelected;
                  });
                  setColumnasVisibles(nuevo);
                }}
              >
                {Object.values(columnasVisibles).every((v) => v)
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"}
              </Button>
              {Object.entries(columnasVisibles).map(([col, visible]) => (
                <Box
                  key={col}
                  sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    id={`col-check-${col}`}
                    onChange={(e) =>
                      setColumnasVisibles((prev) => ({
                        ...prev,
                        [col]: e.target.checked,
                      }))
                    }
                    style={{ width: 18, height: 18 }}
                  />
                  <label
                    htmlFor={`col-check-${col}`}
                    style={{ fontSize: 15, cursor: "pointer", flex: 1, wordBreak: 'break-word' }}
                  >
                    {(() => {
                      switch (col) {
                        case "arrivalTime":
                          return "Fecha de registro";
                        case "fechaEntrega":
                          return "Fecha de entrega";
                        case "vehiculo":
                          return "Modelo";
                        case "servicio":
                          return "Servicio";
                        case "customerName":
                          return "Cliente";
                        case "customerPhone":
                          return "Teléfono";
                        case "precio":
                          return "Precio";
                        case "factura":
                          return "Factura";
                        case "formaPago":
                          return "Forma de pago";
                        case "referencia":
                          return "Referencia";
                        case "montoUSD":
                          return "Monto pagado ($)";
                        case "montoBs":
                          return "Monto pagado (Bs)";
                        case "estadoFactura":
                          return "Estado de facturación";
                        case "status":
                          return "Estado";
                        case "registradoPor":
                          return "Registrado por";
                        case "entregadoPor":
                          return "Entregado por";
                        default:
                          return col;
                      }
                    })()}
                  </label>
                </Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={async () => {
                setLoadingColumnas(true);
                const user = auth.currentUser;
                console.log('Usuario actual:', user);
                console.log('Columnas a guardar:', columnasVisibles);
                if (user) {
                  try {
                    await guardarColumnasUsuario(columnasVisibles);
                    console.log('Guardado exitoso');
                  } catch (e) {
                    console.error('Error al guardar columnas:', e);
                  }
                } else {
                  console.warn('No hay usuario autenticado, no se guardan columnas');
                }
                setLoadingColumnas(false);
                setOpenColumnModal(false);
              }}
              variant="outlined"
              color="primary"
              size="small"
              disabled={loadingColumnas}
            >
              {loadingColumnas ? 'Guardando...' : 'Cerrar'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      <ServicioHistorialModal
        open={openHistorial}
        onClose={() => setOpenHistorial(false)}
        servicio={servicioSeleccionado}
      />
    </>
  );
}
