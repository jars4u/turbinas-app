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
} from "@mui/material";
import { obtenerVehiculos } from "../lib/vehiculosFirebase";
import HistoryIcon from "@mui/icons-material/History";

export default function HistorialVehiculos() {
  const [ordenCol, setOrdenCol] = useState("fechaEntrega");
  const [ordenAsc, setOrdenAsc] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [vehiculos, setVehiculos] = useState([]);
  const [orderBy, setOrderBy] = useState('fechaEntrega');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obtenerVehiculos().then((data) => {
      setVehiculos(data);
      setLoading(false);
    });
  }, []);

  return (
  <Box sx={{ maxWidth: "100vw", mx: "auto", mt: 4, px: 6 }}>
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
        <Box sx={{ width: '100%', overflowX: 'auto', display: { xs: 'block', sm: 'block' } }}>
          <Table
            component={Paper}
            size="small"
            sx={{ mb: 2, minWidth: 900, whiteSpace: "nowrap" }}
          >
            <TableHead>
              <TableRow>
              <TableCell>#</TableCell>
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
                  setOrdenCol("arrivalTime") ||
                  setOrdenAsc(ordenCol === "arrivalTime" ? !ordenAsc : false)
                }
                style={{ cursor: "pointer" }}
              >
                Fecha de registro {ordenCol === "arrivalTime" ? (ordenAsc ? "▲" : "▼") : ""}
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
                    }}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.fechaEntrega ? new Date(v.fechaEntrega).toLocaleDateString("es-VE") : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.arrivalTime ? new Date(v.arrivalTime).toLocaleDateString("es-VE") : "-"}
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
                      {v.status || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.registradoPor || v.usuario || "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.entregadoPor || "-"}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
