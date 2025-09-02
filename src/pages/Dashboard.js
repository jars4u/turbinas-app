import React, { useState } from "react";
import { useEffect } from "react";
import {
  Container,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Divider,
} from "@mui/material";
import VehicleCard from "../components/VehicleCard";

const initialVehicles = [
  {
    id: 1,
    nombre: "Camión 1",
    estado: "Activo",
    servicio: "En ruta",
    tiempo: 120,
  },
  {
    id: 2,
    nombre: "Camión 2",
    estado: "Mantenimiento",
    servicio: "Taller",
    tiempo: 0,
  },
  {
    id: 3,
    nombre: "Camión 3",
    estado: "Activo",
    servicio: "Disponible",
    tiempo: 45,
  },
];

export default function Dashboard() {
  // Cambiar status y guardar en la base de datos
  const handleStatusChange = (id, newStatus) => {
    const vehiculo = vehiculos.find((v) => v.id === id);
    if (!vehiculo) return;
    fetch(`http://localhost:4000/vehiculos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vehiculo, status: newStatus }),
    })
      .then((res) => res.json())
      .then((actualizado) => {
        setVehiculos(vehiculos.map((v) => (v.id === id ? actualizado : v)));
      });
  };
  const [vehiculos, setVehiculos] = useState([]);
  // Cargar vehículos desde la API al montar
  useEffect(() => {
    fetch("http://localhost:4000/vehiculos")
      .then((res) => res.json())
      .then(setVehiculos);
  }, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehiculo: "",
    placa: "",
    servicio: "",
    precio: "",
    customerName: "",
    customerPhone: "",
    observaciones: "",
  });
  const [editId, setEditId] = useState(null);

  const handleOpen = (vehiculo) => {
    if (vehiculo) {
      setForm({
        vehiculo: vehiculo.vehiculo || "",
        placa: vehiculo.placa || "",
        servicio: vehiculo.servicio || "",
        precio: vehiculo.precio || "",
        customerName: vehiculo.customerName || "",
        customerPhone: vehiculo.customerPhone || "",
        observaciones: vehiculo.observaciones || "",
      });
      setEditId(vehiculo.id);
    } else {
      setForm({
        vehiculo: "",
        placa: "",
        servicio: "",
        precio: "",
        customerName: "",
        customerPhone: "",
        observaciones: "",
      });
      setEditId(null);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({
      vehiculo: "",
      placa: "",
      servicio: "",
      precio: "",
      customerName: "",
      customerPhone: "",
      observaciones: "",
    });
    setEditId(null);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    const vehiculoData = {
      vehiculo: form.vehiculo,
      placa: form.placa,
      servicio: form.servicio,
      arrivalTime: editId
        ? vehiculos.find((v) => v.id === editId)?.arrivalTime
        : Date.now(),
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      observaciones: form.observaciones,
      status: editId
        ? vehiculos.find((v) => v.id === editId)?.status || "servicio"
        : "servicio",
      precio: form.precio === "" ? null : Number(form.precio),
    };
    if (editId) {
      fetch(`http://localhost:4000/vehiculos/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehiculoData),
      })
        .then((res) => res.json())
        .then((actualizado) => {
          setVehiculos(
            vehiculos.map((v) => (v.id === editId ? actualizado : v))
          );
          handleClose();
        });
    } else {
      fetch("http://localhost:4000/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehiculoData),
      })
        .then((res) => res.json())
        .then((nuevo) => {
          setVehiculos([...vehiculos, nuevo]);
          handleClose();
        });
    }
  };

  const handleDelete = () => {
    if (editId) {
      fetch(`http://localhost:4000/vehiculos/${editId}`, {
        method: "DELETE",
      }).then(() => {
        setVehiculos(vehiculos.filter((v) => v.id !== editId));
        handleClose();
      });
    }
  };

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 4, maxWidth: "100%", width: "100%", px: 4 }}
    >
      <Typography variant="h4" gutterBottom>
        <span style={{ fontWeight: 600 }}>Vehículos en servicio</span>
      </Typography>
      <Button
        variant="outlined"
        color="primary"
        size="small"
        sx={{ mb: 2 }}
        onClick={() => handleOpen()}
      >
        Registrar Vehículo
      </Button>
      <Grid container spacing={2}>
        {[...vehiculos]
          .sort((a, b) => a.arrivalTime - b.arrivalTime)
          .map((v) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={2.4}
              lg={2.4}
              xl={2.4}
              key={v.id}
              sx={{ mb: 3 }}
            >
              <VehicleCard
                vehiculo={v}
                onEdit={() => handleOpen(v)}
                onStatusChange={(newStatus) =>
                  handleStatusChange(v.id, newStatus)
                }
              />
            </Grid>
          ))}
      </Grid>
      <Dialog open={open} onClose={handleClose}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px 0 24px",
          }}
        >
          <Typography variant="h6">
            {editId ? "Editar Vehículo" : "Registrar Vehículo"}
          </Typography>
          {editId && (
            <Button
              onClick={handleDelete}
              variant="outlined"
              size="small"
              color="error"
            >
              Eliminar
            </Button>
          )}
        </div>
        <DialogContent>
          <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom sx={{ mt: 1 }}>
            Datos del vehículo
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <TextField
            margin="dense"
            label="Vehículo"
            name="vehiculo"
            fullWidth
            value={form.vehiculo}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Placa"
            name="placa"
            fullWidth
            value={form.placa}
            onChange={handleChange}
          />
          <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom sx={{ mt: 2 }}>
            Datos del servicio
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <TextField
            margin="dense"
            label="Servicio"
            name="servicio"
            fullWidth
            value={form.servicio}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Observaciones"
            name="observaciones"
            fullWidth
            value={form.observaciones}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Precio"
            name="precio"
            type="number"
            fullWidth
            value={form.precio}
            onChange={handleChange}
          />
          <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom sx={{ mt: 2 }}>
            Datos del cliente
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <TextField
            margin="dense"
            label="Cliente (Nombre)"
            name="customerName"
            fullWidth
            value={form.customerName}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Cliente (Teléfono)"
            name="customerPhone"
            fullWidth
            value={form.customerPhone}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            color="error"
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="outlined" size="small">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
