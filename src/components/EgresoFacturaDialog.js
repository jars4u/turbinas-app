import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { obtenerProveedores, upsertProveedor } from "../lib/proveedoresFirebase";

function ddmmyyyyFromDayjs(dj) {
  if (!dj || !dayjs(dj).isValid()) return "";
  const d = String(dayjs(dj).date()).padStart(2, "0");
  const m = String(dayjs(dj).month() + 1).padStart(2, "0");
  const y = String(dayjs(dj).year());
  return `${d}/${m}/${y}`;
}

function dayjsFromDdMmYyyy(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dj = dayjs(iso);
  return dj.isValid() ? dj : null;
}

function toNumberOrNaN(v) {
  if (v === null || v === undefined || v === "") return NaN;
  return Number(v);
}

function calcItemTotal(item) {
  const cantidad = toNumberOrNaN(item?.cantidad);
  const precio = toNumberOrNaN(item?.precioUnitario);
  if (!isFinite(cantidad) || !isFinite(precio)) return 0;
  if (cantidad <= 0 || precio < 0) return 0;
  return cantidad * precio;
}

export default function EgresoFacturaDialog({
  open,
  mode,
  tasaBCV,
  initialValue,
  onClose,
  onSave,
  saving,
  includeVencimiento,
}) {
  const [fechaDj, setFechaDj] = useState(dayjs());
  const [proveedor, setProveedor] = useState("");
  const [rifCi, setRifCi] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [monedaFactura, setMonedaFactura] = useState("USD");
  const [tasaFactura, setTasaFactura] = useState("");
  const [items, setItems] = useState([{ descripcion: "", cantidad: "1", precioUnitario: "" }]);
  const [observaciones, setObservaciones] = useState("");
  const [proveedores, setProveedores] = useState([]);
  const [fechaVencDj, setFechaVencDj] = useState(dayjs());
  const currencySym = monedaFactura === "USD" ? "$" : "Bs.";

  useEffect(() => {
    if (!open) return;

    const now = dayjs();
    const initFecha = initialValue?.fechaStr
      ? dayjsFromDdMmYyyy(initialValue.fechaStr)
      : initialValue?.fecha && typeof initialValue.fecha.toDate === "function"
        ? dayjs(initialValue.fecha.toDate())
        : null;

    setFechaDj(initFecha || now);
    setProveedor(initialValue?.proveedor || "");
    setRifCi(initialValue?.rifCi || "");
    setNumeroDocumento(initialValue?.numeroDocumento || "");
    setMonedaFactura(initialValue?.monedaFactura || "USD");

    const tasaInit =
      initialValue?.tasaFactura !== undefined && initialValue?.tasaFactura !== null && initialValue?.tasaFactura !== ""
        ? String(initialValue.tasaFactura)
        : tasaBCV
          ? String(tasaBCV)
          : "";
    setTasaFactura(tasaInit);

    if (Array.isArray(initialValue?.items) && initialValue.items.length > 0) {
      setItems(
        initialValue.items.map((it) => ({
          descripcion: it?.descripcion ?? "",
          cantidad: it?.cantidad !== undefined && it?.cantidad !== null ? String(it.cantidad) : "1",
          precioUnitario: it?.precioUnitario !== undefined && it?.precioUnitario !== null ? String(it.precioUnitario) : "",
        }))
      );
    } else {
      setItems([{ descripcion: "", cantidad: "1", precioUnitario: "" }]);
    }

    setObservaciones(initialValue?.observaciones || "");

    (async () => {
      try {
        const list = await obtenerProveedores();
        setProveedores(Array.isArray(list) ? list : []);
      } catch (e) {
        setProveedores([]);
      }
    })();

    const initVenc = initialValue?.vencimiento
      ? dayjsFromDdMmYyyy(initialValue.vencimiento)
      : initialValue?.fechaVencimientoStr
        ? dayjsFromDdMmYyyy(initialValue.fechaVencimientoStr)
        : initialValue?.fechaVencimiento && typeof initialValue.fechaVencimiento.toDate === "function"
          ? dayjs(initialValue.fechaVencimiento.toDate())
          : null;
    setFechaVencDj(initVenc || now);
  }, [open, initialValue, tasaBCV]);

  const totalFactura = useMemo(() => {
    return items.reduce((acc, it) => acc + calcItemTotal(it), 0);
  }, [items]);

  const canSave = useMemo(() => {
    const tasaNum = toNumberOrNaN(tasaFactura);
    if (!isFinite(tasaNum) || tasaNum <= 0) return false;
    if (!fechaDj || !dayjs(fechaDj).isValid()) return false;
    if (!proveedor.trim()) return false;
    if (!rifCi.trim()) return false;
    if (!numeroDocumento.trim()) return false;

    const validItems = items
      .map((it) => ({
        descripcion: (it?.descripcion || "").trim(),
        cantidad: toNumberOrNaN(it?.cantidad),
        precio: toNumberOrNaN(it?.precioUnitario),
      }))
      .filter((it) => it.descripcion || isFinite(it.cantidad) || isFinite(it.precio));

    if (validItems.length === 0) return false;

    for (const it of validItems) {
      if (!it.descripcion) return false;
      if (!isFinite(it.cantidad) || it.cantidad <= 0) return false;
      if (!isFinite(it.precio) || it.precio < 0) return false;
    }

    return totalFactura > 0;
  }, [tasaFactura, fechaDj, proveedor, rifCi, numeroDocumento, items, totalFactura]);

  const handleChangeItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { descripcion: "", cantidad: "1", precioUnitario: "" }]);
  };

  const handleRemoveItem = (idx) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0 ? next : [{ descripcion: "", cantidad: "1", precioUnitario: "" }];
    });
  };

  const handleSubmit = async () => {
    if (!canSave) return;

    const fechaStr = ddmmyyyyFromDayjs(fechaDj);
    const fechaVencStr = ddmmyyyyFromDayjs(fechaVencDj);
    const tasaNum = Number(tasaFactura);

    const itemsNorm = items
      .map((it) => {
        const descripcion = (it?.descripcion || "").trim().toUpperCase();
        const cantidad = Number(it?.cantidad);
        const precioUnitario = Number(it?.precioUnitario);
        if (!descripcion && !isFinite(cantidad) && !isFinite(precioUnitario)) return null;
        if (!descripcion) return null;
        if (!isFinite(cantidad) || cantidad <= 0) return null;
        if (!isFinite(precioUnitario) || precioUnitario < 0) return null;
        const totalItem = cantidad * precioUnitario;
        return { descripcion, cantidad, precioUnitario, totalItem };
      })
      .filter(Boolean);

    const total = itemsNorm.reduce((acc, it) => acc + (typeof it.totalItem === "number" ? it.totalItem : 0), 0);

    const montoUSD = monedaFactura === "USD" ? total : 0;
    const montoBs = monedaFactura === "Bs" ? total : 0;

    const payload = {
      tipo: "factura",
      fecha: fechaStr,
      fechaStr,
      vencimiento: includeVencimiento ? fechaVencStr : undefined,
      proveedor: proveedor.trim().toUpperCase(),
      rifCi: rifCi.trim().toUpperCase(),
      numeroDocumento: numeroDocumento.trim().toUpperCase(),
      monedaFactura,
      tasaFactura: tasaNum,
      items: itemsNorm,
      montoUSD,
      montoBs,
      observaciones: observaciones.trim(),
      descripcion: `COMPRA ${proveedor.trim().toUpperCase()} ${numeroDocumento.trim().toUpperCase()}`.trim(),
    };

    try {
      await onSave(payload);
      await upsertProveedor({ proveedor: proveedor.trim(), rifCi: rifCi.trim() });
    } catch (e) {
      // si falla el guardado principal, no insistimos con proveedor
      throw e;
    }
  };

  const handleDialogClose = (event, reason) => {
    if (reason === "backdropClick") return;
    if (typeof onClose === "function") onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReceiptLongIcon fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            {mode === "edit" ? "Editar egreso" : "Agregar egreso"}
          </Typography>
          {/* <Chip
            label={`${currencySym} ${totalFactura.toLocaleString(monedaFactura === "USD" ? "en-US" : "de-DE", { minimumFractionDigits: 2 })}`}
            color="primary"
            variant="outlined"
            sx={{ ml: 1 }}
          /> */}
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "#fafafa" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Fecha"
                value={fechaDj}
                onChange={(v) => setFechaDj(v)}
                disableFuture
                inputFormat="DD/MM/YYYY"
                mask="__/__/____"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarTodayIcon fontSize="inherit" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </LocalizationProvider>

            <Autocomplete
              options={proveedores}
              getOptionLabel={(opt) => (typeof opt === "string" ? opt : (opt?.proveedor || ""))}
              isOptionEqualToValue={(o, v) => (o?.proveedor || "") === (v?.proveedor || "")}
              value={proveedores.find((p) => p.proveedor === (proveedor || "").toUpperCase()) || null}
              onChange={(e, val) => {
                if (val && typeof val === "object") {
                  setProveedor(val.proveedor || "");
                  if (val.rifCi) setRifCi(val.rifCi || "");
                }
              }}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Proveedor"
                  size="small"
                  fullWidth
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <StorefrontIcon fontSize="inherit" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              onInputChange={(e, val) => setProveedor(val)}
            />

            <TextField
              label="C.I / RIF"
              value={rifCi}
              onChange={(e) => setRifCi(e.target.value)}
              size="small"
              fullWidth
            />


            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 2, gridColumn: { sm: "1 / -1" } }}>
              <TextField
                label="Factura o N/E"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                size="small"
                fullWidth
              />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>Moneda</Typography>
                <ToggleButtonGroup
                  color="primary"
                  value={monedaFactura}
                  exclusive
                  onChange={(e, val) => val && setMonedaFactura(val)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  <ToggleButton value="USD" sx={{ flex: 1 }}>USD</ToggleButton>
                  <ToggleButton value="Bs" sx={{ flex: 1 }}>Bs</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <TextField
                label="Tasa"
                type="number"
                value={tasaFactura}
                onChange={(e) => setTasaFactura(e.target.value.replace(/[^0-9.]/g, ""))}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MonetizationOnIcon fontSize="inherit" />
                    </InputAdornment>
                  ),
                }}
                // helperText={tasaBCV ? `Por defecto: ${Number(tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : ""}
              />
            
            </Box>
              {/* <Box sx={{ gridColumn: { sm: "1 / -1" }, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setTasaFactura(tasaBCV ? String(tasaBCV) : tasaFactura)}
                  disabled={!tasaBCV}
                  startIcon={<MonetizationOnIcon fontSize="small" />}
                  sx={{ mt: { xs: 1, sm: 0 } }}
                >
                  Usar tasa BCV del día
                </Button>
              </Box> */}

            <Box sx={{ gridColumn: { sm: "1 / -1" }, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "3fr 1fr" }, gap: 2 }}>
              <TextField
                label="Observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={1}
              />
              {includeVencimiento ? (
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Vencimiento"
                    value={fechaVencDj}
                    onChange={(v) => setFechaVencDj(v)}
                    inputFormat="DD/MM/YYYY"
                    mask="__/__/____"
                    renderInput={(params) => (
                      <TextField {...params} size="small" fullWidth />
                    )}
                  />
                </LocalizationProvider>
              ) : null}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Items</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddItem}>Agregar ítem</Button>
          </Box>

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                  <TableCell>#</TableCell>
                  <TableCell sx={{ width: { sm: 360 } }}>Descripción</TableCell>
                  <TableCell align="right" sx={{ width: 88 }}>Cant.</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>Precio</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>Total</TableCell>
                  <TableCell align="center" sx={{ width: 60 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it, idx) => {
                  const totalItem = calcItemTotal(it);
                  return (
                    <TableRow key={idx} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ width: { sm: 360 } }}>
                        <TextField
                          value={it.descripcion}
                          onChange={(e) => handleChangeItem(idx, { descripcion: e.target.value })}
                          size="small"
                          fullWidth
                          placeholder="Descripción del ítem"
                          sx={{ minWidth: 280 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ width: 88 }}>
                        <TextField
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => handleChangeItem(idx, { cantidad: e.target.value.replace(/[^0-9.]/g, "") })}
                          size="small"
                          inputProps={{ step: "0.01", min: 0 }}
                          sx={{ maxWidth: 88 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={it.precioUnitario}
                          onChange={(e) => handleChangeItem(idx, { precioUnitario: e.target.value.replace(/[^0-9.]/g, "") })}
                          size="small"
                          inputProps={{ step: "0.01", min: 0 }}
                          sx={{ maxWidth: 180 }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">{currencySym}</InputAdornment>
                            ),
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {currencySym} {totalItem.toLocaleString(monedaFactura === "USD" ? "en-US" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`Ítems: ${items.length}`} variant="outlined" />
              <Chip label={`Moneda: ${monedaFactura}`} variant="outlined" />
              <Chip label={`Tasa: ${tasaFactura || (tasaBCV ? Number(tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "-")}`} variant="outlined" />
            </Stack>
            <Typography variant="h6" fontWeight={700}>
              Total: {currencySym} {totalFactura.toLocaleString(monedaFactura === "USD" ? "en-US" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={!!saving}>Cancelar</Button>
        <Button variant="contained" startIcon={<MonetizationOnIcon />} onClick={handleSubmit} disabled={!canSave || !!saving}>
          {mode === "edit" ? "Guardar cambios" : "Agregar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
