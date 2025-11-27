import React, { useState, useEffect } from "react";
import { Skeleton } from "@mui/material";
import PaymentModal from "./PaymentModal";
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, TextField, Button, Accordion, AccordionSummary, AccordionDetails, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, ToggleButton, ToggleButtonGroup } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaidIcon from '@mui/icons-material/Paid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function CuentasPorCobrar() {
  const [modalidad, setModalidad] = useState('documento');
  const [form, setForm] = useState({
  documento: '',
  cliente: '',
  concepto: '',
  montoUSD: '',
  montoBs: ''
  });
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ documento: '', cliente: '', concepto: '', montoUSD: '', montoBs: '', vencimiento: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmCobroId, setConfirmCobroId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cuentaServicio, setCuentaServicio] = useState(null);
  const [editingMobile, setEditingMobile] = useState(false);

  // Eliminar cuenta por cobrar
  const handleDelete = async (id) => {
  const { db } = await import('../firebase');
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'cuentasPorCobrar', id));
  setConfirmDeleteId(null);
  };

  // Iniciar edición
  const handleEditInit = (cuenta) => {
    setEditId(cuenta.id);
    setEditForm({
      documento: cuenta.documento || '',
      cliente: cuenta.cliente || '',
      concepto: cuenta.concepto || '',
      montoUSD: cuenta.montoUSD || '',
      montoBs: cuenta.montoBs || '',
      vehiculo: cuenta.vehiculo || '',
      servicio: cuenta.servicio || '',
      precio: cuenta.precio || '',
      precioBs: cuenta.precioBs || '',
      observaciones: cuenta.observaciones || ''
    });
  };

  // Guardar edición
  const handleEditSave = async (id) => {
    const { db } = await import('../firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'cuentasPorCobrar', id), {
      documento: editForm.documento || '',
      cliente: editForm.cliente || '',
      concepto: editForm.concepto || '',
      montoUSD: parseFloat(editForm.montoUSD) || 0,
      montoBs: parseFloat(editForm.montoBs) || 0,
      vehiculo: editForm.vehiculo || '',
      servicio: editForm.servicio || '',
      precio: parseFloat(editForm.precio) || 0,
      precioBs: parseFloat(editForm.precioBs) || 0,
      observaciones: editForm.observaciones || ''
    });
    setEditId(null);
    setEditForm({ documento: '', cliente: '', concepto: '', montoUSD: '', montoBs: '', vehiculo: '', servicio: '', precio: '', precioBs: '', observaciones: '' });
  };

  // Cancelar edición
  const handleEditCancel = () => {
  setEditId(null);
  setEditForm({ documento: '', cliente: '', concepto: '', montoUSD: '', montoBs: '', vehiculo: '', servicio: '', precio: '', precioBs: '', observaciones: '' });
  };

  useEffect(() => {
    let unsubscribe;
    setLoading(true);
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, onSnapshot }) => {
        unsubscribe = onSnapshot(collection(db, 'cuentasPorCobrar'), (snapshot) => {
          setCuentas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Normalizador de timestamps a milisegundos (soporta number, Date, Firestore Timestamp-like, ISO y 'YYYY-MM-DD')
  const toMillis = (v) => {
    if (!v && v !== 0) return null;
    if (v && typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      if (v.includes('T')) { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const t = Date.parse(v + 'T00:00:00'); return Number.isNaN(t) ? null : t; }
      // dd/mm/yyyy
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const [d,m,y] = v.split('/');
        const t = Date.parse(`${y}-${m}-${d}T00:00:00`);
        return Number.isNaN(t) ? null : t;
      }
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { db } = await import('../firebase');
    const { addDoc, collection } = await import('firebase/firestore');
    let nuevaCuenta;
    if (modalidad === 'documento') {
      nuevaCuenta = {
        modalidad: 'documento',
        documento: form.documento || '',
        cliente: form.cliente || '',
        concepto: form.concepto || '',
        montoUSD: parseFloat(form.montoUSD) || 0,
        montoBs: parseFloat(form.montoBs) || 0,
        fechaRegistro: Date.now()
      };
    } else {
      nuevaCuenta = {
        modalidad: 'servicio',
        vehiculo: form.vehiculo || '',
        servicio: form.servicio || '',
        precio: parseFloat(form.precio) || 0,
        precioBs: parseFloat(form.precioBs) || 0,
        observaciones: form.observaciones || '',
        fechaRegistro: Date.now()
      };
    }
    await addDoc(collection(db, 'cuentasPorCobrar'), nuevaCuenta);
    setForm({ documento: '', cliente: '', concepto: '', montoUSD: '', montoBs: '', vehiculo: '', servicio: '', precio: '', precioBs: '', observaciones: '' });
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Cuentas por Cobrar
      </Typography>
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>+ Agregar cuenta por cobrar</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ToggleButtonGroup
            value={modalidad}
            exclusive
            onChange={(e, value) => value && setModalidad(value)}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="documento">Documento</ToggleButton>
            <ToggleButton value="servicio">Servicio</ToggleButton>
          </ToggleButtonGroup>
          {modalidad === 'documento' ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
                <TextField fullWidth label="Documento" name="documento" value={form.documento} onChange={handleChange} size="small" />
                <TextField fullWidth label="Cliente" name="cliente" value={form.cliente} onChange={handleChange} size="small" />
                <TextField fullWidth label="Concepto" name="concepto" value={form.concepto} onChange={handleChange} size="small" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
                <TextField fullWidth label="Monto $" name="montoUSD" value={form.montoUSD} onChange={handleChange} size="small" type="number" />
                <TextField fullWidth label="Monto Bs" name="montoBs" value={form.montoBs} onChange={handleChange} size="small" type="number" />
                <TextField fullWidth label="Vencimiento" name="vencimiento" value={form.vencimiento} onChange={handleChange} size="small" type="date" InputLabelProps={{ shrink: true }} />
                <Button type="submit" variant="contained" color="primary" sx={{ height: 40, width: { xs: '100%', md: 'auto' } }}>Agregar</Button>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
                <TextField fullWidth label="Modelo" name="vehiculo" value={form.vehiculo || ''} onChange={handleChange} size="small" />
                <TextField fullWidth label="Servicio" name="servicio" value={form.servicio || ''} onChange={handleChange} size="small" />
                <TextField fullWidth label="Precio $" name="precio" value={form.precio || ''} onChange={handleChange} size="small" type="number" />
                <TextField fullWidth label="Precio Bs" name="precioBs" value={form.precioBs || ''} onChange={handleChange} size="small" type="number" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
                <TextField fullWidth label="Observaciones" name="observaciones" value={form.observaciones || ''} onChange={handleChange} size="small" />
                <Button type="submit" variant="contained" color="primary" sx={{ height: 40, width: { xs: '100%', md: 'auto' } }}>Agregar</Button>
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
      {/* Tabla escritorio */}
      <Table component={Paper} size="small" sx={{ mb: 2, display: { xs: 'none', md: 'table' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Tipo</TableCell>
            <TableCell>Doc/Model</TableCell>
            <TableCell>Cliente/Serv</TableCell>
            <TableCell>Concept/Obs</TableCell>
            <TableCell align="right">Monto $</TableCell>
            <TableCell align="right">Monto Bs</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            // Skeleton de 4 filas
            [...Array(4)].map((_, idx) => (
              <TableRow key={idx}>
                <TableCell><Skeleton variant="text" width={80} /></TableCell>
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={120} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="center"><Skeleton variant="rectangular" width={120} height={32} /></TableCell>
              </TableRow>
            ))
          ) : cuentas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center">No hay cuentas por cobrar registradas.</TableCell>
            </TableRow>
          ) : (
            [...cuentas]
              .sort((a, b) => {
                const aTs = toMillis(a.fechaRegistro) ?? toMillis(a.arrivalTime) ?? 0;
                const bTs = toMillis(b.fechaRegistro) ?? toMillis(b.arrivalTime) ?? 0;
                return bTs - aTs; // más recientes primero
              })
              .map((cuenta, idx) => (
              <TableRow key={cuenta.id || idx}>
                {editId === cuenta.id ? (
                  <>
                    <TableCell>{cuenta.modalidad === 'servicio' ? 'Servicio' : 'Documento'}</TableCell>
                    <TableCell>
                      {cuenta.modalidad === 'servicio'
                        ? <TextField name="vehiculo" value={editForm.vehiculo || ''} onChange={e => setEditForm({ ...editForm, vehiculo: e.target.value })} size="small" placeholder="Modelo" />
                        : <TextField name="documento" value={editForm.documento || ''} onChange={e => setEditForm({ ...editForm, documento: e.target.value })} size="small" placeholder="Documento" />
                      }
                    </TableCell>
                    <TableCell>
                      {cuenta.modalidad === 'servicio'
                        ? <TextField name="servicio" value={editForm.servicio || ''} onChange={e => setEditForm({ ...editForm, servicio: e.target.value })} size="small" placeholder="Servicio" />
                        : <TextField name="cliente" value={editForm.cliente || ''} onChange={e => setEditForm({ ...editForm, cliente: e.target.value })} size="small" placeholder="Cliente" />
                      }
                    </TableCell>
                    <TableCell>
                      {cuenta.modalidad === 'servicio'
                        ? <TextField name="observaciones" value={editForm.observaciones || ''} onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })} size="small" placeholder="Observaciones" />
                        : <TextField name="concepto" value={editForm.concepto || ''} onChange={e => setEditForm({ ...editForm, concepto: e.target.value })} size="small" placeholder="Concepto" />
                      }
                    </TableCell>
                    <TableCell align="right">
                      {cuenta.modalidad === 'servicio'
                        ? <TextField name="precio" value={editForm.precio || ''} onChange={e => setEditForm({ ...editForm, precio: e.target.value })} size="small" type="number" placeholder="Precio $" />
                        : <TextField name="montoUSD" value={editForm.montoUSD || ''} onChange={e => setEditForm({ ...editForm, montoUSD: e.target.value })} size="small" type="number" placeholder="Monto $" />
                      }
                    </TableCell>
                    <TableCell align="right">
                      {cuenta.modalidad === 'servicio'
                        ? <TextField name="precioBs" value={editForm.precioBs || ''} onChange={e => setEditForm({ ...editForm, precioBs: e.target.value })} size="small" type="number" placeholder="Precio Bs" />
                        : <TextField name="montoBs" value={editForm.montoBs || ''} onChange={e => setEditForm({ ...editForm, montoBs: e.target.value })} size="small" type="number" placeholder="Monto Bs" />
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Button color="success" size="small" onClick={() => handleEditSave(cuenta.id)} sx={{ mr: 1 }}>Guardar</Button>
                      <Button color="inherit" size="small" onClick={handleEditCancel}>Cancelar</Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{cuenta.modalidad === 'servicio' ? 'Servicio' : 'Documento'}</TableCell>
                    <TableCell>{cuenta.modalidad === 'servicio' ? (cuenta.vehiculo ? cuenta.vehiculo.toUpperCase() : '-') : (cuenta.documento ? cuenta.documento.toUpperCase() : '-')}</TableCell>
                    <TableCell>{cuenta.modalidad === 'servicio' ? (cuenta.servicio ? cuenta.servicio.toUpperCase() : '-') : (cuenta.cliente ? cuenta.cliente.toUpperCase() : '-')}</TableCell>
                    <TableCell>{cuenta.modalidad === 'servicio' ? (cuenta.observaciones ? cuenta.observaciones : '-') : (cuenta.concepto ? cuenta.concepto.toUpperCase() : '-')}</TableCell>
                    <TableCell align="right">{cuenta.modalidad === 'servicio' ? (typeof cuenta.precio === 'number' && cuenta.precio !== 0 ? cuenta.precio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-') : (typeof cuenta.montoUSD === 'number' && cuenta.montoUSD !== 0 ? cuenta.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}</TableCell>
                    <TableCell align="right">{cuenta.modalidad === 'servicio' ? (typeof cuenta.precioBs === 'number' && cuenta.precioBs !== 0 ? cuenta.precioBs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-') : (typeof cuenta.montoBs === 'number' && cuenta.montoBs !== 0 ? cuenta.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}</TableCell>
                    <TableCell align="center">
                      <IconButton color="primary" size="small" onClick={() => handleEditInit(cuenta)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => setConfirmDeleteId(cuenta.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <Button
                        variant="outlined"
                        color="success"
                        size="small"
                        startIcon={<PaidIcon />}
                        sx={{ ml: 1 }}
                        onClick={() => {
                          if (cuenta.modalidad === "servicio") {
                            setCuentaServicio(cuenta);
                            setPaymentModalOpen(true);
                          } else {
                            setConfirmCobroId(cuenta.id);
                          }
                        }}
                      >
                        Cobrar
                      </Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Vista móvil: tarjetas */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(3)].map((_, i) => (
              <Paper key={i} sx={{ p: 1.25, borderRadius: 2 }}>
                <Skeleton variant="text" width={120} />
                <Skeleton variant="text" width={160} />
                <Skeleton variant="text" width={80} />
              </Paper>
            ))}
          </Box>
        ) : cuentas.length === 0 ? (
          <Paper sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            No hay cuentas por cobrar registradas.
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[...cuentas]
              .sort((a, b) => {
                const aTs = toMillis(a.fechaRegistro) ?? toMillis(a.arrivalTime) ?? 0;
                const bTs = toMillis(b.fechaRegistro) ?? toMillis(b.arrivalTime) ?? 0;
                return bTs - aTs;
              })
              .map((cuenta, idx) => {
                const montoUSD = cuenta.modalidad === 'servicio'
                  ? (typeof cuenta.precio === 'number' && cuenta.precio !== 0 ? cuenta.precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')
                  : (typeof cuenta.montoUSD === 'number' && cuenta.montoUSD !== 0 ? cuenta.montoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
                const montoBs = cuenta.modalidad === 'servicio'
                  ? (typeof cuenta.precioBs === 'number' && cuenta.precioBs !== 0 ? cuenta.precioBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')
                  : (typeof cuenta.montoBs === 'number' && cuenta.montoBs !== 0 ? cuenta.montoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
                return (
                  <Box key={cuenta.id || idx} sx={{ p: 1.25, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {cuenta.modalidad === 'servicio'
                          ? (cuenta.vehiculo ? cuenta.vehiculo.toUpperCase() : '-')
                          : (cuenta.documento ? cuenta.documento.toUpperCase() : '-')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cuenta.modalidad === 'servicio' ? 'Servicio' : 'Doc'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {cuenta.modalidad === 'servicio'
                        ? (cuenta.servicio ? cuenta.servicio.toUpperCase() : '-')
                        : (cuenta.cliente ? cuenta.cliente.toUpperCase() : '-')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      {cuenta.modalidad === 'servicio'
                        ? (cuenta.observaciones ? cuenta.observaciones : '-')
                        : (cuenta.concepto ? cuenta.concepto.toUpperCase() : '-')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">$:</Typography>
                        <Typography variant="caption">{montoUSD}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Bs:</Typography>
                        <Typography variant="caption">{montoBs}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <IconButton color="primary" size="small" onClick={() => { handleEditInit(cuenta); setEditingMobile(true); }} aria-label="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => setConfirmDeleteId(cuenta.id)} aria-label="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <Button
                        variant="outlined"
                        color="success"
                        size="small"
                        startIcon={<PaidIcon />}
                        onClick={() => {
                          if (cuenta.modalidad === 'servicio') {
                            setCuentaServicio(cuenta);
                            setPaymentModalOpen(true);
                          } else {
                            setConfirmCobroId(cuenta.id);
                          }
                        }}
                      >
                        Cobrar
                      </Button>
                    </Box>
                  </Box>
                );
              })}
          </Box>
        )}
      </Box>
      {/* Diálogo de edición móvil */}
      <Dialog open={editingMobile && !!editId} onClose={() => { setEditingMobile(false); handleEditCancel(); }} fullWidth maxWidth="sm">
        <DialogTitle>Editar cuenta por cobrar</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {editId && (() => {
            const cuenta = cuentas.find(c => c.id === editId);
            if (!cuenta) return null;
            if (cuenta.modalidad === 'servicio') {
              return (
                <>
                  <TextField label="Modelo" value={editForm.vehiculo} onChange={e => setEditForm({ ...editForm, vehiculo: e.target.value })} size="small" fullWidth />
                  <TextField label="Servicio" value={editForm.servicio} onChange={e => setEditForm({ ...editForm, servicio: e.target.value })} size="small" fullWidth />
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField label="Precio $" value={editForm.precio} onChange={e => setEditForm({ ...editForm, precio: e.target.value })} size="small" type="number" fullWidth />
                    <TextField label="Precio Bs" value={editForm.precioBs} onChange={e => setEditForm({ ...editForm, precioBs: e.target.value })} size="small" type="number" fullWidth />
                  </Box>
                  <TextField label="Observaciones" value={editForm.observaciones} onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })} size="small" fullWidth />
                </>
              );
            }
            return (
              <>
                <TextField label="Documento" value={editForm.documento} onChange={e => setEditForm({ ...editForm, documento: e.target.value })} size="small" fullWidth />
                <TextField label="Cliente" value={editForm.cliente} onChange={e => setEditForm({ ...editForm, cliente: e.target.value })} size="small" fullWidth />
                <TextField label="Concepto" value={editForm.concepto} onChange={e => setEditForm({ ...editForm, concepto: e.target.value })} size="small" fullWidth />
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField label="Monto $" value={editForm.montoUSD} onChange={e => setEditForm({ ...editForm, montoUSD: e.target.value })} size="small" type="number" fullWidth />
                  <TextField label="Monto Bs" value={editForm.montoBs} onChange={e => setEditForm({ ...editForm, montoBs: e.target.value })} size="small" type="number" fullWidth />
                </Box>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditingMobile(false); handleEditCancel(); }}>Cancelar</Button>
          <Button onClick={() => { handleEditSave(editId); setEditingMobile(false); }} variant="contained" color="success">Guardar</Button>
        </DialogActions>
      </Dialog>
      {/* Modal de confirmación de cobro para documento */}
      <Dialog open={!!confirmCobroId} onClose={() => setConfirmCobroId(null)}>
        <DialogTitle>¿Confirmar cobro de cuenta?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción enviará la cuenta a ingresos y la eliminará de la lista de cuentas por cobrar. ¿Deseas continuar?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCobroId(null)} color="primary">Cancelar</Button>
          <Button
            onClick={async () => {
              const cuenta = cuentas.find(c => c.id === confirmCobroId);
              if (!cuenta) return;
              const { db } = await import('../firebase');
              const { addDoc, collection, doc, deleteDoc } = await import('firebase/firestore');
              // Trasladar a ingresos manuales
              const hoy = new Date();
              const d = String(hoy.getDate()).padStart(2, '0');
              const m = String(hoy.getMonth() + 1).padStart(2, '0');
              const y = hoy.getFullYear();
              await addDoc(collection(db, 'ingresosMovimientos'), {
                tipo: 'manual',
                descripcion: `${cuenta.documento?.toUpperCase() || ''} - ${cuenta.cliente?.toUpperCase() || ''}`,
                montoUSD: cuenta.montoUSD || cuenta.precio || 0,
                montoBs: cuenta.montoBs || cuenta.precioBs || 0,
                concepto: cuenta.concepto?.toUpperCase() || '',
                fecha: `${d}/${m}/${y}`
              });
              await deleteDoc(doc(db, 'cuentasPorCobrar', cuenta.id));
              setConfirmCobroId(null);
              setSnackbarMsg('Cobro realizado exitosamente');
              setSnackbarOpen(true);
            }}
            color="success"
            variant="contained"
          >
            Cobrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de facturación para servicios */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setCuentaServicio(null);
        }}
        form={cuentaServicio || {}}
        onRegister={async (facturaData) => {
          if (!cuentaServicio) return;
          const { db } = await import('../firebase');
          const { addDoc, collection, doc, deleteDoc } = await import('firebase/firestore');
          // Registrar ingreso como servicio, incluyendo datos de factura y formas de pago
          const hoy = new Date();
          const d = String(hoy.getDate()).padStart(2, '0');
          const m = String(hoy.getMonth() + 1).padStart(2, '0');
          const y = hoy.getFullYear();
          await addDoc(collection(db, 'ingresosMovimientos'), {
            tipo: 'servicio',
            vehiculo: cuentaServicio.vehiculo?.toUpperCase() || '',
            servicio: cuentaServicio.servicio?.toUpperCase() || '',
            precio: cuentaServicio.precio || 0,
            precioBs: cuentaServicio.precioBs || 0,
            observaciones: cuentaServicio.observaciones || '',
            fecha: `${d}/${m}/${y}`,
            factura: facturaData.numeroFactura || '',
            formasPago: facturaData.formasPago || [],
            salidaInventario: facturaData.formasPago?.some(fp => fp.salidaInventario) || false
          });
          await deleteDoc(doc(db, 'cuentasPorCobrar', cuentaServicio.id));
          setPaymentModalOpen(false);
          setCuentaServicio(null);
          setSnackbarMsg('Cobro de servicio registrado exitosamente');
          setSnackbarOpen(true);
        }}
      />
      {/* Modal de confirmación de eliminación */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>¿Eliminar cuenta por cobrar?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción no se puede deshacer. ¿Deseas continuar?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} color="primary">Cancelar</Button>
          <Button onClick={() => handleDelete(confirmDeleteId)} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
