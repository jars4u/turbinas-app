import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import GroupIcon from '@mui/icons-material/Group';
import AddIcon from '@mui/icons-material/Add';
import React, { useEffect, useState } from "react";
import { registrarUsuario, obtenerUsuarios, actualizarUsuario, eliminarUsuario } from "../lib/usuariosFirebase";
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from "@mui/icons-material/Delete";
// import EditIcon from "@mui/icons-material/Edit";

export default function Configuracion({ usuario, isAdmin }) {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Cargar usuarios al montar
  useEffect(() => {
    obtenerUsuarios().then(setUsuarios);
  }, []);

  // Abrir modal para crear usuario
  const handleOpen = () => {
    setOpen(true);
  };

  // Guardar usuario (solo crear)
  const [form, setForm] = useState({ usuario: "", clave: "", admin: false });
  const [repeatClave, setRepeatClave] = useState("");
  const [claveError, setClaveError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    if (form.clave !== repeatClave) {
      setClaveError("Las contraseñas no coinciden");
      return;
    }
    setClaveError("");
    setLoading(true);
    try {
      await registrarUsuario(form.usuario, form.clave, { admin: form.admin });
      const nuevosUsuarios = await obtenerUsuarios();
      setUsuarios(nuevosUsuarios);
      setOpen(false);
      setRepeatClave("");
    } catch (err) {
      setClaveError("Error al crear usuario: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  // Confirmar cambio de admin
  const handleAdminChange = (user) => {
    setSelectedUser(user);
    setConfirmOpen(true);
  };

  const handleConfirmAdmin = async () => {
    if (selectedUser) {
      await actualizarUsuario(selectedUser.id, { admin: !selectedUser.admin });
      const nuevosUsuarios = await obtenerUsuarios();
      setUsuarios(nuevosUsuarios);
    }
    setConfirmOpen(false);
    setSelectedUser(null);
  };

  // Eliminar usuario
  const handleDelete = async (id) => {
    await eliminarUsuario(id);
    setUsuarios(usuarios.filter((u) => u.id !== id));
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate('/')}
      >
        Atrás
      </Button>
      <Typography variant="h4" gutterBottom>
        <span style={{ fontWeight: 600 }}>Configuración</span>
      </Typography>
      {isAdmin && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupIcon fontSize="small" sx={{ mb: '2px' }} />
              Gestión de usuarios
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpen(null)}
            >
              Crear usuario
            </Button>
          </Box>
            <Accordion defaultExpanded elevation={0} sx={{ boxShadow: 'none', border: 'none', background: 'transparent', mt: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, py: 0, minHeight: 36 }}>
              <Typography variant="subtitle2">Mostrar usuarios registrados</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, py: 0 }}>
              <Table sx={{ border: 'none', minWidth: 0 }} size="small">
                <TableHead>
                  <TableRow sx={{ height: 28 }}>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Usuario</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Admin</TableCell>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id} sx={{ border: 'none', background: 'transparent', height: 28 }}>
                      <TableCell sx={{ py: 0.5, px: 1, fontSize: 12 }}>{u.email || u.usuario}</TableCell>
                      <TableCell sx={{ py: 0.5, px: 1 }}>
                        <Checkbox
                          checked={u.admin}
                          onChange={() => handleAdminChange(u)}
                          color="primary"
                          sx={{ p: 0.5 }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, px: 1 }}>
                        <Tooltip title="Eliminar">
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(u.id)}
                            size="small"
                            sx={{ p: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
          <Dialog open={open} onClose={() => setOpen(false)}>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogContent>
              <TextField
                margin="dense"
                label="Usuario"
                name="usuario"
                fullWidth
                value={form.usuario}
                onChange={(e) => setForm({ ...form, usuario: e.target.value })}
              />
              <TextField
                margin="dense"
                label="Clave"
                name="clave"
                type="password"
                fullWidth
                value={form.clave}
                onChange={(e) => setForm({ ...form, clave: e.target.value })}
              />
              <TextField
                margin="dense"
                label="Repetir clave"
                name="repeatClave"
                type="password"
                fullWidth
                value={repeatClave}
                onChange={(e) => setRepeatClave(e.target.value)}
                error={!!claveError}
                helperText={claveError}
              />
              <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
                <Checkbox
                  checked={form.admin}
                  onChange={(e) => setForm({ ...form, admin: e.target.checked })}
                />
                <Typography>Administrador</Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)} color="error" disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                disabled={form.clave === "" || repeatClave === "" || form.clave !== repeatClave || loading}
              >
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </DialogActions>
          </Dialog>
          <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
            <DialogTitle>Confirmar cambio de rol</DialogTitle>
            <DialogContent>
              <Typography>
                ¿Seguro que deseas {selectedUser?.admin ? 'quitar' : 'asignar'} permisos de administrador al usuario <b>{selectedUser?.usuario}</b>?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmOpen(false)} color="error">Cancelar</Button>
              <Button onClick={handleConfirmAdmin} variant="contained">Confirmar</Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
      {!isAdmin && (
        <Typography variant="body1" sx={{ mt: 4 }}>
          No tienes permisos de administrador para gestionar usuarios.
        </Typography>
      )}
    </Container>
  );
}
