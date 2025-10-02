
import React, { useState, useEffect } from "react";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import { actualizarVehiculo } from "../lib/vehiculosFirebase";

import {
  Card,
  CardContent,
  Typography,
  Chip,
  Menu,
  MenuItem,
  Box,
} from "@mui/material";
import Divider from '@mui/material/Divider';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

// Sanitiza cualquier undefined en null, recursivamente
function sanitizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(k => {
      const val = obj[k];
      if (val === undefined) {
        newObj[k] = null;
      } else {
        newObj[k] = sanitizeDeep(val);
      }
    });
    return newObj;
  }
  return obj;
}



const VehicleCard = ({ vehiculo, onEdit, onStatusChange, height }) => {
  const {
  // id,
    arrivalTime = Date.now(),
  vehiculo: nombreVehiculo = "",
  // observaciones = "",
  // customer,
    servicio,
    precio,
  } = vehiculo;
  const [showPrecio, setShowPrecio] = useState(false);
  // arrivalTime puede venir como string desde la API, convertir a número
  const arrivalTimeNum = typeof arrivalTime === "string" ? Number(arrivalTime) : arrivalTime;
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(vehiculo.status || "servicio");
  const [estadosServicio, setEstadosServicio] = useState([]);

  // Cargar estados dinámicos desde Firestore
  useEffect(() => {
    async function cargarEstados() {
      const estados = await obtenerEstadosServicio();
      setEstadosServicio(estados);
    }
    cargarEstados();
  }, []);

  // Sincronizar el estado local con el prop vehiculo.status al recibir nuevos datos
  useEffect(() => {
    setCurrentStatus(vehiculo.status || "servicio");
  }, [vehiculo.status]);
  const [elapsed, setElapsed] = useState(Date.now() - arrivalTime);
  const [stoppedElapsed, setStoppedElapsed] = useState(null);

  // Contador en vivo según accionTimer del estado actual
  useEffect(() => {
    let timer;
    // Buscar el estado actual en la lista de estadosServicio
    const estadoActual = estadosServicio.find(e => e.nombre === currentStatus);
    const accionTimer = estadoActual?.accionTimer || "continuar";
    if (accionTimer === "continuar") {
      timer = setInterval(() => {
        setElapsed(Date.now() - arrivalTime);
      }, 1000);
      setStoppedElapsed(null);
    } else {
      setStoppedElapsed(elapsed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentStatus, arrivalTime, elapsed, estadosServicio]);

  // Formatear tiempo en hh:mm:ss
  const formatElapsed = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  // ...existing code...

  // Mostrar hora de registro estática
  // const formatHoraRegistro = (timestamp) => {
  //   const date = new Date(timestamp);
  //   return date.toLocaleTimeString([], {
  //     hour: "2-digit",
  //     minute: "2-digit",
  //     second: "2-digit",
  //   });
  // };

  const handleChipClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleStatusChange = async (newStatus) => {
    setCurrentStatus(newStatus);
    setAnchorEl(null);
    // Actualizar en Firestore
    if (vehiculo.id) {
      // Sanitización profunda para evitar undefined en cualquier campo
      const data = sanitizeDeep({ ...vehiculo, status: newStatus });
      await actualizarVehiculo(vehiculo.id, data);
    }
    if (typeof onStatusChange === "function") {
      onStatusChange(newStatus);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
  width: 210,
  minWidth: 210,
  maxWidth: 210,
  minHeight: 180,
  height: height || 'auto',
        mx: 1.5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        p: 0.8,
        cursor: "pointer",
        transition: "box-shadow 0.2s, border-color 0.2s",
        position: "relative",
        fontFamily: 'Poppins, sans-serif',
        fontSize: '0.80rem',
        "&:hover": {
          boxShadow: 4,
          borderColor: "primary.main",
          backgroundColor: "action.hover",
        },
        "& .MuiTypography-root": {
          fontSize: '0.80rem',
        },
      }}
      onClick={(e) => {
        // Evitar que el click en el chip o el botón de precio abra el modal de edición
        if (e.target.closest(".MuiChip-root") || e.target.closest(".ver-precio-btn")) return;
        onEdit();
      }}
    >
      <CardContent>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            width: "100%",
            overflow: "hidden",
            gap: 4
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 60 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 400, letterSpacing: 0.1, lineHeight: 1 }}>
              {new Date(arrivalTimeNum).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 400, letterSpacing: 0.1, lineHeight: 2 }}>
              {new Date(arrivalTimeNum).toLocaleTimeString()}
            </Typography>
          </div>
          <Chip
            label={
              estadosServicio.find(e => e.nombre === currentStatus)?.label || "Sin estado"
            }
            color={
              estadosServicio.find(e => e.nombre === currentStatus)?.color || "default"
            }
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleChipClick(e);
            }}
            sx={{ cursor: "pointer", maxWidth: 90, fontSize: '0.70rem', height: 22 }}
          />
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            {estadosServicio.filter(e => e.nombre !== "entregado").map((estado) => (
              <MenuItem
                key={estado.nombre}
                selected={estado.nombre === currentStatus}
                onClick={(event) => {
                  event.stopPropagation();
                  handleStatusChange(estado.nombre);
                }}
              >
                {estado.label}
              </MenuItem>
            ))}
          </Menu>
        </div>
        <Typography variant="caption" color="secondary" my={1}>
          {`Tiempo: ${formatElapsed(currentStatus === "servicio" ? elapsed : stoppedElapsed ?? elapsed)}`}
        </Typography>
        <Divider sx={{ my: 1 }} />
      {/* Cliente y teléfono en una sola línea, abajo antes del precio */}
      {vehiculo.customerName && vehiculo.customerPhone && (
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', mt: 1, mb: 0.2 }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            {vehiculo.customerName}
          </Typography>
        </Box>
      )}
        <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom>
          Datos de la turbina
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '1rem' }}>
          {nombreVehiculo && nombreVehiculo.toUpperCase()}
        </Typography>
        {/* Placa eliminada por requerimiento */}
        <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '1rem' }}>
          {servicio}
        </Typography>
        {vehiculo.observaciones && (
          <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '0.85rem', color: 'text.secondary' }}>
            <b>Obs:</b> {vehiculo.observaciones}
          </Typography>
        )}
        <Divider sx={{ my: 1 }} />
      </CardContent>
      <div style={{ position: "absolute", bottom: 12, right: 16 }}>
        <button
          className="ver-precio-btn"
          style={{
            background: "none",
            color: "#1976d2",
            border: "none",
            padding: 0,
            fontWeight: 400,
            cursor: "pointer",
            fontSize: 12,
            outline: "none",
            userSelect: "none",
            textDecoration: "none",
            fontFamily: 'Poppins, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseDown={() => setShowPrecio(true)}
          onMouseUp={() => setShowPrecio(false)}
          onMouseLeave={() => setShowPrecio(false)}
        >
          {showPrecio
            ? (precio !== undefined && precio !== null ? `$${precio}` : "-")
            : <VisibilityOutlinedIcon fontSize="small" />}
        </button>
      </div>
    </Card>
  );
}

export default VehicleCard;
