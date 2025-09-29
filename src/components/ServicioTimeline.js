import * as React from 'react';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot, TimelineOppositeContent } from '@mui/lab';
import { Typography, Box } from '@mui/material';

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
    <Timeline position="right">
      {eventos.map((evento, idx) => (
        <TimelineItem key={idx}>
          <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.18, minWidth: 110, px: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: 14,
                color: 'text.secondary',
                lineHeight: 1.1
              }}
            >
              {evento.fecha ? formatFecha(evento.fecha) : ''}
            </Typography>
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot color={evento.color || 'primary'} />
            {idx < eventos.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Box>
              <Typography
                fontWeight={600}
                sx={{ fontSize: { xs: 14, sm: 16, md: 18 } }}
              >
                {evento.titulo}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: 12, sm: 14, md: 15 } }}
              >
                {evento.descripcion}
              </Typography>
              {evento.usuario && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: 10, sm: 12, md: 13 } }}
                >
                  Usuario: {evento.usuario.split('@')[0]}
                </Typography>
              )}
            </Box>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
