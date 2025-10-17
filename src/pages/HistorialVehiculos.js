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
  Paper,
  CircularProgress,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

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
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <input
              type="text"
              placeholder="Buscar por modelo, servicio, cliente, usuario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: "1rem",
                borderRadius: 6,
                border: "1px solid #bdbdbd",
                width: 320,
                fontFamily: "Poppins, sans-serif",
              }}
            />
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={() => setOpenColumnModal(true)}
            >
              Seleccionar columnas
            </Button>
          </Box>
          {/* DatePicker de rango con fuente Poppins alineado a la derecha y botón de exportar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              justifyContent: "flex-end",
              flex: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{ mr: 1, fontFamily: "Poppins, sans-serif" }}
            >
              Desde:
            </Typography>
            <input
              type="date"
              value={fechaInicio || ""}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #bdbdbd",
                fontFamily: "Poppins, sans-serif",
                fontSize: "1rem",
              }}
            />
            <Typography
              variant="body2"
              sx={{ mx: 1, fontFamily: "Poppins, sans-serif" }}
            >
              a
            </Typography>
            <input
              type="date"
              value={fechaFin || ""}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #bdbdbd",
                fontFamily: "Poppins, sans-serif",
                fontSize: "1rem",
              }}
            />
            <Button
              variant="outlined"
              color="success"
              size="small"
              sx={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 600,
                textTransform: "none",
                boxShadow: "none",
              }}
              onClick={() => {
                // Filtrar los datos igual que la tabla
                // Definir el orden de columnas igual al visual de la tabla
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
                  .filter((v) => {
                    const q = busqueda.toLowerCase();
                    const match =
                      v.vehiculo?.toLowerCase().includes(q) ||
                      v.servicio?.toLowerCase().includes(q) ||
                      v.customerName?.toLowerCase().includes(q) ||
                      v.customerPhone?.toLowerCase().includes(q) ||
                      v.usuario?.toLowerCase().includes(q);
                    let matchFecha = true;
                    if (fechaInicio) {
                      const fechaReg = v.arrivalTime
                        ? new Date(v.arrivalTime)
                        : null;
                      if (fechaReg) {
                        matchFecha =
                          matchFecha && fechaReg >= new Date(fechaInicio);
                      }
                    }
                    if (fechaFin) {
                      const fechaReg = v.arrivalTime
                        ? new Date(v.arrivalTime)
                        : null;
                      if (fechaReg) {
                        matchFecha =
                          matchFecha &&
                          fechaReg <= new Date(fechaFin + "T23:59:59");
                      }
                    }
                    return match && matchFecha;
                  })
                  .sort((a, b) => {
                    // Ordenar por arrivalTime ascendente
                    const fa = a.arrivalTime
                      ? new Date(a.arrivalTime).getTime()
                      : 0;
                    const fb = b.arrivalTime
                      ? new Date(b.arrivalTime).getTime()
                      : 0;
                    return fa - fb;
                  })
                  .map((v, idx) => {
                    // Exportar columnas en el orden visual
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
              Descargar Excel
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
          <TableContainer
            component={Paper}
            sx={{ width: "100%", overflowX: "auto", mb: 2 }}
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
                  vehiculos
                    .filter((v) => {
                      const q = busqueda.toLowerCase();
                      // Filtro de texto
                      const match =
                        v.vehiculo?.toLowerCase().includes(q) ||
                        v.servicio?.toLowerCase().includes(q) ||
                        v.customerName?.toLowerCase().includes(q) ||
                        v.customerPhone?.toLowerCase().includes(q) ||
                        v.usuario?.toLowerCase().includes(q);
                      // Filtro de rango de fechas (arrivalTime)
                      let matchFecha = true;
                      if (fechaInicio) {
                        const fechaReg = v.arrivalTime
                          ? new Date(v.arrivalTime)
                          : null;
                        if (fechaReg) {
                          matchFecha =
                            matchFecha && fechaReg >= new Date(fechaInicio);
                        }
                      }
                      if (fechaFin) {
                        const fechaReg = v.arrivalTime
                          ? new Date(v.arrivalTime)
                          : null;
                        if (fechaReg) {
                          matchFecha =
                            matchFecha &&
                            fechaReg <= new Date(fechaFin + "T23:59:59");
                        }
                      }
                      return match && matchFecha;
                    })
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
                        return ordenAsc
                          ? va.localeCompare(vb)
                          : vb.localeCompare(va);
                      }
                      return ordenAsc ? va - vb : vb - va;
                    })
                    .map((v, idx) => (
                      <TableRow
                        key={v.id || idx}
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
            </Table>
          </TableContainer>
        )}
        {/* Modal para seleccionar columnas */}
        <Dialog
          open={openColumnModal}
          onClose={() => setOpenColumnModal(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Seleccionar columnas</DialogTitle>
          <DialogContent>
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
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
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
                  />
                  <label
                    htmlFor={`col-check-${col}`}
                    style={{ fontSize: 15, cursor: "pointer" }}
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
