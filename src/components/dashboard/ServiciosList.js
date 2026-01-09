import React from "react";
import { Box, Grid, Chip, Typography, Fade, useMediaQuery } from "@mui/material";
import VehicleCard from "../../components/VehicleCard";
import ServicioSkeletons from "./ServicioSkeletons";

export default function ServiciosList({
  vehiculos = [],
  estadosServicio = [],
  nombreOcultar = null,
  ordenEstado = "",
  ordenAsc = true,
  busqueda = "",
  coincideBusqueda,
  usuarioActivo,
  onOpen,
  onStatusChange,
  creatingSkeleton = false,
  isRegistering = false,
  isLoading = false,
}) {
  const isXs = useMediaQuery('(max-width:600px)');

  if (isLoading) {
    return isXs ? (
      <Box sx={{ mt: 1 }}>
        <ServicioSkeletons variant="mobile" count={14} />
      </Box>
    ) : (
      <Grid container spacing={3} columns={6} sx={{ mt: 1 }}>
        <ServicioSkeletons variant="desktop" count={12} />
      </Grid>
    );
  }

  const filtered = [...vehiculos]
    .filter(
      (v) =>
        (v.status || v.estado) !== nombreOcultar &&
        (!ordenEstado || (v.status || v.estado) === ordenEstado) &&
        (coincideBusqueda ? coincideBusqueda(v, busqueda) : true)
    );

  const sortList = (a, b) => {
    if (!ordenEstado)
      return ordenAsc ? a.arrivalTime - b.arrivalTime : b.arrivalTime - a.arrivalTime;
    if (ordenAsc)
      return (
        (a.status || a.estado).localeCompare(b.status || b.estado) || a.arrivalTime - b.arrivalTime
      );
    return (
      (b.status || b.estado).localeCompare(a.status || a.estado) || b.arrivalTime - a.arrivalTime
    );
  };

  const lista = filtered.sort(sortList);

  if (isXs) {
    return (
      <Box sx={{ width: '100%' }}>
        {lista.map((v) => {
          const estadoObj = estadosServicio.find((e) => e.nombre === (v.status || v.estado));
          const validColors = ["default", "primary", "secondary", "error", "info", "success", "warning"];
          const chipColor = validColors.includes(estadoObj?.color) ? estadoObj?.color : "default";
          const dt = new Date(typeof v.arrivalTime === "string" ? Number(v.arrivalTime) : v.arrivalTime);
          const fechaStr = dt.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" });
          const horaStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <Box
              key={v.id}
              onClick={() => onOpen?.(v)}
              sx={{ mb: 1.5, p: 1, borderRadius: 1.5, boxShadow: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>
                  {v.vehiculo ? String(v.vehiculo).toUpperCase() : ''}
                </Typography>
                <Chip label={estadoObj?.label || v.status || v.estado || 'Sin estado'} color={chipColor} size="small" sx={{ height: 22, fontSize: '0.75rem' }} />
              </Box>
              {v.servicio && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  {v.servicio}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2, mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.customerName || ''}
                  </Typography>
                  {v.customerPhone && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {v.customerPhone}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {fechaStr}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {horaStr}
                  </Typography>
                </Box>
              </Box>
              {v.observaciones && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {v.observaciones}
                </Typography>
              )}
            </Box>
          );
        })}
        <Fade in={creatingSkeleton && isRegistering} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
          <Box>
            <ServicioSkeletons variant="mobile" count={1} />
          </Box>
        </Fade>
      </Box>
    );
  }

  const heights = lista.map((v) => {
    let base = 180;
    if (v.observaciones) base += 18;
    if (v.servicio) base += 18;
    if (v.vehiculo) base += 18;
    return base;
  });
  const maxHeight = Math.max(...heights, 180);

  return (
    <Grid container spacing={3} columns={6} sx={{ display: { xs: "none", sm: "flex" } }} mt={1}>
      {lista.map((v) => (
        <Grid key={v.id} sx={{ mb: 3 }}>
          <VehicleCard
            vehiculo={v}
            onEdit={() => onOpen?.(v)}
            onStatusChange={(newStatus) => onStatusChange?.(v.id, newStatus)}
            usuarioActivo={usuarioActivo}
            height={maxHeight}
          />
        </Grid>
      ))}
      <Fade in={creatingSkeleton && isRegistering} timeout={{ enter: 120, exit: 0 }} unmountOnExit>
        <>
          <ServicioSkeletons variant="desktop" count={1} />
        </>
      </Fade>
    </Grid>
  );
}
