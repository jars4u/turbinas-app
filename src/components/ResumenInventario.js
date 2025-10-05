import React from "react";
import { Box, Button, Typography } from "@mui/material";

export default function ResumenInventario({ inventario, onAgregarItem, modalOpen, setModalOpen, nuevoItem, setNuevoItem, generarId, handleAgregarItem }) {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" color="primary" size="small" onClick={() => setModalOpen(true)}>
          + Agregar item
        </Button>
      </Box>
      <Box sx={{ mt: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>ID</th>
              <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Descripción</th>
              <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {inventario.map(item => (
              <tr key={item.id}>
                <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>{item.id}</td>
                <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>{item.descripcion}</td>
                <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>{item.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Se elimina el total de montos */}
      </Box>
      {/* Modal para agregar item */}
      {modalOpen && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.15)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2, minWidth: 320, boxShadow: 3, fontFamily: 'Poppins, sans-serif' }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>Agregar item</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input type="text" value={generarId()} disabled style={{ padding: 8, fontSize: 15, background: '#eee', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <input type="text" placeholder="Descripción" value={nuevoItem.descripcion} onChange={e => setNuevoItem({ ...nuevoItem, descripcion: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <input type="number" placeholder="Cantidad" value={nuevoItem.cantidad} onChange={e => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button onClick={() => setModalOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif' }}>Cancelar</Button>
              <Button onClick={handleAgregarItem} variant="contained" color="success" size="small" sx={{ fontFamily: 'Poppins, sans-serif' }}>Agregar</Button>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
