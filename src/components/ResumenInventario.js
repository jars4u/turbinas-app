
import React from "react";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Typography, TextField, IconButton, Divider } from "@mui/material";
import Snackbar from '@mui/material/Snackbar';

export default function ResumenInventario({ inventario, modalOpen, setModalOpen, abrirModalAgregar, nuevoItem, setNuevoItem, generarId, handleAgregarItem, onEditarItem, onEliminarItem, editandoItem, handleGuardarEdicion }) {
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMsg, setSnackbarMsg] = React.useState('');

  const [modalMovimientoOpen, setModalMovimientoOpen] = React.useState(false);
  const [nuevoMovimiento, setNuevoMovimiento] = React.useState({ itemId: '', tipo: 'entrada', cantidad: '', depositoId: '', observaciones: '' });
  // Actualizar depósito por defecto al seleccionar ítem
  React.useEffect(() => {
    if (!modalMovimientoOpen || !nuevoMovimiento.itemId) return;
    const item = inventario.find(i => i.id === nuevoMovimiento.itemId);
    if (item && item.depositoId) {
      setNuevoMovimiento(mov => ({ ...mov, depositoId: item.depositoId }));
    }
  }, [nuevoMovimiento.itemId, modalMovimientoOpen, inventario]);

  async function handleRegistrarMovimiento() {
    if (!nuevoMovimiento.itemId || !nuevoMovimiento.cantidad) return;
    const { db } = await import('../firebase');
    const { addDoc, collection, doc, getDoc, updateDoc } = await import('firebase/firestore');
    // Registrar movimiento en la colección movimientos (guardar todos los campos)
    let usuarioActivo = window.usuarioActivo || '';
    let usuarioNombre = usuarioActivo ? usuarioActivo.split('@')[0] : '';
    await addDoc(collection(db, 'movimientos'), {
      itemId: nuevoMovimiento.itemId,
      tipo: nuevoMovimiento.tipo,
      cantidad: Number(nuevoMovimiento.cantidad),
      depositoId: nuevoMovimiento.depositoId,
      observaciones: nuevoMovimiento.observaciones,
      usuario: usuarioNombre,
      fecha: new Date(),
    });
    // Actualizar cantidad en inventario
    const itemRef = doc(db, 'inventario', nuevoMovimiento.itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const itemData = itemSnap.data();
      let cantidadActual = Number(itemData.cantidad) || 0;
      let cantidadMov = Number(nuevoMovimiento.cantidad) || 0;
      let nuevaCantidad = cantidadActual;
      if (nuevoMovimiento.tipo === 'entrada') {
        nuevaCantidad = cantidadActual + cantidadMov;
      } else if (nuevoMovimiento.tipo === 'salida') {
        nuevaCantidad = cantidadActual - cantidadMov;
        if (nuevaCantidad < 0) nuevaCantidad = 0;
      }
      await updateDoc(itemRef, { cantidad: nuevaCantidad });
    }
    setModalMovimientoOpen(false);
    setNuevoMovimiento({ itemId: '', tipo: 'entrada', cantidad: '', depositoId: '', observaciones: '' });
    setSnackbarMsg('Movimiento registrado y stock actualizado');
    setSnackbarOpen(true);
  }
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
  const [modalDepositoOpen, setModalDepositoOpen] = React.useState(false);
  const [nuevoDeposito, setNuevoDeposito] = React.useState({ nombre: '' });

  async function handleCrearDeposito() {
    if (!nuevoDeposito.nombre.trim()) return;
    const { db } = await import('../firebase');
    const { addDoc, collection } = await import('firebase/firestore');
    // Generar un UUID simple para depositoId
    const depositoId = 'dep_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    await addDoc(collection(db, 'depositos'), { nombre: nuevoDeposito.nombre.trim(), depositoId });
    setModalDepositoOpen(false);
    setNuevoDeposito({ nombre: '' });
    alert(`Depósito creado correctamente con depositoId: ${depositoId}`);
  }
  const [ordenColumna, setOrdenColumna] = React.useState("modelo");
  const [ordenAsc, setOrdenAsc] = React.useState(true);

  function handleOrdenar(col) {
    if (ordenColumna === col) {
      setOrdenAsc(!ordenAsc);
    } else {
      setOrdenColumna(col);
      setOrdenAsc(true);
    }
  }
  const [busqueda, setBusqueda] = React.useState("");
  const inventarioFiltrado = inventario
    .filter(item => {
      const texto = `${item.codigo} ${item.modelo} ${item.descripcion}`.toLowerCase();
      return texto.includes(busqueda.toLowerCase());
    })
    .sort((a, b) => {
      let valA = a[ordenColumna] || "";
      let valB = b[ordenColumna] || "";
      if (typeof valA === "number" && typeof valB === "number") {
        return ordenAsc ? valA - valB : valB - valA;
      }
      return ordenAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false, id: null });

  return (
    <>
      {/* Barra superior: búsqueda y acciones. Mantener desktop igual, mobile optimizado */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: { xs: 'flex-start', sm: 'space-between' }, mb: 2, gap: 1.5 }}>
        {/* Búsqueda: desktop conserva input actual; mobile usa TextField full-width */}
        <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <input
              type="text"
              placeholder="Buscar por código, modelo o descripción..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', minWidth: 340, fontFamily: 'Poppins, sans-serif' }}
            />
          </Box>
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <TextField
              fullWidth
              size="small"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, modelo o descripción..."
              InputProps={{ sx: { fontFamily: 'Poppins, sans-serif' } }}
            />
          </Box>
        </Box>

        {/* Acciones: desktop igual; mobile en fila separada full-width */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
          <Button variant="outlined" color="success" size="small" onClick={() => setModalMovimientoOpen(true)}>
            + Crear movimiento
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={() => setModalDepositoOpen(true)}>
            Crear depósito
          </Button>
          <Button variant="outlined" color="primary" size="small" onClick={abrirModalAgregar}>
            + Agregar item
          </Button>
        </Box>
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, width: '100%', flexWrap: 'wrap' }}>
          <Button variant="outlined" color="success" size="small" onClick={() => setModalMovimientoOpen(true)} sx={{ flex: '1 1 140px' }}>
            + Movimiento
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={() => setModalDepositoOpen(true)} sx={{ flex: '1 1 140px' }}>
            Depósito
          </Button>
          <Button variant="outlined" color="primary" size="small" onClick={abrirModalAgregar} sx={{ flex: '1 1 140px' }}>
            + Ítem
          </Button>
        </Box>
      </Box>

      {/* Modal para registrar movimiento */}
      {modalMovimientoOpen && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', zIndex: 1300, display: 'flex', alignItems: { xs: 'flex-end', sm: 'center' }, justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 2, pt: 1.5, borderRadius: { xs: '12px 12px 0 0', sm: 2 }, width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 320 }, maxWidth: 480, boxShadow: 4, fontFamily: 'Poppins, sans-serif', maxHeight: '90vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>Registrar movimiento</Typography>
              <IconButton size="small" onClick={() => setModalMovimientoOpen(false)} aria-label="Cerrar">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <select value={nuevoMovimiento.itemId} onChange={e => setNuevoMovimiento({ ...nuevoMovimiento, itemId: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona ítem...</option>
                {inventario
                  .slice()
                  .sort((a, b) => (a.modelo || '').localeCompare(b.modelo || ''))
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.modelo ? item.modelo : ''}
                      {item.descripcion ? ' - ' + item.descripcion : ''}
                    </option>
                  ))}
              </select>
              <select value={nuevoMovimiento.depositoId || (inventario.find(i => i.id === nuevoMovimiento.itemId)?.depositoId || '')} onChange={e => setNuevoMovimiento({ ...nuevoMovimiento, depositoId: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona depósito...</option>
                {depositos.map(dep => (
                  <option key={dep.id} value={dep.id}>{dep.nombre}</option>
                ))}
              </select>
              <input type="text" placeholder="Observaciones" value={nuevoMovimiento.observaciones} onChange={e => setNuevoMovimiento({ ...nuevoMovimiento, observaciones: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <select value={nuevoMovimiento.tipo} onChange={e => setNuevoMovimiento({ ...nuevoMovimiento, tipo: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
                <input type="number" placeholder="Cantidad" value={nuevoMovimiento.cantidad} onChange={e => setNuevoMovimiento({ ...nuevoMovimiento, cantidad: e.target.value })} style={{ flex: 1, padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2, mt: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button onClick={() => setModalMovimientoOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Cancelar</Button>
              <Button onClick={handleRegistrarMovimiento} variant="contained" color="success" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Registrar</Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Modal para crear depósito */}
      {modalDepositoOpen && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', zIndex: 1300, display: 'flex', alignItems: { xs: 'flex-end', sm: 'center' }, justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 2, pt: 1.5, borderRadius: { xs: '12px 12px 0 0', sm: 2 }, width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 320 }, maxWidth: 420, boxShadow: 4, fontFamily: 'Poppins, sans-serif', maxHeight: '80vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>Crear depósito</Typography>
              <IconButton size="small" onClick={() => setModalDepositoOpen(false)} aria-label="Cerrar">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input type="text" placeholder="Nombre del depósito" value={nuevoDeposito.nombre} onChange={e => setNuevoDeposito({ nombre: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2, mt: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button onClick={() => setModalDepositoOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Cancelar</Button>
              <Button onClick={handleCrearDeposito} variant="contained" color="secondary" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Crear</Button>
            </Box>
          </Box>
        </Box>
      )}
      {/* Lista móvil en cards */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 1 }}>
        {inventarioFiltrado.map(item => (
          <Box key={item.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, mb: 1, boxShadow: 1, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{item.codigo || ''}</Typography>
              <Typography variant="caption" color="text.secondary">{item.cantidad} u</Typography>
            </Box>
            {(item.modelo || item.descripcion) && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {(item.modelo || '') + (item.descripcion ? ' - ' + item.descripcion : '')}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Depósito: {(() => {
                if (item.depositoId) {
                  const dep = depositos.find(d => d.depositoId === item.depositoId);
                  return dep ? dep.nombre : (item.depositoId || '');
                }
                return item.deposito || '';
              })()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" color="primary" size="small" sx={{ flex: 1, minWidth: 0 }} onClick={() => onEditarItem(item)}>
                Editar
              </Button>
              <Button variant="outlined" color="error" size="small" sx={{ flex: 1, minWidth: 0 }} onClick={() => setConfirmDelete({ open: true, id: item.id })}>
                Eliminar
              </Button>
            </Box>
            {/* Confirmación eliminar (móvil bottom sheet) */}
            {confirmDelete.open && confirmDelete.id === item.id && (
              <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', zIndex: 1400, display: 'flex', alignItems: { xs: 'flex-end', sm: 'center' }, justifyContent: 'center' }}>
                <Box sx={{ bgcolor: 'background.paper', p: 2, pt: 1.5, borderRadius: { xs: '12px 12px 0 0', sm: 2 }, width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 320 }, maxWidth: 420, boxShadow: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" fontWeight={700}>¿Eliminar este ítem?</Typography>
                    <IconButton size="small" onClick={() => setConfirmDelete({ open: false, id: null })}><CloseIcon fontSize="small" /></IconButton>
                  </Box>
                  <Typography sx={{ mb: 2 }}>Esta acción no se puede deshacer.</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Button onClick={() => setConfirmDelete({ open: false, id: null })} variant="outlined" color="primary" size="small" sx={{ width: { xs: '100%', sm: 'auto' } }}>Cancelar</Button>
                    <Button onClick={() => { onEliminarItem(confirmDelete.id); setConfirmDelete({ open: false, id: null }); }} variant="contained" color="error" size="small" sx={{ width: { xs: '100%', sm: 'auto' } }}>Eliminar</Button>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Tabla desktop/tablet */}
      <Box sx={{ mt: 2, display: { xs: 'none', sm: 'block' } }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', height: 32 }}>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => handleOrdenar('codigo')}>
                Código {ordenColumna === 'codigo' ? (ordenAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => handleOrdenar('modelo')}>
                Modelo {ordenColumna === 'modelo' ? (ordenAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => handleOrdenar('descripcion')}>
                Descripción {ordenColumna === 'descripcion' ? (ordenAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => handleOrdenar('deposito')}>
                Depósito {ordenColumna === 'deposito' ? (ordenAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => handleOrdenar('cantidad')}>
                Cantidad {ordenColumna === 'cantidad' ? (ordenAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px', border: '1px solid #e0e0e0', width: 90, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inventarioFiltrado.map(item => (
              <tr key={item.id} style={{ height: 28 }}>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', fontSize: 12 }}>{item.codigo || ''}</td>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', fontSize: 12 }}>{item.modelo || ''}</td>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', fontSize: 12 }}>{item.descripcion}</td>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', fontSize: 12 }}>
                  {/* Mostrar el nombre del depósito asociado al depositoId */}
                  {(() => {
                    if (item.depositoId) {
                      const dep = depositos.find(d => d.depositoId === item.depositoId);
                      return dep ? dep.nombre : item.depositoId;
                    }
                    return item.deposito || '';
                  })()}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', textAlign: 'center', fontSize: 12 }}>{item.cantidad}</td>
                <td style={{ padding: '4px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                  <Button variant="text" color="primary" size="small" sx={{ minWidth: 32, p: 0, mr: 1 }} onClick={() => onEditarItem(item)}>
                    <EditIcon fontSize="small" />
                  </Button>
                  <Button variant="text" color="error" size="small" sx={{ minWidth: 32, p: 0 }} onClick={() => setConfirmDelete({ open: true, id: item.id })}>
                    <DeleteIcon fontSize="small" />
                  </Button>
                  {/* Modal de confirmación de eliminación */}
                  {confirmDelete.open && confirmDelete.id === item.id && (
                    <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.18)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2, minWidth: 320, boxShadow: 4, fontFamily: 'Poppins, sans-serif' }}>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>¿Eliminar este ítem?</Typography>
                        <Typography sx={{ mb: 2 }}>Esta acción no se puede deshacer.</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <Button onClick={() => setConfirmDelete({ open: false, id: null })} variant="outlined" color="primary" size="small">Cancelar</Button>
                          <Button onClick={() => { onEliminarItem(confirmDelete.id); setConfirmDelete({ open: false, id: null }); }} variant="contained" color="error" size="small">Eliminar</Button>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      {/* Modal para agregar/editar item (único) */}
      {modalOpen && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', zIndex: 1300, display: 'flex', alignItems: { xs: 'flex-end', sm: 'center' }, justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'background.paper', p: 2, pt: 1.5, borderRadius: { xs: '12px 12px 0 0', sm: 2 }, width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 320 }, maxWidth: 480, boxShadow: 4, fontFamily: 'Poppins, sans-serif', maxHeight: '85vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>{editandoItem ? 'Editar item' : 'Agregar item'}</Typography>
              <IconButton size="small" onClick={() => setModalOpen(false)} aria-label="Cerrar"><CloseIcon fontSize="small" /></IconButton>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input type="text" value={editandoItem ? editandoItem.codigo : generarId()} disabled style={{ padding: 8, fontSize: 15, background: '#eee', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <input type="text" placeholder="Modelo" value={nuevoItem.modelo || ''} onChange={e => setNuevoItem({ ...nuevoItem, modelo: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <input type="text" placeholder="Descripción" value={nuevoItem.descripcion} onChange={e => setNuevoItem({ ...nuevoItem, descripcion: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
              <select value={nuevoItem.deposito || ''} onChange={e => setNuevoItem({ ...nuevoItem, deposito: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }}>
                <option value="">Selecciona depósito...</option>
                {depositos.map(dep => (
                  <option key={dep.id} value={dep.nombre}>{dep.nombre}</option>
                ))}
              </select>
              <input type="number" placeholder="Cantidad" value={nuevoItem.cantidad} onChange={e => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })} style={{ padding: 8, fontSize: 15, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'Poppins, sans-serif' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2, mt: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button onClick={() => setModalOpen(false)} variant="outlined" color="primary" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Cancelar</Button>
              {editandoItem ? (
                <Button onClick={handleGuardarEdicion} variant="contained" color="warning" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Guardar</Button>
              ) : (
                <Button onClick={handleAgregarItem} variant="contained" color="success" size="small" sx={{ fontFamily: 'Poppins, sans-serif', width: { xs: '100%', sm: 'auto' } }}>Agregar</Button>
              )}
            </Box>
          </Box>
        </Box>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
