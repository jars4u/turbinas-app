import React, { useState, useEffect } from "react";
import WhatsAppEnvioModal from "./WhatsAppEnvioModal";
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { obtenerPlantillas, agregarPlantilla, editarPlantilla, eliminarPlantilla } from "../lib/plantillasFirebase";

export default function PlantillaMensajes({ onSelect }) {
  const [plantillas, setPlantillas] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [envioModalOpen, setEnvioModalOpen] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);

  useEffect(() => {
    async function fetchPlantillas() {
      setLoading(true);
      const data = await obtenerPlantillas();
      setPlantillas(data);
      setLoading(false);
    }
    fetchPlantillas();
  }, []);

  const handleGuardar = async () => {
    if (!mensaje.trim() || !nombre.trim()) return;
    setLoading(true);
    if (editId) {
      await editarPlantilla(editId, { mensaje, nombre });
    } else {
      await agregarPlantilla({ mensaje, nombre });
    }
    const data = await obtenerPlantillas();
    setPlantillas(data);
    setMensaje("");
    setNombre("");
    setEditId(null);
    setOpenDialog(false);
    setLoading(false);
  };

  const handleEditar = plantilla => {
    setMensaje(plantilla.mensaje);
    setNombre(plantilla.nombre || "");
    setEditId(plantilla.id);
    setOpenDialog(true);
  };

  const handleEliminar = async id => {
    setLoading(true);
    await eliminarPlantilla(id);
    const data = await obtenerPlantillas();
    setPlantillas(data);
    setLoading(false);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6" fontWeight={600} mb={2}>Plantillas de mensajes</Typography>
      <Button variant="outlined" color="primary" onClick={() => setOpenDialog(true)} sx={{ mb: 2 }}>+ Nueva plantilla</Button>
      {/* Vista móvil en tarjetas */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5 }}>Cargando...</Typography>
        ) : plantillas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5 }}>No hay plantillas guardadas.</Typography>
        ) : (
          plantillas.map((p) => (
            <Box
              key={p.id}
              sx={{
                border: '1px solid #eee',
                borderRadius: 2,
                p: 1,
                mb: 0.75,
                bgcolor: 'grey.50',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{p.nombre || 'Sin nombre'}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 0, p: 0.5, border: 0 }}
                    onClick={() => {
                      setPlantillaSeleccionada(p);
                      setEnvioModalOpen(true);
                    }}
                  >
                    Usar
                  </Button>
                  <IconButton color="primary" size="small" sx={{ p: 0.5 }} onClick={() => handleEditar(p)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton color="error" size="small" sx={{ p: 0.5 }} onClick={() => handleEliminar(p.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {p.mensaje.replace(/\{nombre\}/g, '{nombre}').slice(0, 60)}{p.mensaje.length > 60 ? '...' : ''}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      {/* Vista desktop en lista (sin cambios) */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <List>
          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>Cargando...</Typography>
          ) : plantillas.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>No hay plantillas guardadas.</Typography>
          ) : plantillas.map((p) => (
            <ListItem key={p.id} divider secondaryAction={
              <Box>
                <IconButton color="primary" onClick={() => handleEditar(p)}><EditIcon /></IconButton>
                <IconButton color="error" onClick={() => handleEliminar(p.id)}><DeleteIcon /></IconButton>
                <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={() => {
                  setPlantillaSeleccionada(p);
                  setEnvioModalOpen(true);
                }}>Usar</Button>
              </Box>
            }>
              <ListItemText
                primary={p.nombre || "Sin nombre"}
                secondary={
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {p.mensaje.replace(/\{nombre\}/g, "{nombre}").slice(0, 60)}{p.mensaje.length > 60 ? '...' : ''}
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
      <WhatsAppEnvioModal
        open={envioModalOpen}
        onClose={() => setEnvioModalOpen(false)}
        plantillaDefault={plantillaSeleccionada}
      />
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); setMensaje(""); setNombre(""); setEditId(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre de la plantilla"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
            placeholder="Ejemplo: Recordatorio de pedido"
          />
          <TextField
            label="Mensaje"
            multiline
            minRows={3}
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            fullWidth
            placeholder="Ejemplo: Hola {nombre}, tu pedido está listo."
            sx={{ mt: 1 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Usa <b>{'{nombre}'}</b> para insertar el nombre del cliente automáticamente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); setMensaje(""); setNombre(""); setEditId(null); }} color="primary">Cancelar</Button>
          <Button onClick={handleGuardar} variant="contained" color="success" disabled={!mensaje.trim() || !nombre.trim() || loading}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
