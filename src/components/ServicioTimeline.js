import * as React from 'react';
import { Typography, Box, Avatar, Divider } from '@mui/material';

export default function ServicioTimeline({ eventos = [] }) {
  // Formato de fecha dd/mm/yyyy HH:mm
  const formatFecha = (fecha) => {
    if (!fecha) return "-";
    const d = new Date(fecha);
    if (isNaN(d)) return "-";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${min}`;
  };
  if (!eventos.length) return <Typography color="text.secondary">No hay historial de cambios.</Typography>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 1 }}>
      {eventos.map((evento, idx) => (
        <Box key={idx} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', minHeight: 44, position: 'relative' }}>
          {/* Timeline punto y línea */}
          <Box sx={{ width: 32, minWidth: 32, position: 'relative', display: 'flex', justifyContent: 'center' }}>
            {/* Punto */}
            <Box sx={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', zIndex: 2 }}>
              <Avatar sx={{ width: 16, height: 16, bgcolor: evento.color ? `${evento.color}.main` : 'primary.main', fontSize: 10 }} />
            </Box>
            {/* Línea */}
            {idx < eventos.length - 1 && (
              <Box sx={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)', width: 2, height: 'calc(100% - 24px)', bgcolor: 'grey.300', zIndex: 1 }} />
            )}
          </Box>
          {/* Fecha y contenido */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 1, pl: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ minWidth: 90, fontSize: 14, color: 'text.secondary', lineHeight: 1.1, pt: 0.5 }}
            >
              {evento.fecha ? formatFecha(evento.fecha) : ''}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={600} sx={{ fontSize: { xs: 14, sm: 16, md: 18 } }}>
                {evento.titulo}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14, md: 15 } }}>
                {evento.descripcion}
              </Typography>
              {evento.usuario && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 12, md: 13 } }}>
                  Usuario: {evento.usuario.split('@')[0]}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
