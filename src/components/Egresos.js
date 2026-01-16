import React, { useEffect, useMemo, useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import {
  actualizarEgreso,
  eliminarEgreso,
  guardarEgreso,
  obtenerEgresos,
} from "../lib/egresosFirebase";
import EgresoFacturaDialog from "./EgresoFacturaDialog";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Divider,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
} from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function ddmmyyyyFromDate(dateObj) {
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = String(dateObj.getFullYear());
  return `${d}/${m}/${y}`;
}

function normalizarEgresoConFecha(e) {
  let fechaDate = null;
  let fechaStr = "";

  if (e?.fecha && e.fecha.seconds) {
    fechaDate = new Date(e.fecha.seconds * 1000);
    fechaStr = ddmmyyyyFromDate(fechaDate);
  } else if (e?.fecha && typeof e.fecha.toDate === "function") {
    fechaDate = e.fecha.toDate();
    fechaStr = ddmmyyyyFromDate(fechaDate);
  } else if (e?.fecha && typeof e.fecha === "string") {
    const parts = e.fecha.split(/[/-]/);
    if (parts.length === 3) {
      const d = String(parts[0]).padStart(2, "0");
      const m = String(parts[1]).padStart(2, "0");
      const y = String(parts[2]);
      fechaStr = `${d}/${m}/${y}`;
      // Evitar parseo ISO (UTC) que puede desplazar al día anterior en GMT-4
      fechaDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
    } else {
      fechaStr = e.fecha;
      fechaDate = Date.parse(e.fecha) ? new Date(e.fecha) : null;
    }
  }

  return { ...e, _fechaDate: fechaDate, _fechaStr: fechaStr };
}

function calcularTotalesEgreso(e) {
  const montoUSD = typeof e?.montoUSD === "number" && !isNaN(e.montoUSD) ? e.montoUSD : 0;
  const montoBs = typeof e?.montoBs === "number" && !isNaN(e.montoBs) ? e.montoBs : 0;

  if (montoUSD > 0 || montoBs > 0) {
    return { totalUSD: montoUSD, totalBs: montoBs };
  }

  // Fallback: si por alguna razón hay factura con items pero sin totales
  const moneda = e?.monedaFactura;
  const items = Array.isArray(e?.items) ? e.items : [];
  const total = items.reduce((acc, it) => {
    const totalItem = typeof it?.totalItem === "number" && !isNaN(it.totalItem)
      ? it.totalItem
      : (typeof it?.cantidad === "number" && typeof it?.precioUnitario === "number")
        ? it.cantidad * it.precioUnitario
        : 0;
    return acc + (isFinite(totalItem) ? totalItem : 0);
  }, 0);

  if (moneda === "Bs") return { totalUSD: 0, totalBs: total };
  return { totalUSD: total, totalBs: 0 };
}

