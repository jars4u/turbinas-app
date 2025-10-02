import React, { useEffect, useState } from "react";

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
        titulo: 'Registro del servicio',
        descripcion: `Servicio registrado: ${servicio.vehiculo || ''} - ${servicio.servicio || ''}`,
        usuario: servicio.registradoPor || servicio.usuario || '',
        fecha: servicio.arrivalTime,
        color: 'primary',
      });
    }
    // Entrega
    if (servicio.entregadoPor && servicio.fechaEntrega) {
      arr.push({
        titulo: 'Entrega del servicio',
        descripcion: 'El servicio fue entregado al cliente.',
        usuario: servicio.entregadoPor,
        fecha: servicio.fechaEntrega,
        color: 'success',
      });
    }
    // Pagos
    if (servicio.factura || servicio.formaPago || servicio.referencia) {
      arr.push({
        titulo: 'Pago registrado',
        descripcion: `Factura: ${servicio.factura || '-'} | Forma de pago: ${servicio.formaPago || '-'}${servicio.referencia ? ' | Ref: ' + servicio.referencia : ''}`,
        usuario: servicio.registradoPor || servicio.usuario || '',
        fecha: servicio.fechaEntrega || servicio.arrivalTime,
        color: 'info',
      });
    }
    // Eventos de historial de cambios
    if (Array.isArray(servicio.historial)) {
      servicio.historial.forEach((h) => {
        arr.push({
          titulo: `Cambio en '${h.campo}'`,
          descripcion: `De: ${h.valorAnterior ?? '-'} → A: ${h.valorNuevo ?? '-'}`,
          usuario: h.usuario || '',
          fecha: h.fecha,
          color: 'warning',
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
  // Estados principales para la tabla y el modal
  const [busqueda, setBusqueda] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [vehiculos, setVehiculos] = React.useState([]);
  const [ordenCol, setOrdenCol] = React.useState("arrivalTime");
  const [ordenAsc, setOrdenAsc] = React.useState(false);
  const [openHistorial, setOpenHistorial] = React.useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = React.useState(null);

  // Cargar datos reales de Firestore y asociar factura
  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      import('../lib/vehiculosFirebase').then(({ obtenerVehiculos }) => obtenerVehiculos()),
      obtenerIngresos()
    ]).then(([vehiculosObtenidos, ingresos]) => {
      // Relacionar factura por id de vehículo o referencia
      const vehiculosConFactura = vehiculosObtenidos.map(v => {
        // Buscar ingreso relacionado por el campo 'factura', referencia o descripción
        let ingresoRelacionado = null;
        if (v.factura) {
          ingresoRelacionado = ingresos.find(i => i.factura === v.factura);
        }
        if (!ingresoRelacionado && v.referencia) {
          ingresoRelacionado = ingresos.find(i => i.referencia === v.referencia);
        }
        if (!ingresoRelacionado && v.descripcion) {
          ingresoRelacionado = ingresos.find(i => i.descripcion === v.descripcion);
        }
        // Si no hay coincidencia, buscar si la descripción del vehículo está incluida en la descripción del ingreso
        if (!ingresoRelacionado && v.descripcion) {
          ingresoRelacionado = ingresos.find(i => i.descripcion && i.descripcion.includes(v.descripcion));
        }
        // Si no hay coincidencia, buscar si el ingreso tiene el campo factura y la descripción del vehículo está incluida en la descripción del ingreso
        if (!ingresoRelacionado && v.descripcion) {
          ingresoRelacionado = ingresos.find(i => i.factura && i.descripcion && i.descripcion.includes(v.descripcion));
        }
        let facturaValor = "-";
        if (ingresoRelacionado && ingresoRelacionado.factura) {
          facturaValor = ingresoRelacionado.factura;
        }
        return { ...v, factura: facturaValor };
      });
      setVehiculos(vehiculosConFactura);
      setLoading(false);
    });
  }, []);


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
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
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
          }}
        />
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
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', mb: 2 }}>
          <Table
            size="small"
            sx={{ minWidth: 900, whiteSpace: "nowrap" }}
          >
            <TableHead>
              <TableRow>
              <TableCell>#</TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("arrivalTime") ||
                  setOrdenAsc(ordenCol === "arrivalTime" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Fecha de registro {ordenCol === "arrivalTime" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("fechaEntrega") ||
                  setOrdenAsc(ordenCol === "fechaEntrega" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Fecha de entrega {ordenCol === "fechaEntrega" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("vehiculo") ||
                  setOrdenAsc(ordenCol === "vehiculo" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Modelo {ordenCol === "vehiculo" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("servicio") ||
                  setOrdenAsc(ordenCol === "servicio" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Servicio {ordenCol === "servicio" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("customerName") ||
                  setOrdenAsc(ordenCol === "customerName" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Cliente {ordenCol === "customerName" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("customerPhone") ||
                  setOrdenAsc(ordenCol === "customerPhone" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Teléfono {ordenCol === "customerPhone" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("precio") ||
                  setOrdenAsc(ordenCol === "precio" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Precio {ordenCol === "precio" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("factura") ||
                  setOrdenAsc(ordenCol === "factura" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Factura
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("status") ||
                  setOrdenAsc(ordenCol === "status" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Estado {ordenCol === "status" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("registradoPor") ||
                  setOrdenAsc(ordenCol === "registradoPor" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Registrado por {ordenCol === "registradoPor" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() =>
                  setOrdenCol("entregadoPor") ||
                  setOrdenAsc(ordenCol === "entregadoPor" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Entregado por {ordenCol === "entregadoPor" ? (ordenAsc ? "▲" : "▼") : ""}
              </TableCell>
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
                  return (
                    v.vehiculo?.toLowerCase().includes(q) ||
                    v.servicio?.toLowerCase().includes(q) ||
                    v.customerName?.toLowerCase().includes(q) ||
                    v.customerPhone?.toLowerCase().includes(q) ||
                    v.usuario?.toLowerCase().includes(q)
                  );
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
                      bgcolor: idx % 2 === 0 ? "background.paper" : "grey.100",
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setServicioSeleccionado(v);
                      setOpenHistorial(true);
                    }}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.arrivalTime ? (() => { const d = new Date(v.arrivalTime); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` })() : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.fechaEntrega ? (() => { const d = new Date(v.fechaEntrega); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` })() : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.vehiculo || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.servicio || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.customerName || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.customerPhone || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.precio ? `$${v.precio}` : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.factura || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.status || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {(v.registradoPor || v.usuario || "-").split('@')[0]}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {(v.entregadoPor || "-").split('@')[0]}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
      <ServicioHistorialModal
        open={openHistorial}
        onClose={() => setOpenHistorial(false)}
        servicio={servicioSeleccionado}
      />
    </>
  );
}
