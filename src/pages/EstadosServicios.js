import React, { useState, useEffect } from "react";
import {
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Chip,
  Checkbox
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  obtenerEstadosServicio,
  agregarEstadoServicio,
  actualizarEstadoServicio,
  eliminarEstadoServicio
} from '../lib/estadosServicioFirebase';

export default function EstadosServicios() {
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", label: "", color: "default", accionTimer: "continuar" });
  const [actionLoading, setActionLoading] = useState(false);
  const [defaultEstado, setDefaultEstado] = useState(null);
  const [savingDefaultId, setSavingDefaultId] = useState(null);

  useEffect(() => {
    obtenerEstadosServicio().then((data) => {
      setEstados(data);
      setLoading(false);
      // Buscar el estado default
      const def = data.find(e => e.defaultEstado);
      setDefaultEstado(def ? def.id : null);
    });
  }, []);

  const handleOpen = (estado) => {
    if (estado) {
      setForm({
        nombre: estado.nombre,
        label: estado.label,
        color: estado.color || "default",
        accionTimer: estado.accionTimer || "continuar"
      });
      setEditId(estado.id);
    } else {
      setForm({ nombre: "", label: "", color: "default", accionTimer: "continuar" });
      setEditId(null);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({ nombre: "", label: "", color: "default", accionTimer: "continuar" });
    setEditId(null);
  };

  const handleSave = async () => {
    setActionLoading(true);
    if (editId) {
      await actualizarEstadoServicio(editId, { ...form, defaultEstado: editId === defaultEstado });
    } else {
      const res = await agregarEstadoServicio({ ...form, defaultEstado: false });
      // Si es el primero, lo marcamos como default
      if (estados.length === 0) {
        await actualizarEstadoServicio(res.id, { ...form, defaultEstado: true });
        setDefaultEstado(res.id);
      }
    }
    const actualizados = await obtenerEstadosServicio();
    setEstados(actualizados);
    setActionLoading(false);
    handleClose();
  };

  const handleDelete = async (id) => {
    setActionLoading(true);
    await eliminarEstadoServicio(id);
    const actualizados = await obtenerEstadosServicio();
    setEstados(actualizados);
    setActionLoading(false);
    handleClose();
  };

  const handleDefaultChange = async (id) => {
    setSavingDefaultId(id);
    // Optimismo UI: actualiza localmente
    setDefaultEstado(id);
    setEstados(estados.map(e => ({ ...e, defaultEstado: e.id === id })));
    try {
      // Quitar default a todos menos el seleccionado
      await Promise.all(estados.map(e => e.id !== id ? actualizarEstadoServicio(e.id, { ...e, defaultEstado: false }) : null));
      await actualizarEstadoServicio(id, { ...estados.find(e => e.id === id), defaultEstado: true });
      const actualizados = await obtenerEstadosServicio();
      setEstados(actualizados);
    } catch (err) {
      // Si hay error, revertir
      setEstados(estados);
    }
    setSavingDefaultId(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentTurnedInIcon fontSize="small" sx={{ mb: '2px' }} />
          Estados de servicios
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Agregar estado
        </Button>
      </Box>
      <Accordion elevation={0} sx={{ boxShadow: 'none', border: 'none', background: 'transparent', mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, py: 0, minHeight: 36 }}>
          <Typography variant="subtitle2">Mostrar estados de servicio</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, py: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
              <CircularProgress color="primary" size={40} />
            </Box>
          ) : (
            <Table sx={{ border: 'none', minWidth: 0 }} size="small">
              <TableHead>
                <TableRow sx={{ height: 28 }}>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Nombre</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Etiqueta</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Default</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Color</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Acción Timer</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estados.map((estado) => (
                  <TableRow key={estado.id} sx={{ border: 'none', background: 'transparent', height: 28 }}>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.nombre}</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.label}</TableCell>
                      <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>
                        <Checkbox
                          checked={!!estado.defaultEstado}
                          onChange={() => handleDefaultChange(estado.id)}
                          color="primary"
                          inputProps={{ 'aria-label': 'Estado predeterminado' }}
                          disabled={savingDefaultId === estado.id}
                        />
                        {savingDefaultId === estado.id && (
                          <CircularProgress size={16} sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>
                        <Chip color={estado.color || "default"} size="small" sx={{ minWidth: 15, height: 15 }} />
                      </TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.accionTimer === "pausar" ? "Pausar" : "Continuar"}</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1 }} align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpen(estado)} sx={{ p: 0.5 }}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(estado.id)} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AccordionDetails>
      </Accordion>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editId ? "Editar estado" : "Agregar estado"}</DialogTitle>
        <DialogContent sx={{ minWidth: 320, position: 'relative' }}>
          {actionLoading && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress color="primary" size={32} />
            </Box>
          )}
          <TextField
            label="tag (etiqueta de sistema)"
            name="nombre"
            value={form.nombre}
            onChange={e => {
              // Solo minúsculas y sin espacios
              const value = e.target.value.replace(/[^a-z]/g, "").replace(/\s/g, "");
              setForm({ ...form, nombre: value });
            }}
            fullWidth
            sx={{ mb: 2, mt: 1 }}
            helperText="Solo minúsculas, sin espacios"
            error={form.nombre !== '' && !/^[a-z]+$/.test(form.nombre)}
          />
          <TextField
            label="Etiqueta (visible en la aplicación)"
            name="label"
            value={form.label}
            onChange={e => setForm({ ...form, label: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <InputLabel id="color-label" sx={{ mb: 1 }}>Color</InputLabel>
          <Select
            labelId="color-label"
            name="color"
            value={form.color}
            onChange={e => setForm({ ...form, color: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="default">Default</MenuItem>
            <MenuItem value="primary">Azul</MenuItem>
            <MenuItem value="secondary">Gris</MenuItem>
            <MenuItem value="success">Verde</MenuItem>
            <MenuItem value="warning">Amarillo</MenuItem>
            <MenuItem value="error">Rojo</MenuItem>
            <MenuItem value="info">Celeste</MenuItem>
          </Select>
          <InputLabel id="accion-timer-label" sx={{ mb: 1 }}>Acción en timer</InputLabel>
          <Select
            labelId="accion-timer-label"
            name="accionTimer"
            value={form.accionTimer || "continuar"}
            onChange={e => setForm({ ...form, accionTimer: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="continuar">Continuar</MenuItem>
            <MenuItem value="pausar">Pausar</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="error">Cancelar</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              !form.nombre || !form.label || !/^[a-z]+$/.test(form.nombre)
            }
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
