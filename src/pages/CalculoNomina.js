import React from "react";
import { obtenerConfiguracionNomina } from "../lib/configuracionNominaFirebase";
import { obtenerIngresos } from "../lib/ingresosFirebase";
import { useState, useEffect } from "react";
import { Button, Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, Box, TextField } from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import { LinearProgress } from "@mui/material";
import { obtenerCargos } from "../lib/cargosFirebase";
import * as XLSX from "xlsx";
import { obtenerEmpleados } from "../lib/empleadosFirebase";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

export default function CalculoNomina() {
  // Días de semana laboral (sincronizado con Firestore)
  const [diasSemanaLaboral, setDiasSemanaLaboral] = useState(5);
  useEffect(() => {
    obtenerConfiguracionNomina().then(cfg => {
      setDiasSemanaLaboral(cfg.diasSemanaLaboral || 5);
      localStorage.setItem("diasSemanaLaboral", cfg.diasSemanaLaboral || 5);
    });
  }, []);
  const [loading, setLoading] = useState(false);
  const [mostrarTabla, setMostrarTabla] = useState(false);
  const navigate = useNavigate();
  const [empleados, setEmpleados] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [totalServicios, setTotalServicios] = useState(0); // total de servicios facturados en el rango
  // Calcular lunes y viernes de la semana actual
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const formatDate = (date) => date.toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(formatDate(monday));
  const [fechaFin, setFechaFin] = useState(formatDate(friday));

  useEffect(() => {
  // Obtener cargos y empleados desde Firestore
  obtenerCargos().then(setCargos);
  obtenerEmpleados().then(setEmpleados);
}, []);

useEffect(() => {
  // Consultar Firestore para obtener el total de servicios facturados en el rango
  const cargarServicios = async () => {
    const ingresos = await obtenerIngresos();
    // Filtrar por rango de fechas
    const d1 = new Date(fechaInicio);
    const d2 = new Date(fechaFin);
    const serviciosEnRango = ingresos.filter(i => {
      if (!i.fechaRaw) return false;
      return i.fechaRaw >= d1 && i.fechaRaw <= d2;
    });
    setTotalServicios(serviciosEnRango.length);
  };
  cargarServicios();
}, [fechaInicio, fechaFin]);

  // Calcula el monto total a pagar según el cargo y cantidad de servicios en el rango
  const calcularMonto = (empleado) => {
    const cargoObj = cargos.find(c => c.id === empleado.cargo);
    const cantidad = totalServicios;
    if (!cargoObj) return 0;
    // Calcular días del rango
    let diasRango = 1;
    if (fechaInicio && fechaFin) {
      const d1 = new Date(fechaInicio);
      const d2 = new Date(fechaFin);
      diasRango = Math.max(1, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    }
    // Comisión: salario * cantidad de servicios
    if (cargoObj.tipo === "comision") {
      return (cargoObj.salario || 0) * cantidad;
    }
    // Por día: salario * días del rango
    if (cargoObj.tipo === "dia") {
      return (cargoObj.salario || 0) * diasRango;
    }
    // Por semana: salario * (días del rango / díasSemanaLaboral)
    if (cargoObj.tipo === "semana") {
      return (cargoObj.salario || 0) * (diasRango / diasSemanaLaboral);
    }
    // Por mes: salario * (días del rango / 30)
    if (cargoObj.tipo === "mes") {
      return (cargoObj.salario || 0) * (diasRango / 30);
    }
    // Default: salario fijo
    return cargoObj.salario || 0;
  };

  return (
  <Container maxWidth="md" sx={{ mt: 6 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate("/dashboard")}
      >
        Atrás
      </Button>
      <Typography variant="h4" gutterBottom>
        <span style={{ fontWeight: 600 }}>Cálculo de nómina</span>
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Selecciona el rango de fechas para calcular la nómina a pagar.
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          label="Desde"
          type="date"
          value={fechaInicio}
          onChange={e => setFechaInicio(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={fechaFin}
          onChange={e => setFechaFin(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="outlined"
          sx={{ ml: 'auto', minWidth: 140 }}
          disabled={loading || !fechaInicio || !fechaFin}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              setMostrarTabla(true);
            }, 1200); // Simula cálculo de nómina
          }}
        >
          Pagar nómina
        </Button>
      </Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {mostrarTabla && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Cédula</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Cant. servicios</TableCell>
                <TableCell>Monto a pagar ($)</TableCell>
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
                    <TableCell>{totalServicios}</TableCell>
                    <TableCell>{calcularMonto(empleado).toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell>
                  </TableRow>
                );
              })}
              {empleados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                    No hay empleados registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="outlined" color="success" size="small" onClick={() => {
              // Generar datos para Excel
              const data = empleados.map(empleado => {
                const cargoObj = cargos.find(c => c.id === empleado.cargo);
                return {
                  Nombre: empleado.nombre,
                  Cedula: empleado.cedula,
                  Cargo: cargoObj ? cargoObj.nombre : "",
                  Servicios: totalServicios,
                  "Monto a pagar ($)": calcularMonto(empleado)
                };
              });
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Nomina");
              XLSX.writeFile(wb, `nomina_${fechaInicio}_${fechaFin}.xlsx`);
            }}
            startIcon={<DownloadIcon />}
          >
              Exportar a Excel
            </Button>
          </div>
        </Paper>
      )}
    </Container>
  );
}
