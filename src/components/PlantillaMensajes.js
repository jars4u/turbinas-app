import React, { useState, useEffect } from "react";
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={600} mb={2}>Plantillas de mensajes</Typography>
      <Button variant="outlined" color="primary" onClick={() => setOpenDialog(true)} sx={{ mb: 2 }}>+ Nueva plantilla</Button>
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
              <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={() => onSelect && onSelect(p.mensaje)}>Usar</Button>
            </Box>
          }>
            <ListItemText
              primary={<><b>{p.nombre || "Sin nombre"}</b><br />{p.mensaje.replace(/\{nombre\}/g, "{nombre}")}</>}
              secondary={<span style={{ color: '#888', fontSize: 13 }}>Puedes usar <b>{'{nombre}'}</b> para insertar el nombre del cliente.</span>}
            />
          </ListItem>
        ))}
      </List>
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
