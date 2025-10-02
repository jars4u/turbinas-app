import * as React from 'react';
import { Typography } from '@mui/material';
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

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
    <VerticalTimeline lineColor="#b0b3b8">
      {eventos.map((evento, idx) => {
        // Determinar color según estado normalizado
        const estado = normalizarEstado(evento.estado);
        // Si el estado no está en el mapeo, asignar un color único por índice
        const colorPunto = estadoColor[estado] || `hsl(${(idx * 60) % 360}, 70%, 60%)`;
        return (
          <VerticalTimelineElement
            key={idx}
            date={evento.fecha ? formatFecha(evento.fecha) : ''}
            contentStyle={{ background: '#e0e3ea', color: '#333', borderRadius: 12, boxShadow: 'none' }}
            icon={<span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: colorPunto, margin: 'auto', border: '2px solid #b0b3b8' }} />}
            iconStyle={{ background: 'transparent', boxShadow: 'none' }}
          >
            <h3 className="vertical-timeline-element-title">{evento.titulo}</h3>
            <p>{evento.descripcion}</p>
            {evento.usuario && (
              <span style={{ fontSize: 12, color: '#888' }}>
                Usuario: {evento.usuario.split('@')[0]}
              </span>
            )}
          </VerticalTimelineElement>
        );
      })}
    </VerticalTimeline>
  );
}