export default function Egresos({ tasaBCV, isOwner }) {
  const isMobile = useMediaQuery("(max-width:600px)");

  const hoyStr = useMemo(() => ddmmyyyyFromDate(new Date()), []);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyStr);

  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogInitial, setDialogInitial] = useState(null);
  const [editId, setEditId] = useState(null);

  const refreshEgresos = async () => {
    setLoading(true);
    try {
      const data = await obtenerEgresos();
      const egresosConFecha = data
        .map(normalizarEgresoConFecha)
        .sort((a, b) => {
          const fechaA = a._fechaDate ? a._fechaDate.getTime() : 0;
          const fechaB = b._fechaDate ? b._fechaDate.getTime() : 0;
          return fechaB - fechaA;
        });
      setEgresos(egresosConFecha);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEgresos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditId(null);
    setDialogInitial({
      fechaStr: fechaSeleccionada || hoyStr,
      proveedor: "",
      rifCi: "",
      numeroDocumento: "",
      monedaFactura: "USD",
      tasaFactura: tasaBCV || "",
      items: [{ descripcion: "", cantidad: 1, precioUnitario: "" }],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (egreso) => {
    setDialogMode("edit");
    setEditId(egreso?.id || null);

    if (egreso?.tipo === "factura") {
      setDialogInitial({
        fechaStr: egreso?._fechaStr || egreso?.fechaStr || hoyStr,
        proveedor: egreso?.proveedor || "",
        rifCi: egreso?.rifCi || "",
        numeroDocumento: egreso?.numeroDocumento || "",
        monedaFactura: egreso?.monedaFactura || "USD",
        tasaFactura: egreso?.tasaFactura ?? tasaBCV ?? "",
        items: Array.isArray(egreso?.items) ? egreso.items : [],
      });
      setDialogOpen(true);
      return;
    }

    const { totalUSD, totalBs } = calcularTotalesEgreso(egreso);
    const monedaFactura = totalBs > 0 ? "Bs" : "USD";
    const total = monedaFactura === "Bs" ? totalBs : totalUSD;

    setDialogInitial({
      fechaStr: egreso?._fechaStr || hoyStr,
      proveedor: "",
      rifCi: "",
      numeroDocumento: "",
      monedaFactura,
      tasaFactura: egreso?.tasa ?? tasaBCV ?? "",
      items: [
        {
          descripcion: egreso?.descripcion || "",
          cantidad: 1,
          precioUnitario: total,
        },
      ],
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await eliminarEgreso(deleteId);
      setEgresos((prev) => prev.filter((e) => e.id !== deleteId));
      setConfirmOpen(false);
      setDeleteId(null);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setDeleteId(null);
  };

  const handleSaveFactura = async (payload) => {
    setSaving(true);
    try {
      if (dialogMode === "edit" && editId) {
        await actualizarEgreso(editId, payload);
      } else {
        await guardarEgreso(payload);
      }
      await refreshEgresos();
      setDialogOpen(false);
      setDialogInitial(null);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const egresosDelDia = useMemo(() => {
    return egresos.filter((e) => e._fechaStr === fechaSeleccionada);
  }, [egresos, fechaSeleccionada]);

  const totalesDelDia = useMemo(() => {
    return egresosDelDia.reduce(
      (acc, e) => {
        const { totalUSD, totalBs } = calcularTotalesEgreso(e);
        acc.totalUSD += totalUSD;
        acc.totalBs += totalBs;
        return acc;
      },
      { totalUSD: 0, totalBs: 0 }
    );
  }, [egresosDelDia]);

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
      <EgresoFacturaDialog
        open={dialogOpen}
        mode={dialogMode}
        tasaBCV={tasaBCV}
        initialValue={dialogInitial}
        onClose={() => {
          if (saving) return;
          setDialogOpen(false);
        }}
        onSave={handleSaveFactura}
        saving={saving}
      />

      <Dialog open={confirmOpen} onClose={cancelDelete}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro que deseas eliminar este egreso? Esta acción no se
            puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="primary">
            Cancelar
          </Button>
          <Button onClick={confirmDelete} color="error" autoFocus disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2 }}>
        <Typography variant="h6" sx={{ mb: 0 }}>
          Egresos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog} disabled={loading || saving}>
          Agregar egreso
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Resumen del día
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Día"
            views={["year", "month", "day"]}
            value={
              fechaSeleccionada && typeof fechaSeleccionada === "string"
                ? dayjs(fechaSeleccionada.split("/").reverse().join("-"))
                : null
            }
            onChange={(date) => {
              if (date && dayjs(date).isValid()) {
                const d = String(dayjs(date).date()).padStart(2, "0");
                const m = String(dayjs(date).month() + 1).padStart(2, "0");
                const y = dayjs(date).year();
                setFechaSeleccionada(`${d}/${m}/${y}`);
              }
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" sx={{ minWidth: 120 }} />
            )}
            disableFuture
            maxDate={dayjs().startOf("day")}
          />
        </LocalizationProvider>
      </Box>

      <Box sx={{ width: "100%", overflowX: { xs: "auto", sm: "visible" } }}>
        {isMobile ? (
          <Box>
            <Paper sx={{ p: 1.5, mb: 1, bgcolor: "#ffe0e0" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <Typography variant="body2" fontWeight={700}>Total Egresos</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
                  $ {totalesDelDia.totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. {totalesDelDia.totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>

            {loading ? (
              <LinearProgress sx={{ width: "100%" }} />
            ) : egresosDelDia.length === 0 ? (
              <Typography align="center" color="text.secondary" sx={{ py: 1 }}>
                Sin egresos registrados
              </Typography>
            ) : (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight={600}>Detalle de egresos</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {egresosDelDia.map((e) => {
                    const { totalUSD, totalBs } = calcularTotalesEgreso(e);
                    return (
                      <Paper key={e.id} sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {(e.proveedor || e.descripcion || "EGRESO").toString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {e.numeroDocumento ? `Doc: ${e.numeroDocumento}` : ""}
                              {e.rifCi ? `  |  RIF/CI: ${e.rifCi}` : ""}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                              $ {totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                              Bs. {totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                              Tasa: {typeof e.tasaFactura === "number" ? e.tasaFactura.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : typeof e.tasa === "number" ? e.tasa.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : tasaBCV ? Number(tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "-"}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
                          <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => openEditDialog(e)} disabled={!isOwner}>Editar</Button>
                          <Button size="small" color="error" startIcon={<DeleteIcon fontSize="small" />} onClick={() => handleDelete(e.id)} disabled={!isOwner}>Eliminar</Button>
                        </Box>
                      </Paper>
                    );
                  })}
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        ) : (
          <Table component={Paper} size="small" sx={{ mb: 2, minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell colSpan={7} sx={{ fontWeight: 700, bgcolor: "#ffe0e0" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Egresos</span>
                    <span>
                      $ {totalesDelDia.totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. {totalesDelDia.totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </span>
                  </Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Proveedor</TableCell>
                <TableCell>RIF/CI</TableCell>
                <TableCell>Factura/N-E</TableCell>
                <TableCell align="right">Total ($)</TableCell>
                <TableCell align="right">Total (Bs)</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ p: 0 }}>
                    <LinearProgress sx={{ width: "100%" }} />
                  </TableCell>
                </TableRow>
              ) : egresosDelDia.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "text.secondary" }}>
                    Sin egresos registrados
                  </TableCell>
                </TableRow>
              ) : (
                egresosDelDia.map((e) => {
                  const { totalUSD, totalBs } = calcularTotalesEgreso(e);
                  return (
                    <TableRow key={e.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {e._fechaDate
                          ? e._fechaDate.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : e._fechaStr || "-"}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{(e.proveedor || e.descripcion || "-").toString()}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{e.rifCi || "-"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{e.numeroDocumento || "-"}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {totalUSD > 0 ? totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {totalBs > 0 ? totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                          <IconButton size="small" color="primary" onClick={() => openEditDialog(e)} disabled={!isOwner}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(e.id)} disabled={!isOwner}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
