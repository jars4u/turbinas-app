
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
  Popover,
  Button,
} from "@mui/material";
import Divider from '@mui/material/Divider';
// VisibilityOutlinedIcon removed because price button is commented out
import WarningIcon from '@mui/icons-material/Warning';

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
  } = vehiculo;
  // arrivalTime puede venir como string desde la API, convertir a número
  const arrivalTimeNum = typeof arrivalTime === "string" ? Number(arrivalTime) : arrivalTime;
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(vehiculo.status || "servicio");
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [popoverConfirm, setPopoverConfirm] = useState({ open: false, anchorEl: null, estado: null, newStatus: null });

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

  // (Tiempo dinámico y formateo removidos para evitar variables sin uso en esta tarjeta)
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
    // Buscar si el estado seleccionado es dejarDeMostrar
    const estadoObj = estadosServicio.find(e => e.nombre === newStatus);
    if (estadoObj && estadoObj.dejarDeMostrar) {
      setPopoverConfirm({ open: true, anchorEl, estado: estadoObj, newStatus });
      return;
    }
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
        // Evitar que el click en el chip, el botón de precio o el cambio de estado abra el modal de edición
        if (
          e.target.closest(".MuiChip-root") ||
          e.target.closest(".ver-precio-btn") ||
          e.preventEdit ||
          Boolean(anchorEl) ||
          Boolean(popoverConfirm?.open)
        ) {
          return;
        }
        onEdit();
      }}
    >
      {/* ...contenido de la tarjeta... */}
      <Popover
        open={popoverConfirm.open}
        anchorEl={popoverConfirm.anchorEl}
        onClose={() => setPopoverConfirm({ open: false, anchorEl: null, estado: null, newStatus: null })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, maxWidth: 260 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Este servicio desaparecerá del Dashboard. ¿Desea continuar?
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setPopoverConfirm({ open: false, anchorEl: null, estado: null, newStatus: null });
              }}
              color="primary"
              variant="outlined"
            >
              Cancelar
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={async (e) => {
                // Evitar que el click se propague y abra el modal de edición
                e.stopPropagation();
                e.preventDefault();
                setPopoverConfirm({ open: false, anchorEl: null, estado: null, newStatus: null });
                setCurrentStatus(popoverConfirm.newStatus);
                setAnchorEl(null);
                if (vehiculo.id) {
                  const data = sanitizeDeep({ ...vehiculo, status: popoverConfirm.newStatus });
                  await actualizarVehiculo(vehiculo.id, data);
                }
                if (typeof onStatusChange === "function") {
                  onStatusChange(popoverConfirm.newStatus);
                }
              }}
            >
              Confirmar
            </Button>
          </Box>
        </Box>
      </Popover>
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
              {new Date(arrivalTimeNum).toLocaleTimeString("es-VE", { timeZone: "America/Caracas" })}
            </Typography>
          </div>
          <Chip
            label={
              estadosServicio.find(e => e.nombre === currentStatus)?.label || "Sin estado"
            }
            color={(() => {
              const estadoObj = estadosServicio.find(e => e.nombre === currentStatus);
              const validColors = ["default", "primary", "secondary", "error", "info", "success", "warning"];
              return validColors.includes(estadoObj?.color) ? estadoObj?.color : "default";
            })()}
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
            {estadosServicio.map((estado) => (
              <MenuItem
                key={estado.nombre}
                selected={estado.nombre === currentStatus}
                onClick={(event) => {
                  event.stopPropagation();
                  // Marcar el evento para evitar que el Card lo procese como edición
                  event.preventEdit = true;
                  const estadoObj = estadosServicio.find(e => e.nombre === estado.nombre);
                  if (estadoObj && estadoObj.dejarDeMostrar) {
                    setPopoverConfirm({ open: true, anchorEl: event.currentTarget, estado: estadoObj, newStatus: estado.nombre });
                  } else {
                    setAnchorEl(null);
                    handleStatusChange(estado.nombre);
                  }
                }}
              >
                {estado.label}
              </MenuItem>
            ))}
          </Menu>
        </div>
        {/* <Typography variant="caption" color="secondary" my={1}>
          {`Tiempo: ${formatElapsed(currentStatus === "servicio" ? elapsed : stoppedElapsed ?? elapsed)}`}
        </Typography> */}
        <Divider sx={{ my: 1 }} />
        {/* Cliente y teléfono en una sola línea, abajo antes del precio */}
        {vehiculo.customerName && vehiculo.customerPhone && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left', justifyContent: 'flex-start', mt: 1, mb: 0.2 }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
              {vehiculo.customerName}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {vehiculo.customerPhone}
            </Typography>
          </Box>
        )}
        <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom>
          Datos de la turbina
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '1rem' }}>
          {nombreVehiculo && nombreVehiculo.toUpperCase()}
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '1rem' }}>
          {servicio}
        </Typography>
        {vehiculo.observaciones && (
          <Typography variant="caption" display="block" sx={{ mb: 0.2, fontSize: '0.85rem', color: 'text.secondary' }}>
            <b><WarningIcon sx={{ color: 'warning.light', verticalAlign: 'middle', fontSize: '1rem' }} /> Obs:</b> {vehiculo.observaciones}
          </Typography>
        )}
        {/* <Divider sx={{ my: 1 }} /> */}
      </CardContent>
      {/* <div style={{ position: "absolute", bottom: 12, right: 16 }}>
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
      </div> */}
    </Card>
  );
}

export default VehicleCard;
