import React, { useEffect, useState } from "react";
import { Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Divider, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, List, ListItem, ListItemText } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import { obtenerClientes, actualizarCliente, eliminarCliente } from "../lib/clientesFirebase";

export default function ClientesGestion() {
  const [clientes, setClientes] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);
  const [clienteDelete, setClienteDelete] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", telefono: "", etiqueta: "" });
  // Estados para el modal de modelos y servicios
  const [modelosDialogOpen, setModelosDialogOpen] = useState(false);
  const [modelosCliente, setModelosCliente] = useState([]);
  const [modelosLoading, setModelosLoading] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [addForm, setAddForm] = useState({ nombre: "", telefono: "", etiqueta: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [addError, setAddError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClientes() {
      setLoading(true);
      try {
        const data = await obtenerClientes();
        setClientes(data);
      } catch (e) {
        setClientes([]);
      }
      setLoading(false);
    }
    fetchClientes();
  }, []);


  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <ContactPhoneIcon fontSize="small" sx={{ mb: "2px" }} />
        <Typography variant="h6" fontWeight={600}>
          Agenda de contactos
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1 }}>
        <TextField
          size="small"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: 220 }}
        />
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={() => {
            setAddForm({ nombre: "", telefono: "" });
            setAddDialogOpen(true);
            setAddError("");
          }}
        >
          + Agregar cliente
        </Button>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {/* Diálogo para agregar cliente */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>Agregar cliente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nombre"
              value={addForm.nombre}
              onChange={e => setAddForm({ ...addForm, nombre: e.target.value })}
              fullWidth
              disabled={addLoading}
            />
            <TextField
              label="Teléfono"
              value={addForm.telefono}
              onChange={e => setAddForm({ ...addForm, telefono: e.target.value })}
              fullWidth
              disabled={addLoading}
            />
            <TextField
              label="Etiqueta"
              value={addForm.etiqueta}
              onChange={e => setAddForm({ ...addForm, etiqueta: e.target.value })}
              fullWidth
              disabled={addLoading}
            />
            {addError && <Typography color="error">{addError}</Typography>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} color="primary" disabled={addLoading}>Cancelar</Button>
          <Button
            onClick={async () => {
              setAddLoading(true);
              setAddError("");
              if (!addForm.nombre.trim() || !addForm.telefono.trim()) {
                setAddError("Nombre y teléfono son obligatorios");
                setAddLoading(false);
                return;
              }
              try {
                // Guardar en Firestore
                const { getFirestore, collection, addDoc } = await import("firebase/firestore");
                const db = getFirestore();
                await addDoc(collection(db, "clientes"), {
                  nombre: addForm.nombre.trim().toUpperCase(),
                  telefono: addForm.telefono.trim().toUpperCase(),
                  etiqueta: addForm.etiqueta.trim(),
                });
                const data = await obtenerClientes();
                setClientes(data);
                setAddDialogOpen(false);
              } catch (e) {
                setAddError("Error al agregar cliente");
              }
              setAddLoading(false);
            }}
            variant="contained"
            color="success"
            disabled={addLoading}
          >Agregar</Button>
        </DialogActions>
      </Dialog>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Table size="small" sx={{ minWidth: 400 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: 14 }}>Nombre</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 14 }}>Teléfono</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 14 }}>Etiqueta</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 14, textAlign: 'right' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clientes.filter(c =>
              c.nombre.toLowerCase().includes(search.toLowerCase()) ||
              c.telefono.toLowerCase().includes(search.toLowerCase())
            ).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay clientes registrados.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              clientes.filter(c =>
                c.nombre.toLowerCase().includes(search.toLowerCase()) ||
                c.telefono.toLowerCase().includes(search.toLowerCase())
              ).map((c) => (
                <TableRow key={c.id || c.nombre} hover style={{ cursor: 'pointer' }} onClick={() => {
                  setClienteSeleccionado(c);
                  setModelosLoading(true);
                  setModelosDialogOpen(true);
                  // Mostrar los modelosServicios guardados, ordenados por fecha
                  let modelos = Array.isArray(c.modelosServicios) ? [...c.modelosServicios] : [];
                  modelos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                  setModelosCliente(modelos);
                  setModelosLoading(false);
                }}>
                  <TableCell>{(c.nombre || "").toUpperCase()}</TableCell>
                  <TableCell>{(c.telefono || "").toUpperCase()}</TableCell>
                  <TableCell>{c.etiqueta || "-"}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" color="primary" sx={{ mr: 1 }} onClick={() => {
                      setClienteEdit(c);
                      setEditForm({ nombre: c.nombre, telefono: c.telefono, etiqueta: c.etiqueta || "" });
                      setEditDialogOpen(true);
                      setEditError("");
                    }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => {
                      setClienteDelete(c);
                      setDeleteDialogOpen(true);
                    }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Modal de modelos y servicios del cliente */}
      <Dialog open={modelosDialogOpen} onClose={() => setModelosDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modelos y servicios de {(clienteSeleccionado?.nombre || "").toUpperCase()}</DialogTitle>
        <DialogContent>
          {modelosLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : modelosCliente.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No hay servicios registrados para este cliente.</Typography>
          ) : (
            <List>
              {modelosCliente.map((m, idx) => (
                <ListItem key={idx} divider>
                  <ListItemText
                    primary={`Modelo: ${m.modelo.toUpperCase()} | Servicio: ${m.servicio.toUpperCase()}`}
                    secondary={m.fecha ? `Fecha: ${new Date(m.fecha).toLocaleDateString()}` : null}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModelosDialogOpen(false)} color="primary">Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de edición */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Editar cliente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nombre"
              value={editForm.nombre}
              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label="Teléfono"
              value={editForm.telefono}
              onChange={e => setEditForm({ ...editForm, telefono: e.target.value })}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label="Etiqueta"
              value={editForm.etiqueta}
              onChange={e => setEditForm({ ...editForm, etiqueta: e.target.value })}
              fullWidth
              disabled={editLoading}
            />
            {editError && <Typography color="error">{editError}</Typography>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="primary" disabled={editLoading}>Cancelar</Button>
          <Button
            onClick={async () => {
              setEditLoading(true);
              setEditError("");
              if (!editForm.nombre.trim() || !editForm.telefono.trim()) {
                setEditError("Nombre y teléfono son obligatorios");
                setEditLoading(false);
                return;
              }
              try {
                await actualizarCliente(clienteEdit.id, {
                  nombre: editForm.nombre.trim().toUpperCase(),
                  telefono: editForm.telefono.trim().toUpperCase(),
                  etiqueta: editForm.etiqueta.trim(),
                });
                const data = await obtenerClientes();
                setClientes(data);
                setEditDialogOpen(false);
              } catch (e) {
                setEditError("Error al guardar cambios");
              }
              setEditLoading(false);
            }}
            variant="contained"
            color="success"
            disabled={editLoading}
          >Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de eliminación */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Eliminar cliente</DialogTitle>
        <DialogContent>
          <Typography>¿Seguro que deseas eliminar al cliente <b>{clienteDelete?.nombre}</b>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary" disabled={deleteLoading}>Cancelar</Button>
          <Button
            onClick={async () => {
              setDeleteLoading(true);
              try {
                await eliminarCliente(clienteDelete.id);
                const data = await obtenerClientes();
                setClientes(data);
                setDeleteDialogOpen(false);
              } catch (e) {
                // Puedes mostrar un mensaje de error si lo deseas
              }
              setDeleteLoading(false);
            }}
            variant="contained"
            color="error"
            disabled={deleteLoading}
          >Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
