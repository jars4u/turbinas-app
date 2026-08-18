import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PaymentsIcon from "@mui/icons-material/Payments";
import ConfirmDialog from "./common/ConfirmDialog";
import { useMetodosPago } from "../context/MetodosPagoContext";
import {
  MONEDAS,
  MONEDA_BS,
  MONEDA_USD,
  normalizarMetodo,
  simboloMoneda,
} from "../lib/metodosPago";
import {
  actualizarMetodoPago,
  agregarMetodoPago,
  eliminarMetodoPago,
} from "../lib/metodosPagoFirebase";

const FORM_DEFAULT = { nombre: "", moneda: MONEDA_USD, activo: true };

export default function ConfiguracionMetodosPago() {
  const { metodos, loading, refrescar } = useMetodosPago();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [guardando, setGuardando] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [error, setError] = useState("");

  const claves = useMemo(
    () => new Set(metodos.map((m) => normalizarMetodo(m.clave || m.nombre))),
    [metodos]
  );

  const abrirDialogo = (metodo) => {
    setError("");
    if (metodo) {
      setEditando(metodo);
      setForm({ nombre: metodo.nombre, moneda: metodo.moneda, activo: metodo.activo !== false });
    } else {
      setEditando(null);
      setForm(FORM_DEFAULT);
    }
    setOpen(true);
  };

  const cerrarDialogo = () => {
    setOpen(false);
    setEditando(null);
    setForm(FORM_DEFAULT);
    setError("");
  };

  const handleGuardar = async () => {
    const nombre = (form.nombre || "").trim();
    if (!nombre) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!editando && claves.has(normalizarMetodo(nombre))) {
      setError("Ya existe una forma de pago con ese nombre.");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await actualizarMetodoPago(editando.id, {
          nombre,
          moneda: form.moneda,
          activo: !!form.activo,
        });
      } else {
        const orden = metodos.reduce((max, m) => Math.max(max, Number(m.orden) || 0), 0) + 1;
        await agregarMetodoPago({ nombre, moneda: form.moneda, activo: !!form.activo, orden });
      }
      await refrescar();
      cerrarDialogo();
    } catch (e) {
      setError(e?.message || "No se pudo guardar la forma de pago.");
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (metodo) => {
    setTogglingId(metodo.id);
    setError("");
    try {
      await actualizarMetodoPago(metodo.id, { activo: metodo.activo === false });
      await refrescar();
    } catch (e) {
      setError(e?.message || "No se pudo actualizar la forma de pago.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleEliminar = async () => {
    const metodo = confirmEliminar;
    setConfirmEliminar(null);
    if (!metodo) return;
    try {
      await eliminarMetodoPago(metodo.id);
      await refrescar();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la forma de pago.");
    }
  };

  const renderMoneda = (moneda) => (
    <Chip
      size="small"
      label={simboloMoneda(moneda)}
      color={moneda === MONEDA_BS ? "warning" : "success"}
      variant="outlined"
    />
  );

  const mensajeEliminar = confirmEliminar
    ? "Se eliminara \"" + confirmEliminar.nombre + "\" de las opciones al registrar pagos. " +
      "Los movimientos ya registrados con esta forma de pago se seguiran mostrando y se " +
      "totalizaran en " + simboloMoneda(confirmEliminar.moneda) + " como hasta ahora."
    : "";

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1 }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PaymentsIcon fontSize="small" sx={{ mb: "2px" }} />
          Formas de pago
        </Typography>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => abrirDialogo()}>
          Agregar
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Las formas activas son las que aparecen al facturar y al registrar ingresos. La moneda
        define si el monto se totaliza en dólares o en bolívares dentro del cierre del día.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {!loading && metodos.some((m) => !m.id) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No se pudo leer la configuración guardada; se están mostrando las formas de pago base.
          Vuelve a intentarlo o revisa los permisos de administrador.
        </Alert>
      )}

      {/* Vista móvil en tarjetas */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {loading
          ? [1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1 }} />
            ))
          : metodos.map((metodo) => (
              <Box
                key={metodo.id}
                sx={{ border: "1px solid #eee", borderRadius: 2, p: 1.5, mb: 1, bgcolor: "grey.50" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {metodo.nombre}
                    </Typography>
                    {renderMoneda(metodo.moneda)}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Switch
                      size="small"
                      checked={metodo.activo !== false}
                      onChange={() => handleToggleActivo(metodo)}
                      disabled={togglingId === metodo.id || !metodo.id}
                    />
                    <IconButton size="small" disabled={!metodo.id} onClick={() => abrirDialogo(metodo)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!metodo.predeterminado && (
                      <IconButton size="small" color="error" onClick={() => setConfirmEliminar(metodo)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {metodo.activo !== false ? "Activa" : "Inactiva"}
                </Typography>
              </Box>
            ))}
      </Box>

      {/* Vista escritorio en tabla */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Forma de pago</TableCell>
              <TableCell>Moneda</TableCell>
              <TableCell align="center">Activa</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton variant="text" height={28} />
                  </TableCell>
                </TableRow>
              ))
            ) : metodos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    Aún no hay formas de pago configuradas.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              metodos.map((metodo) => (
                <TableRow key={metodo.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {metodo.nombre}
                    </Typography>
                  </TableCell>
                  <TableCell>{renderMoneda(metodo.moneda)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                      <Switch
                        size="small"
                        checked={metodo.activo !== false}
                        onChange={() => handleToggleActivo(metodo)}
                        disabled={togglingId === metodo.id || !metodo.id}
                      />
                      {togglingId === metodo.id && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" disabled={!metodo.id} onClick={() => abrirDialogo(metodo)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {metodo.predeterminado ? (
                      <Tooltip title="Forma de pago base: se puede desactivar, pero no eliminar">
                        <span>
                          <IconButton size="small" disabled>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => setConfirmEliminar(metodo)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={open} onClose={cerrarDialogo} fullWidth maxWidth="xs">
        <DialogTitle>{editando ? "Editar forma de pago" : "Nueva forma de pago"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre"
            size="small"
            fullWidth
            autoFocus
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Moneda"
            size="small"
            select
            fullWidth
            value={form.moneda}
            onChange={(e) => setForm((prev) => ({ ...prev, moneda: e.target.value }))}
            helperText="Define en qué moneda se totaliza en el cierre del día."
            sx={{ mb: 2 }}
          >
            {MONEDAS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Switch
              size="small"
              checked={!!form.activo}
              onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
            />
            <Typography variant="body2">Disponible al registrar pagos</Typography>
          </Box>
          {editando && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Los movimientos ya registrados conservan el nombre con el que se guardaron; cambiar la
              moneda solo afecta cómo se totalizan de aquí en adelante.
            </Typography>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogo} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardar}
            disabled={guardando}
            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar forma de pago"
        message={mensajeEliminar}
        confirmText="Eliminar"
        confirmColor="error"
        onConfirm={handleEliminar}
        onCancel={() => setConfirmEliminar(null)}
      />
    </Box>
  );
}
