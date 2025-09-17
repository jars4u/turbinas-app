import React, { useState, useEffect } from "react";
import { InputLabel, Select, MenuItem } from "@mui/material";
import {
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
  Chip
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
  const [form, setForm] = useState({ nombre: "", label: "", color: "default" });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    obtenerEstadosServicio().then((data) => {
      setEstados(data);
      setLoading(false);
    });
  }, []);

  const handleOpen = (estado) => {
    if (estado) {
      setForm({ nombre: estado.nombre, label: estado.label, color: estado.color || "default" });
      setEditId(estado.id);
    } else {
      setForm({ nombre: "", label: "", color: "default" });
      setEditId(null);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({ nombre: "", label: "" });
    setEditId(null);
  };

  const handleSave = async () => {
    setActionLoading(true);
    if (editId) {
      await actualizarEstadoServicio(editId, form);
    } else {
      await agregarEstadoServicio(form);
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
      <Accordion defaultExpanded elevation={0} sx={{ boxShadow: 'none', border: 'none', background: 'transparent', mt: 1 }}>
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
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Color</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estados.map((estado) => (
                  <TableRow key={estado.id} sx={{ border: 'none', background: 'transparent', height: 28 }}>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.nombre}</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.label}</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>
                      <Chip color={estado.color || "default"} size="small" sx={{ minWidth: 15, height: 15 }} />
                    </TableCell>
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
            label="Nombre (clave interna)"
            name="nombre"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Etiqueta (visible)"
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="error">Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.nombre || !form.label}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
