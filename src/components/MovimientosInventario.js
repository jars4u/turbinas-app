
import React from "react";
import { Box, Button, Typography } from "@mui/material";

export default function MovimientosInventario({ movimientos, inventario }) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [nuevoMov, setNuevoMov] = React.useState({ item: '', descripcion: '', movimiento: 'entrada', cantidad: '', montoBs: '', montoUSD: '' });

  // Autocompletar montos y descripción al seleccionar item
  React.useEffect(() => {
    if (!modalOpen) return;
    if (nuevoMov.item && inventario && inventario.length > 0) {
      const itemData = inventario.find(i => i.id === nuevoMov.item);
      if (itemData) {
        setNuevoMov(prev => ({
          ...prev,
          descripcion: itemData.descripcion || '',
          montoBs: itemData.montoBs || '',
          montoUSD: itemData.montoUSD || ''
        }));
      }
    }
  }, [nuevoMov.item, modalOpen, inventario]);

  function formatFecha(fecha) {
    if (!fecha) return '';
    let d;
    if (fecha instanceof Date) {
      d = fecha;
    } else if (typeof fecha === 'string' || typeof fecha === 'number') {
      d = new Date(fecha);
    } else if (fecha && fecha.seconds) {
      d = new Date(fecha.seconds * 1000);
    } else {
      return '';
    }
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function handleAgregarMovimiento() {
    // Aquí podrías guardar el movimiento en Firestore
    setModalOpen(false);
    setNuevoMov({ item: '', descripcion: '', movimiento: 'entrada', cantidad: '', montoBs: '', montoUSD: '' });
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" color="primary" startIcon={"+"} size="small" onClick={() => setModalOpen(true)}>
          Agregar movimiento
        </Button>
      </Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Fecha</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Item</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Descripción</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Movimiento</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {movimientos && movimientos.length > 0 ? movimientos.map((m, idx) => (
            <tr key={idx}>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>{formatFecha(m.fecha)}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>{m.itemId || m.item || m.id}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>{m.descripcion}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textTransform: 'capitalize' }}>{m.movimiento}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>{m.cantidad}</td>
            </tr>
          )) : (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#888' }}>No hay movimientos registrados</td></tr>
          )}
        </tbody>
      </table>
      {/* Modal para agregar movimiento */}
      {modalOpen && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.15)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2, minWidth: 320, boxShadow: 3, fontFamily: 'Poppins, sans-serif' }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>Agregar movimiento</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <select value={nuevoMov.item} onChange={e => setNuevoMov({ ...nuevoMov, item: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona un item</option>
                {inventario && inventario.length > 0 && inventario.map(item => (
                  <option key={item.id} value={item.id}>{item.id} - {item.descripcion}</option>
                ))}
              </select>
              <input type="text" placeholder="Descripción" value={nuevoMov.descripcion} onChange={e => setNuevoMov({ ...nuevoMov, descripcion: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif', marginBottom: 8 }} />
              {/* Se eliminan los campos de montos */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <select value={nuevoMov.movimiento} onChange={e => setNuevoMov({ ...nuevoMov, movimiento: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
                <input type="number" placeholder="Cantidad" value={nuevoMov.cantidad} onChange={e => setNuevoMov({ ...nuevoMov, cantidad: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button onClick={() => setModalOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif' }}>Cancelar</Button>
              <Button onClick={handleAgregarMovimiento} variant="contained" color="success" size="small" sx={{ fontFamily: 'Poppins, sans-serif' }}>Agregar</Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
