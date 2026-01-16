import * as React from 'react';
import { Box, Paper, Typography } from '@mui/material';

// Función para normalizar el estado (minúsculas, sin acentos, sin espacios extra)
function normalizarEstado(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapeo de estado a color único y consistente
const estadoColor = {
  'por retirar': '#FFA726', // naranja
  'en proceso': '#42A5F5', // azul
  'notificado': '#AB47BC', // morado
  'en espera': '#FFD600', // amarillo
  'entregado': '#66BB6A', // verde
};

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
  if (!eventos.length)
    return (
      <Typography color="text.secondary">No hay historial de cambios.</Typography>
    );
  return (
    <Box>
      {eventos.map((evento, idx) => {
        const estado = normalizarEstado(evento.estado);
        const colorPunto = estadoColor[estado] || `hsl(${(idx * 60) % 360}, 70%, 60%)`;
        const esUltimo = idx === eventos.length - 1;
        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'stretch', mb: 2 }}>
            <Box sx={{ mr: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: colorPunto, border: '2px solid #b0b3b8' }} />
              {!esUltimo && (
                <Box sx={{ width: 2, flex: 1, backgroundColor: '#b0b3b8', mt: 1 }} />
              )}
            </Box>
            <Paper elevation={0} sx={{ background: '#e0e3ea', color: '#333', borderRadius: 2, p: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {evento.titulo}
              </Typography>
              {evento.descripcion && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {evento.descripcion}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                {evento.fecha && (
                  <Typography variant="caption" color="text.secondary">
                    {formatFecha(evento.fecha)}
                  </Typography>
                )}
                {evento.usuario && (
                  <Typography variant="caption" color="text.secondary">
                    Usuario: {evento.usuario.split('@')[0]}
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
