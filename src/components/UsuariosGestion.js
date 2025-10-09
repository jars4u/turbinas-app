import React, { useEffect, useState } from "react";
import BadgeIcon from '@mui/icons-material/Badge';
import AddIcon from "@mui/icons-material/Add";
import {
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
  Divider,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import {
  registrarUsuario,
  obtenerUsuarios,
  actualizarUsuario,
  eliminarUsuario,
} from "../lib/usuariosFirebase";

export default function UsuariosGestion() {
  const { usuario, isAdmin, isOwner } = useAuth();
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
  const [form, setForm] = useState({
    usuario: "",
    clave: "",
    admin: false,
    owner: false,
  });
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
      await registrarUsuario(form.usuario, form.clave, {
        admin: form.admin,
        owner: form.owner,
      });
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

  // Eliminar usuario con confirmación
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserMsg, setDeleteUserMsg] = useState("");

  const handleDelete = (id) => {
    const user = usuarios.find((u) => u.id === id);
    if (!user) return;
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
    setDeleteUserMsg("");
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setDeleteUserMsg("");
    try {
      await eliminarUsuario({
        id: userToDelete.id,
        email: userToDelete.email || userToDelete.usuario,
      });
      setUsuarios(usuarios.filter((u) => u.id !== userToDelete.id));
      setDeleteUserMsg("Usuario eliminado correctamente.");
      // Si el usuario eliminado es el actual, cerrar sesión y redirigir
      if (
        auth.currentUser &&
        (auth.currentUser.email === userToDelete.email ||
          auth.currentUser.email === userToDelete.usuario)
      ) {
        setTimeout(async () => {
          await auth.signOut();
          window.location.href = "/accesodenegado";
        }, 800);
      } else {
        setTimeout(() => {
          setDeleteUserDialogOpen(false);
          setUserToDelete(null);
          setDeleteUserMsg("");
        }, 1000);
      }
    } catch (err) {
      setDeleteUserMsg("Error al eliminar usuario: " + (err.message || ""));
    }
    setDeletingUser(false);
  };

  return (
    <Box>
      {/* Gestión de usuarios solo editable por owner */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <BadgeIcon fontSize="medium" sx={{ mb: "2px" }} />
          Gestión de usuarios
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => isOwner && handleOpen(null)}
          disabled={!isOwner}
        >
          <span style={{ display: 'inline', fontWeight: 500 }}>
            <span style={{ display: 'inline', '@media (min-width:600px)': { display: 'none' } }}>Crear</span>
            <span style={{ display: 'none', '@media (min-width:600px)': { display: 'inline' } }}>Crear usuario</span>
          </span>
        </Button>
      </Box>
      {/* Mostrar usuarios registrados */}
          <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
            <Table sx={{ border: "none", minWidth: 600 }} size="small">
              <TableHead>
                <TableRow
                  sx={{
                    height: 28,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <TableCell
                    sx={{
                      py: 0.5,
                      px: 1,
                      fontSize: 12,
                      flex: 1,
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: '#fff',
                      minWidth: 120,
                      boxShadow: { xs: '2px 0 4px -2px #ccc', sm: 'none' },
                    }}
                  >
                    Usuario
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 0.5,
                      px: 1,
                      fontSize: 12,
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    Admin
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 0.5,
                      px: 1,
                      fontSize: 12,
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    Owner
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 0.5,
                      px: 1,
                      fontSize: 12,
                      flex: 1,
                      textAlign: "right",
                    }}
                  >
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow
                    key={u.id}
                    sx={{
                      border: "none",
                      background: "transparent",
                      height: 28,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <TableCell
                      sx={{
                        py: 0.5,
                        px: 1,
                        fontSize: 12,
                        flex: 1,
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: '#fff',
                        minWidth: 120,
                        boxShadow: { xs: '2px 0 4px -2px #ccc', sm: 'none' },
                      }}
                    >
                      {u.email || u.usuario}
                    </TableCell>
                    <TableCell
                      sx={{ py: 0.5, px: 1, flex: 1, textAlign: "center" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                        }}
                      >
                        <Checkbox
                          checked={u.admin}
                          onChange={() => isOwner && handleAdminChange(u)}
                          color="primary"
                          sx={{ p: 0.5 }}
                          disabled={!isOwner}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ py: 0.5, px: 1, flex: 1, textAlign: "center" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                        }}
                      >
                        <Checkbox
                          checked={u.owner}
                          onChange={() => {
                            if (isOwner) {
                              actualizarUsuario(u.id, {
                                owner: !u.owner,
                              }).then(async () => {
                                const nuevosUsuarios =
                                  await obtenerUsuarios();
                                setUsuarios(nuevosUsuarios);
                              });
                            }
                          }}
                          color="secondary"
                          sx={{ p: 0.5 }}
                          disabled={!isOwner}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ py: 0.5, px: 1, flex: 1, textAlign: "right" }}
                    >
                      <Tooltip title="Eliminar">
                        <span>
                          <IconButton
                            onClick={() => isOwner && handleDelete(u.id)}
                            size="small"
                            sx={{ p: 0.5, color: "error.main" }}
                            disabled={!isOwner}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                    {/* Modal de confirmación de borrado de usuario (fuera del mapeo de filas) */}
                    <Dialog
                      open={deleteUserDialogOpen}
                      onClose={() => setDeleteUserDialogOpen(false)}
                    >
                      <DialogTitle>Confirmar eliminación</DialogTitle>
                      <DialogContent>
                        <Typography>
                          ¿Seguro que deseas eliminar al usuario{" "}
                          <b>
                            {userToDelete?.email || userToDelete?.usuario}
                          </b>
                          ?
                        </Typography>
                        {deletingUser && (
                          <Box sx={{ mt: 2 }}>
                            <CircularProgress size={24} />
                          </Box>
                        )}
                        {deleteUserMsg && (
                          <Typography
                            sx={{ mt: 2 }}
                            color={
                              deleteUserMsg.startsWith("Usuario eliminado")
                                ? "success.main"
                                : "error"
                            }
                          >
                            {deleteUserMsg}
                          </Typography>
                        )}
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={() => setDeleteUserDialogOpen(false)}
                          color="primary"
                          disabled={deletingUser}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={confirmDeleteUser}
                          color="error"
                          variant="contained"
                          disabled={deletingUser}
                        >
                          Eliminar
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {!isOwner && (
            <Box sx={{ mt: 2 }}>
              <Typography color="error" fontWeight={500}>
                Solo el usuario Owner puede modificar la gestión de
                usuarios.
              </Typography>
            </Box>
          )}
      {/* Fin mostrar usuarios registrados */}
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
            disabled={!isOwner}
          />
          <TextField
            margin="dense"
            label="Clave"
            name="clave"
            type="password"
            fullWidth
            value={form.clave}
            onChange={(e) => setForm({ ...form, clave: e.target.value })}
            disabled={!isOwner}
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
            disabled={!isOwner}
          />
          <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
            <Box
              sx={{ display: "flex", alignItems: "center", height: "100%" }}
            >
              <Checkbox
                checked={form.admin}
                onChange={(e) =>
                  isOwner && setForm({ ...form, admin: e.target.checked })
                }
                disabled={!isOwner}
              />
              <Typography>Administrador</Typography>
              <Checkbox
                checked={form.owner}
                onChange={(e) =>
                  isOwner && setForm({ ...form, owner: e.target.checked })
                }
                sx={{ ml: 2 }}
                disabled={!isOwner}
              />
              <Typography>Owner</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpen(false)}
            color="error"
            disabled={loading || !isOwner}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              form.clave === "" ||
              repeatClave === "" ||
              form.clave !== repeatClave ||
              loading ||
              !isOwner
            }
          >
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmar cambio de rol</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que deseas {selectedUser?.admin ? "quitar" : "asignar"}{" "}
            permisos de administrador al usuario{" "}
            <b>{selectedUser?.usuario}</b>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            color="error"
            disabled={!isOwner}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmAdmin}
            variant="contained"
            disabled={!isOwner}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
