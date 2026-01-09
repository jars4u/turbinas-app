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
  Tooltip,
  Chip,
  Checkbox
} from "@mui/material";
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
  const [confirmDejarDeMostrar, setConfirmDejarDeMostrar] = useState({ open: false, id: null });
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", label: "", color: "default", accionTimer: "continuar", defaultFacturar: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [defaultEstado, setDefaultEstado] = useState(null);
  const [savingDefaultId, setSavingDefaultId] = useState(null);
  const [defaultFacturar, setDefaultFacturar] = useState(null);
  const [savingDefaultFacturarId, setSavingDefaultFacturarId] = useState(null);
  const [dejarDeMostrarId, setDejarDeMostrarId] = useState(null);

  useEffect(() => {
    obtenerEstadosServicio().then((data) => {
      setEstados(data);
      setLoading(false);
      // Buscar el estado default
      const def = data.find(e => e.defaultEstado);
      setDefaultEstado(def ? def.id : null);
      // Buscar el estado default de facturación
      const defFact = data.find(e => e.defaultFacturar);
      setDefaultFacturar(defFact ? defFact.id : null);
    });
  }, []);

  const handleOpen = (estado) => {
    if (estado) {
      setForm({
        nombre: estado.nombre,
        label: estado.label,
        color: estado.color || "default",
        accionTimer: estado.accionTimer || "continuar",
        defaultFacturar: !!estado.defaultFacturar
      });
      setEditId(estado.id);
    } else {
      setForm({ nombre: "", label: "", color: "default", accionTimer: "continuar", defaultFacturar: false });
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
      await actualizarEstadoServicio(editId, { ...form, defaultEstado: editId === defaultEstado, defaultFacturar: editId === defaultFacturar });
    } else {
      const res = await agregarEstadoServicio({ ...form, defaultEstado: false, defaultFacturar: false });
      // Si es el primero, lo marcamos como default
      if (estados.length === 0) {
        await actualizarEstadoServicio(res.id, { ...form, defaultEstado: true, defaultFacturar: false });
        setDefaultEstado(res.id);
      }
    }
    const actualizados = await obtenerEstadosServicio();
    setEstados(actualizados);
    setActionLoading(false);
    handleClose();
  };
  const handleDefaultFacturarChange = async (id) => {
    setSavingDefaultFacturarId(id);
    setDefaultFacturar(id);
    // Desmarcar todos los demás como defaultFacturar
    const nuevosEstados = estados.map(e => ({ ...e, defaultFacturar: e.id === id }));
    setEstados(nuevosEstados);
    try {
      // Quitar defaultFacturar a todos menos el seleccionado
      await Promise.all(estados.map(e => e.id !== id ? actualizarEstadoServicio(e.id, { ...e, defaultFacturar: false }) : null));
      await actualizarEstadoServicio(id, { ...estados.find(e => e.id === id), defaultFacturar: true });
      const actualizados = await obtenerEstadosServicio();
      setEstados(actualizados);
    } catch (err) {
      setEstados(estados);
    }
    setSavingDefaultFacturarId(null);
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

  const handleDejarDeMostrarChange = async (id) => {
    setConfirmDejarDeMostrar({ open: true, id });
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
          <span style={{ display: 'inline', fontWeight: 500 }}>
            <span style={{ display: 'inline', '@media (min-width:600px)': { display: 'none' } }}>Agregar</span>
            <span style={{ display: 'none', '@media (min-width:600px)': { display: 'inline' } }}>Agregar estado</span>
          </span>
        </Button>
      </Box>
      {/* Vista móvil en tarjetas */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Estados de servicio</Typography>
        {estados.map((estado) => (
          <Box
            key={estado.id}
            sx={{
              border: '1px solid #eee',
              borderRadius: 2,
              p: 1.5,
              mb: 1,
              bgcolor: 'grey.50',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{estado.nombre}</Typography>
              {estado.color === 'grey'
                ? <Chip size="small" sx={{ minWidth: 15, height: 15, bgcolor: 'grey.500' }} />
                : <Chip color={estado.color || 'default'} size="small" sx={{ minWidth: 15, height: 15 }} />}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Etiqueta: {estado.label}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                gap: { xs: 1.5, sm: 2 },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Table size="small" sx={{ minWidth: 0, '& .MuiTableCell-root': { py: 0.5, fontSize: '0.80rem' } }}>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ width: '60%' }}>
                        <Typography variant="caption">Default Registro</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={!!estado.defaultEstado}
                            onChange={() => handleDefaultChange(estado.id)}
                            color="primary"
                            inputProps={{ 'aria-label': 'Estado predeterminado' }}
                            disabled={savingDefaultId === estado.id}
                            sx={{ p: 0.5 }}
                          />
                          {savingDefaultId === estado.id && (
                            <CircularProgress size={14} sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="caption">Default Facturar</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={!!estado.defaultFacturar}
                            onChange={() => handleDefaultFacturarChange(estado.id)}
                            color="success"
                            inputProps={{ 'aria-label': 'Estado default de facturación' }}
                            disabled={savingDefaultFacturarId === estado.id}
                            sx={{ p: 0.5 }}
                          />
                          {savingDefaultFacturarId === estado.id && (
                            <CircularProgress size={14} sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="caption">Ocultar</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={!!estado.dejarDeMostrar}
                            onChange={() => handleDejarDeMostrarChange(estado.id)}
                            color="warning"
                            inputProps={{ 'aria-label': 'Estado dejar de mostrar' }}
                            sx={{ p: 0.5 }}
                          />
                          {dejarDeMostrarId === estado.id && (
                            <CircularProgress size={14} sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Acción timer: {estado.accionTimer === 'pausar' ? 'Pausar' : 'Continuar'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpen(estado)} sx={{ p: 0.5 }}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => handleDelete(estado.id)} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Mostrar tabla de estados directamente (desktop) */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
          <CircularProgress color="primary" size={40} />
        </Box>
      ) : (
        <Box sx={{ width: '100%', overflowX: 'auto', maxWidth: '100vw', mt: 1, display: { xs: 'none', md: 'block' } }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Estados de servicio</Typography>
          <Table
            size="small"
            sx={{
              border: 'none',
              minWidth: { xs: 640, md: 700 },
              '& .MuiTableCell-root': {
                fontSize: { xs: '0.80rem', md: 12 },
                py: { xs: 0.5, md: 0.5 },
                px: { xs: 0.75, md: 1 },
              },
            }}
          >
            <TableHead>
              <TableRow sx={{ height: 28 }}>
                <TableCell sx={{
                  py: 0.5,
                  px: 1,
                  fontSize: 12,
                  position: 'sticky',
                  left: 0,
                  background: '#fff',
                  zIndex: 2,
                  minWidth: 120
                }}>Nombre</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Etiqueta</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>Default Registro</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>Default Facturar</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>Dejar de mostrar</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Color</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Acción Timer</TableCell>
                <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {estados.map((estado) => (
                <TableRow key={estado.id} sx={{ border: 'none', background: 'transparent', height: 28 }}>
                  <TableCell sx={{
                    py: 0.5,
                    px: 1,
                    fontSize: 12,
                    position: 'sticky',
                    left: 0,
                    background: '#fff',
                    zIndex: 1,
                    minWidth: 120
                  }}>{estado.nombre}</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{estado.label}</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>
                    <Checkbox
                      checked={!!estado.defaultEstado}
                      onChange={() => handleDefaultChange(estado.id)}
                      color="primary"
                      inputProps={{ 'aria-label': 'Estado predeterminado' }}
                      disabled={savingDefaultId === estado.id}
                      sx={{ mx: 'auto', display: 'block' }}
                    />
                    {savingDefaultId === estado.id && (
                      <CircularProgress size={16} sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>
                    <Checkbox
                      checked={!!estado.defaultFacturar}
                      onChange={() => handleDefaultFacturarChange(estado.id)}
                      color="success"
                      inputProps={{ 'aria-label': 'Estado default de facturación' }}
                      disabled={savingDefaultFacturarId === estado.id}
                      sx={{ mx: 'auto', display: 'block' }}
                    />
                    {savingDefaultFacturarId === estado.id && (
                      <CircularProgress size={16} sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12, textAlign: 'center' }}>
                    <Checkbox
                      checked={!!estado.dejarDeMostrar}
                      onChange={() => handleDejarDeMostrarChange(estado.id)}
                      color="warning"
                      inputProps={{ 'aria-label': 'Estado dejar de mostrar' }}
                      sx={{ mx: 'auto', display: 'block' }}
                    />
                    {dejarDeMostrarId === estado.id && (
                      <CircularProgress size={16} sx={{ ml: 1 }} />
                    )}
                    <Dialog open={confirmDejarDeMostrar.open} onClose={() => setConfirmDejarDeMostrar({ open: false, id: null })}>
                      <DialogTitle>¿Ocultar este estado en el dashboard?</DialogTitle>
                      <DialogContent>
                        <Typography>Si confirmas, el estado dejará de mostrarse en el dashboard y no podrá ser seleccionado por los usuarios.</Typography>
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={() => setConfirmDejarDeMostrar({ open: false, id: null })} color="inherit">Cancelar</Button>
                        <Button color="warning" variant="contained" onClick={async () => {
                          const id = confirmDejarDeMostrar.id;
                          setDejarDeMostrarId(id);
                          const nuevosEstados = estados.map(e => ({ ...e, dejarDeMostrar: e.id === id }));
                          setEstados(nuevosEstados);
                          try {
                            await Promise.all(estados.map(e => e.id !== id ? actualizarEstadoServicio(e.id, { ...e, dejarDeMostrar: false }) : null));
                            await actualizarEstadoServicio(id, { ...estados.find(e => e.id === id), dejarDeMostrar: true });
                            const actualizados = await obtenerEstadosServicio();
                            setEstados(actualizados);
                          } catch (err) {
                            setEstados(estados);
                          }
                          setDejarDeMostrarId(null);
                          setConfirmDejarDeMostrar({ open: false, id: null });
                        }}>Confirmar</Button>
                      </DialogActions>
                    </Dialog>
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>
                    {estado.color === "grey"
                      ? <Chip size="small" sx={{ minWidth: 15, height: 15, bgcolor: 'grey.500' }} />
                      : <Chip color={estado.color || "default"} size="small" sx={{ minWidth: 15, height: 15 }} />
                    }
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
        </Box>
      )}
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
            <MenuItem value="grey">Gris</MenuItem>
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
