import React, { useState, useEffect } from "react";
import { guardarConfiguracionNomina, obtenerConfiguracionNomina } from "../lib/configuracionNominaFirebase";
import { guardarEmpleado, obtenerEmpleados, eliminarEmpleado } from "../lib/empleadosFirebase";
import { crearCargo, obtenerCargos, actualizarCargo, eliminarCargo } from "../lib/cargosFirebase";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Encabezado igual a los demás componentes de configuración
export default function NominaEmpleados() {
  // Días de semana laboral (por defecto 5, sincronizado con localStorage)
  const [diasSemanaLaboral, setDiasSemanaLaboral] = useState(5);
  useEffect(() => {
    obtenerConfiguracionNomina().then(cfg => {
      setDiasSemanaLaboral(cfg.diasSemanaLaboral || 5);
      localStorage.setItem("diasSemanaLaboral", cfg.diasSemanaLaboral || 5);
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("diasSemanaLaboral", diasSemanaLaboral);
    guardarConfiguracionNomina({ diasSemanaLaboral });
  }, [diasSemanaLaboral]);
  const [empleados, setEmpleados] = useState([]);
  // Cargar empleados desde Firestore al montar
  useEffect(() => {
    obtenerEmpleados().then(setEmpleados);
  }, []);
  const [cargos, setCargos] = useState([]); // [{id, nombre, salario, tipo}]
  const [nuevoCargo, setNuevoCargo] = useState({
    nombre: "",
    salario: "",
    tipo: "mes",
  });
  const [editCargo, setEditCargo] = useState(null); // cargo a editar
  const [openCrearCargo, setOpenCrearCargo] = useState(false);
  const [openEditarCargo, setOpenEditarCargo] = useState(false);
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    cargo: "",
    salario: "",
  });

  // CARGOS FIRESTORE
  useEffect(() => {
    obtenerCargos().then(setCargos);
  }, []);

  // Empleado
  const handleOpen = (index = null) => {
    setEditIndex(index);
    if (index !== null) {
      setForm(empleados[index]);
    } else {
      setForm({
        nombre: "",
        cedula: "",
        cargo: cargos[0]?.id || "",
        salario: "",
      });
    }
    setOpen(true);
  };
  // Gestión de cargos Firestore
  const handleAgregarCargo = async () => {
    if (!nuevoCargo.nombre.trim()) return;
    const cargoObj = {
      nombre: nuevoCargo.nombre.trim(),
      salario: parseFloat(nuevoCargo.salario) || 0,
      tipo: nuevoCargo.tipo,
    };
    await crearCargo(cargoObj);
    setNuevoCargo({ nombre: "", salario: "", tipo: "mes" });
    obtenerCargos().then(setCargos);
  };
  const handleEliminarCargo = async (id) => {
    await eliminarCargo(id);
    obtenerCargos().then(setCargos);
    // Si algún empleado tenía ese cargo, lo dejamos vacío
    setEmpleados(
      empleados.map((e) => (e.cargo === id ? { ...e, cargo: "" } : e))
    );
  };
  const handleEditarCargo = (cargo) => {
    setEditCargo(cargo);
    setOpenEditarCargo(true);
  };
  const handleGuardarEditCargo = async () => {
    if (!editCargo.nombre.trim()) return;
    await actualizarCargo(editCargo.id, {
      nombre: editCargo.nombre.trim(),
      salario: parseFloat(editCargo.salario) || 0,
      tipo: editCargo.tipo,
    });
    setOpenEditarCargo(false);
    setEditCargo(null);
    obtenerCargos().then(setCargos);
  };

  const handleClose = () => {
    setOpen(false);
    setEditIndex(null);
    setForm({ nombre: "", cedula: "", cargo: "", salario: "" });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (editIndex !== null) {
      // Editar empleado existente
      guardarEmpleado({ ...form, id: empleados[editIndex].id }).then(() => {
        obtenerEmpleados().then(setEmpleados);
        handleClose();
      });
    } else {
      // Agregar nuevo empleado
      guardarEmpleado(form).then(() => {
        obtenerEmpleados().then(setEmpleados);
        handleClose();
      });
    }
  };

  const handleDelete = (index) => {
    const id = empleados[index].id;
    eliminarEmpleado(id).then(() => {
      obtenerEmpleados().then(setEmpleados);
    });
  };

  return (
    <Box sx={{ mt: 2 }}>
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
          <AssignmentIndIcon fontSize="small" sx={{ mb: "2px" }} />
          Nómina de empleados
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setOpenCrearCargo(true)}
          >
            Crear cargo
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
          >
            Agregar empleado
          </Button>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <TextField
          label="Días x semana laboral"
          type="number"
          value={diasSemanaLaboral}
          onChange={e => setDiasSemanaLaboral(Math.max(1, parseInt(e.target.value) || 1))}
          size="small"
          sx={{ width: 160 }}
          inputProps={{ min: 1, max: 7 }}
        />
      </Box>
      {/* Modal para crear cargo */}
      <Dialog
        open={openCrearCargo}
        onClose={() => setOpenCrearCargo(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Crear cargo</DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre del cargo"
            value={nuevoCargo.nombre}
            onChange={(e) =>
              setNuevoCargo({ ...nuevoCargo, nombre: e.target.value })
            }
            fullWidth
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Salario ($)"
              value={nuevoCargo.salario}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                setNuevoCargo({ ...nuevoCargo, salario: val });
              }}
              type="number"
              sx={{ flex: 1 }}
              inputProps={{ min: 0, step: "0.01" }}
            />
            <TextField
              label="Tipo"
              value={nuevoCargo.tipo}
              onChange={(e) =>
                setNuevoCargo({ ...nuevoCargo, tipo: e.target.value })
              }
              select
              SelectProps={{ native: true }}
              sx={{ flex: 1 }}
            >
              <option value="semana">Por semana</option>
              <option value="dia">Por día</option>
              <option value="mes">Por mes</option>
              <option value="comision">Por comisión</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCrearCargo(false)}>Cancelar</Button>
          <Button
            onClick={async () => {
              await handleAgregarCargo();
              setOpenCrearCargo(false);
            }}
            variant="contained"
            disabled={!nuevoCargo.nombre.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
  <Accordion elevation={0} sx={{ boxShadow: 'none', border: 'none', background: 'transparent', mt: 1, mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, py: 0, minHeight: 36 }}>
          <Typography variant="subtitle2">Lista de cargos</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, py: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Salario ($)</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cargos.map((cargo) => (
                <TableRow key={cargo.id}>
                  <TableCell>{cargo.nombre}</TableCell>
                  <TableCell>{cargo.salario}</TableCell>
                  <TableCell>{cargo.tipo}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleEditarCargo(cargo)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleEliminarCargo(cargo.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {cargos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                    No hay cargos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>
      {/* Dialogo editar cargo */}
      <Dialog
        open={openEditarCargo}
        onClose={() => setOpenEditarCargo(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Editar cargo</DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre del cargo"
            value={editCargo?.nombre || ""}
            onChange={(e) =>
              setEditCargo({ ...editCargo, nombre: e.target.value })
            }
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Salario"
            value={editCargo?.salario || ""}
            onChange={(e) =>
              setEditCargo({ ...editCargo, salario: e.target.value })
            }
            fullWidth
            sx={{ mb: 2 }}
            type="number"
          />
          <TextField
            label="Tipo"
            value={editCargo?.tipo || "mes"}
            onChange={(e) =>
              setEditCargo({ ...editCargo, tipo: e.target.value })
            }
            fullWidth
            select
            SelectProps={{ native: true }}
            sx={{ mb: 2 }}
          >
            <option value="semana">Por semana</option>
            <option value="dia">Por día</option>
            <option value="mes">Por mes</option>
            <option value="comision">Por comisión</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditarCargo(false)}>Cancelar</Button>
          <Button onClick={handleGuardarEditCargo} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
      <Accordion
        elevation={0}
        sx={{
          boxShadow: "none",
          border: "none",
          background: "transparent",
          mt: 1,
          mb: 2,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ px: 0, py: 0, minHeight: 36 }}
        >
          <Typography variant="subtitle2">Lista de empleados</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, py: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Cédula</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empleados.map((empleado, idx) => {
                const cargoObj = cargos.find(c => c.id === empleado.cargo);
                return (
                  <TableRow key={idx}>
                    <TableCell>{empleado.nombre}</TableCell>
                    <TableCell>{empleado.cedula}</TableCell>
                    <TableCell>{cargoObj ? cargoObj.nombre : ""}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpen(idx)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(idx)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {empleados.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="center"
                    sx={{ color: "text.secondary" }}
                  >
                    No hay empleados registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editIndex !== null ? "Editar empleado" : "Agregar empleado"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Cédula"
            name="cedula"
            value={form.cedula}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          {/* Selector de cargo */}
          <TextField
            label="Cargo"
            name="cargo"
            value={form.cargo}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
            select
            SelectProps={{ native: true }}
          >
            <option value="">Selecciona un cargo</option>
            {cargos.map((cargo) => (
              <option key={cargo.id} value={cargo.id}>
                {cargo.nombre} - {cargo.salario} ({cargo.tipo})
              </option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
