import React, { useEffect, useState } from "react";
import { Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Divider, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, List, ListItem, ListItemText } from "@mui/material";
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
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
  const [clienteWhatsapp, setClienteWhatsapp] = useState(null);
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState("");
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

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

  const openWhatsAppToNumber = (rawPhone, text = "") => {
    try {
      const telefono = (rawPhone || "").toString().replace(/[^\d]/g, "");
      let url = "";
      if (telefono.startsWith("58") && telefono.length >= 12) {
        url = `https://wa.me/${telefono}`;
      } else if (telefono.length >= 10) {
        url = `https://wa.me/${telefono}`;
      }
      if (!url) return;
      const finalUrl = text && text.trim() ? `${url}?text=${encodeURIComponent(text.trim())}` : url;
      window.open(finalUrl, '_blank');
    } catch (_) {
      // no-op
    }
  };


  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <ContactPhoneIcon fontSize="small" sx={{ mb: "2px" }} />
        <Typography variant="h6" fontWeight={600}>
          Agenda de contactos
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          size="small"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 220 } }}
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, flexDirection: 'column', width: '100%' }}>
        {/* Vista móvil en tarjetas */}
        {loading ? (
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Clientes</Typography>
            {clientes.filter(c =>
              (c.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
              (c.telefono || '').toLowerCase().includes((search || '').toLowerCase())
            ).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No hay clientes registrados.
              </Typography>
            ) : (
              clientes.filter(c =>
                (c.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
                (c.telefono || '').toLowerCase().includes((search || '').toLowerCase())
              ).map((c, idx, arr) => (
                <Box
                  key={c.id || c.nombre}
                  sx={{
                    border: '1px solid #eee',
                    borderRadius: 2,
                    p: 1,
                    mb: 0.5,
                    bgcolor: 'grey.50',
                  }}
                  onClick={() => {
                    setClienteSeleccionado(c);
                    setModelosLoading(true);
                    setModelosDialogOpen(true);
                    let modelos = Array.isArray(c.modelosServicios) ? [...c.modelosServicios] : [];
                    modelos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                    setModelosCliente(modelos);
                    setModelosLoading(false);
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{(c.nombre || '').toUpperCase()}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} onClick={e => e.stopPropagation()}>
                      <Button
                        variant="outlined"
                        color="success"
                        size="small"
                        sx={{ border: 0, minWidth: 0, p: 0.5 }}
                        onClick={() => openWhatsAppToNumber(c.telefono)}
                      >
                        <WhatsAppIcon sx={{ fontSize: 18, color: '#25D366' }} />
                      </Button>
                      <IconButton
                        size="small"
                        color="primary"
                        sx={{ p: 0.5 }}
                        onClick={() => {
                          setClienteEdit(c);
                          setEditForm({ nombre: c.nombre, telefono: c.telefono, etiqueta: c.etiqueta || "" });
                          setEditDialogOpen(true);
                          setEditError("");
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        sx={{ p: 0.5 }}
                        onClick={() => {
                          setClienteDelete(c);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Teléfono: {(c.telefono || '').toUpperCase()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Etiqueta: {c.etiqueta || '-'}
                  </Typography>
                  {idx < arr.length - 1 && (
                    <Divider sx={{ mt: 1 }} />
                  )}
                </Box>
              ))
            )}
          </Box>
        )}
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
          <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: '100%' }}>
            <Table
              size="small"
              sx={{
                minWidth: { xs: 360, md: 400 },
                '& .MuiTableCell-root': {
                  fontSize: { xs: '0.80rem', md: 14 },
                  py: { xs: 0.5, md: 1 },
                  px: { xs: 0.75, md: 1 },
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Teléfono</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Etiqueta</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Enviar</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientes.filter(c =>
                  (c.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
                  (c.telefono || '').toLowerCase().includes((search || '').toLowerCase())
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
                    (c.nombre || '').toLowerCase().includes((search || '').toLowerCase()) ||
                    (c.telefono || '').toLowerCase().includes((search || '').toLowerCase())
                  ).map((c) => (
                    <TableRow key={c.id || c.nombre} hover style={{ cursor: 'pointer' }} onClick={() => {
                      setClienteSeleccionado(c);
                      setModelosLoading(true);
                      setModelosDialogOpen(true);
                      let modelos = Array.isArray(c.modelosServicios) ? [...c.modelosServicios] : [];
                      modelos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                      setModelosCliente(modelos);
                      setModelosLoading(false);
                    }}>
                      <TableCell>{(c.nombre || '').toUpperCase()}</TableCell>
                      <TableCell>{(c.telefono || '').toUpperCase()}</TableCell>
                      <TableCell>{c.etiqueta || '-'}</TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          sx={{ border: 0 }}
                          onClick={() => openWhatsAppToNumber(c.telefono)}
                        >
                          <WhatsAppIcon sx={{ fontSize: 20, color: '#25D366' }} />
                        </Button>
                      </TableCell>
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
          </Box>
        )}

        <Dialog open={whatsappDialogOpen} onClose={() => setWhatsappDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pb: 0 }}>
            Enviar WhatsApp a {(clienteWhatsapp?.nombre || "").toUpperCase()}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Teléfono: <b>{clienteWhatsapp?.telefono}</b>
              </Typography>
              <TextField
                label="Mensaje de WhatsApp"
                multiline
                minRows={3}
                value={mensajeWhatsapp}
                onChange={e => setMensajeWhatsapp(e.target.value)}
                fullWidth
                placeholder="Escribe el mensaje a enviar..."
                sx={{ fontSize: 15 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWhatsappDialogOpen(false)} color="primary">Cancelar</Button>
            <Button
              variant="contained"
              color="success"
              disabled={mensajeWhatsapp.trim() === ""}
              onClick={() => {
                if (!clienteWhatsapp) return;
                const mensaje = encodeURIComponent(mensajeWhatsapp);
                let telefono = clienteWhatsapp.telefono.replace(/[^\\d]/g, "");
                let url = "";
                if (telefono.startsWith("58") && telefono.length >= 12) {
                  url = `https://wa.me/${telefono}?text=${mensaje}`;
                } else if (telefono.length >= 10) {
                  url = `https://wa.me/${telefono}?text=${mensaje}`;
                }
                if (url) {
                  window.open(url, '_blank');
                }
                setWhatsappDialogOpen(false);
                setMensajeWhatsapp("");
              }}
            >
              Enviar WhatsApp
            </Button>
          </DialogActions>
        </Dialog>

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
    </Box>
  );
}
