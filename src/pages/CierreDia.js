import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  TextField,
} from "@mui/material";
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';

export default function CierreDia() {
  const navigate = useNavigate();
  const [vehiculos, setVehiculos] = useState([]);
  // --- Estado para la tasa BCV ---
  const [tasaBCV, setTasaBCV] = useState(null);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [mostrarInputTasa, setMostrarInputTasa] = useState(false);
  const [tasaManual, setTasaManual] = useState("");

  useEffect(() => {
    fetch("http://localhost:4000/vehiculos")
      .then(res => res.json())
      .then(setVehiculos);
    fetchTasaBCV();
  }, []);

  // --- Función para obtener la tasa del BCV ---
  const fetchTasaBCV = async () => {
    setLoadingTasa(true);
    setMostrarInputTasa(false);
    try {
      // Primer intento: pydolarve.org
      const response = await fetch(
        "https://pydolarve.org/api/v1/dollar?page=bcv&monitor=usd"
      );
      const data = await response.json();
      if (data && data.price) {
        setTasaBCV(data.price);
        if (!sessionStorage.getItem("tasaBCVManual")) {
          sessionStorage.removeItem("tasaBCVManual");
        }
      } else {
        throw new Error("No se obtuvo tasa del primer servicio");
      }
    } catch (error) {
      // Segundo intento: ve.dolarapi.com
      try {
        const resp2 = await fetch("https://ve.dolarapi.com/v1/dolares");
        const json2 = await resp2.json();
        const oficialObj = Array.isArray(json2)
          ? json2.find((d) => d.fuente === "oficial")
          : null;
        if (oficialObj && oficialObj.promedio) {
          setTasaBCV(oficialObj.promedio);
          if (!sessionStorage.getItem("tasaBCVManual")) {
            sessionStorage.removeItem("tasaBCVManual");
          }
        } else {
          const stored = sessionStorage.getItem("tasaBCVManual");
          if (stored) {
            setTasaBCV(parseFloat(stored));
            setMostrarInputTasa(false);
          } else {
            setTasaBCV(null);
            setMostrarInputTasa(true);
          }
        }
      } catch (error2) {
        const stored = sessionStorage.getItem("tasaBCVManual");
        if (stored) {
          setTasaBCV(parseFloat(stored));
          setMostrarInputTasa(false);
        } else {
          setTasaBCV(null);
          setMostrarInputTasa(true);
        }
      }
    }
    setLoadingTasa(false);
  };

  const totalEntregados = vehiculos
    .filter(v => v.status === 'entregado')
    .reduce((acc, v) => acc + (v.precio || 0), 0);
  const totalPendiente = vehiculos
    .filter(v => v.status === 'espera')
    .reduce((acc, v) => acc + (v.precio || 0), 0);
  const totalServicio = vehiculos
    .filter(v => v.status === 'servicio')
    .reduce((acc, v) => acc + (v.precio || 0), 0);

  return (
    <Container maxWidth="sm" sx={{ mt: 6 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate('/')}
      >
        Atrás
      </Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PointOfSaleIcon fontSize="small" />
        <Typography variant="h5" fontWeight={600}>Cierre del día</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {/* --- Tasa BCV --- */}
      <Box
        my={2}
        p={2}
        sx={{
          border: "1px solid #ddd",
          borderRadius: 2,
          backgroundColor: "#f9f9f9",
          textAlign: "center",
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          Tasa de Cambio BCV
        </Typography>
        {loadingTasa ? (
          <CircularProgress size={24} />
        ) : mostrarInputTasa ? (
          <Box>
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              No se pudo obtener la tasa automáticamente. Ingresa el valor manualmente:
            </Typography>
            <TextField
              label="Tasa BCV manual"
              type="number"
              value={tasaManual}
              onChange={(e) =>
                setTasaManual(e.target.value.replace(/[^0-9.]/g, ""))
              }
              size="small"
              sx={{ maxWidth: 180, mx: "auto" }}
              inputProps={{
                inputMode: "decimal",
                pattern: "[0-9.]*",
                step: "0.01",
                min: 0,
                style: { MozAppearance: "textfield" },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              size="small"
              sx={{ mt: 1, ml: 1 }}
              disabled={!tasaManual}
              onClick={() => {
                setTasaBCV(parseFloat(tasaManual));
                sessionStorage.setItem("tasaBCVManual", tasaManual);
                setMostrarInputTasa(false);
              }}
            >
              Usar tasa
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="h5" color="primary.main">
              Bs. {tasaBCV
                ? tasaBCV.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "No disponible"}
            </Typography>
            {sessionStorage.getItem("tasaBCVManual") &&
              tasaBCV ===
                parseFloat(sessionStorage.getItem("tasaBCVManual")) && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ display: "block", mt: 1 }}
                >
                  Usando tasa BCV manual ingresada por el usuario durante esta sesión.
                </Typography>
              )}
          </>
        )}
        <Typography variant="caption" color="text.secondary">
          Fuente: Banco Central de Venezuela (BCV)
        </Typography>
      </Box>

      <Table component={Paper} size="small" sx={{ mb: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Total $</TableCell>
            <TableCell align="right">Total Bs</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Entregados</TableCell>
            <TableCell align="right">{totalEntregados.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell align="right">
              {tasaBCV ? (totalEntregados * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Pendiente (espera)</TableCell>
            <TableCell align="right">{totalPendiente.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell align="right">
              {tasaBCV ? (totalPendiente * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>En servicio</TableCell>
            <TableCell align="right">{totalServicio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell align="right">
              {tasaBCV ? (totalServicio * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        El total de entregados corresponde al monto cobrado hoy. El total pendiente y en servicio muestra los montos aún no cobrados.
      </Typography>
    </Container>
  );
}
