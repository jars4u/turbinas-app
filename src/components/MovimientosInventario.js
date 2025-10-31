
import React from "react";
import { Box, Button, Typography, IconButton, Divider, Chip } from "@mui/material";

// Recibe usuarioActivo como prop

export default function MovimientosInventario({ movimientos, inventario, usuarioActivo }) {
  const [depositos, setDepositos] = React.useState([]);
  React.useEffect(() => {
    let unsubscribe;
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, onSnapshot }) => {
        unsubscribe = onSnapshot(collection(db, 'depositos'), (snapshot) => {
          setDepositos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);
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

  // Normalizadores para datos heterogéneos
  const renderUsuario = (u) => {
    if (!u) return '-';
    if (typeof u === 'string') {
      return u.includes('@') ? u.split('@')[0] : u;
    }
    if (typeof u === 'object') {
      return u.email || u.nombre || u.name || '-';
    }
    return '-';
  };

  const renderMovimiento = (m) => (m?.tipo || m?.movimiento || '-');

  const renderDescripcion = (m) => (m?.observaciones || m?.descripcion || '-');

  const renderDeposito = (m) => {
    if (m?.deposito) return m.deposito;
    if (m?.depositoId) {
      const dep = depositos.find(d => d.id === m.depositoId || d.depositoId === m.depositoId);
      return dep ? dep.nombre : m.depositoId;
    }
    return '-';
  };

  async function handleAgregarMovimiento() {
    // Guardar el movimiento en Firestore con todos los campos
    const { db } = await import("../firebase");
    const { addDoc, collection } = await import("firebase/firestore");
    let usuarioNombre = typeof usuarioActivo === 'string' && usuarioActivo.includes('@')
      ? usuarioActivo.split('@')[0]
      : (usuarioActivo || '-');
    await addDoc(collection(db, "movimientos"), {
      itemId: nuevoMov.item,
      descripcion: nuevoMov.descripcion,
      movimiento: nuevoMov.movimiento,
      cantidad: Number(nuevoMov.cantidad) || 0,
      deposito: nuevoMov.deposito || '',
      usuario: usuarioNombre,
      fecha: new Date(),
    });
    setModalOpen(false);
    setNuevoMov({ item: '', descripcion: '', movimiento: 'entrada', cantidad: '', deposito: '', montoBs: '', montoUSD: '' });
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Acciones: botón crear movimiento (xs full-width, sm+ a la derecha) */}
      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button variant="outlined" color="success" size="small" onClick={() => setModalOpen(true)} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          + Crear movimiento
        </Button>
      </Box>

      {/* Lista tipo cards en móviles */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        {movimientos && movimientos.length > 0 ? movimientos.map((m, idx) => {
          const isSalida = (m.tipo === 'salida' || m.movimiento === 'salida');
          const item = inventario.find(i => i.id === m.itemId || i.id === m.item);
          const titulo = item ? `${item.modelo ? item.modelo : ''}${item.descripcion ? ' - ' + item.descripcion : ''}` : (m.itemId || m.item || m.id || 'Ítem');
          return (
            <Box key={idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, mb: 1, boxShadow: 1, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ pr: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</Typography>
                <Chip label={renderMovimiento(m)} size="small" color={isSalida ? 'error' : 'success'} sx={{ height: 22 }} />
              </Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{renderDescripcion(m)}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">{formatFecha(m.fecha)}</Typography>
                  <Typography variant="caption" color="text.secondary">Depósito: {renderDeposito(m)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{m.cantidad} u</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{renderUsuario(m.usuario)}</Typography>
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No hay movimientos registrados</Typography>
        )}
      </Box>

      {/* Tabla en desktop/tablet */}
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f5f5', height: 32 }}>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Fecha</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Item</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Descripción</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Movimiento</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Cantidad</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Depósito</th>
            <th style={{ padding: '8px', border: '1px solid #e0e0e0' }}>Usuario</th>
          </tr>
        </thead>
        <tbody>
          {movimientos && movimientos.length > 0 ? movimientos.map((m, idx) => (
            <tr key={idx} style={{ background: (m.tipo === 'salida' || m.movimiento === 'salida') ? '#ffeaea' : undefined }}>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>{formatFecha(m.fecha)}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>
                {(() => {
                  const item = inventario.find(i => i.id === m.itemId || i.id === m.item);
                  if (item) {
                    return `${item.modelo ? item.modelo : ''}${item.descripcion ? ' - ' + item.descripcion : ''}`;
                  }
                  return m.itemId || m.item || m.id;
                })()}
              </td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0' }}>{renderDescripcion(m)}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textTransform: 'capitalize' }}>{renderMovimiento(m)}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>{m.cantidad}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>{renderDeposito(m)}</td>
              <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>{renderUsuario(m.usuario)}</td>
            </tr>
          )) : (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#888' }}>No hay movimientos registrados</td></tr>
          )}
        </tbody>
        </table>
      </Box>
      {/* Modal para registrar movimiento */}
      {modalOpen && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', zIndex: 1300, display: 'flex', alignItems: { xs: 'flex-end', sm: 'center' }, justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 2, pt: 1.5, borderRadius: { xs: '12px 12px 0 0', sm: 2 }, width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 320 }, maxWidth: 520, boxShadow: 4, fontFamily: 'Poppins, sans-serif', maxHeight: '85vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>Registrar movimiento</Typography>
              <IconButton size="small" onClick={() => setModalOpen(false)} aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4Z"/></svg>
              </IconButton>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <select value={nuevoMov.item} onChange={e => setNuevoMov({ ...nuevoMov, item: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona ítem...</option>
                {inventario && inventario.length > 0 && inventario.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.modelo ? item.modelo : ''}
                    {item.descripcion ? ' - ' + item.descripcion : ''}
                  </option>
                ))}
              </select>
              <select value={nuevoMov.deposito || ''} onChange={e => setNuevoMov({ ...nuevoMov, deposito: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona depósito...</option>
                {depositos && depositos.length > 0 && depositos.map(dep => (
                  <option key={dep.id} value={dep.nombre}>{dep.nombre}</option>
                ))}
              </select>
              <input type="text" placeholder="Descripción" value={nuevoMov.descripcion} onChange={e => setNuevoMov({ ...nuevoMov, descripcion: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <select value={nuevoMov.movimiento} onChange={e => setNuevoMov({ ...nuevoMov, movimiento: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
                <input type="number" placeholder="Cantidad" value={nuevoMov.cantidad} onChange={e => setNuevoMov({ ...nuevoMov, cantidad: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2, mt: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button onClick={() => setModalOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Cancelar</Button>
              <Button onClick={handleAgregarMovimiento} variant="contained" color="success" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Agregar</Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
