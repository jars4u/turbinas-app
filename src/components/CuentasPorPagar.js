import React, { useState, useEffect } from "react";
import { LinearProgress } from "@mui/material";
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, TextField, Button, Accordion, AccordionSummary, AccordionDetails, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaidIcon from '@mui/icons-material/Paid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function CuentasPorPagar() {
  const [form, setForm] = useState({
    documento: '',
    proveedor: '',
    concepto: '',
    montoUSD: '',
    montoBs: '',
    vencimiento: ''
  });
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  // Firestore
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ documento: '', proveedor: '', concepto: '', montoUSD: '', montoBs: '', vencimiento: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmPayId, setConfirmPayId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [editingMobile, setEditingMobile] = useState(false);
  // Eliminar cuenta por pagar
  const handleDelete = async (id) => {
    const { db } = await import('../firebase');
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'cuentasPorPagar', id));
    setConfirmDeleteId(null);
  };

  // Iniciar edición
  const handleEditInit = (cuenta) => {
    setEditId(cuenta.id);
    setEditForm({
      documento: cuenta.documento || '',
      proveedor: cuenta.proveedor || '',
      concepto: cuenta.concepto || '',
      montoUSD: cuenta.montoUSD || '',
      montoBs: cuenta.montoBs || '',
      vencimiento: cuenta.vencimiento || ''
    });
  };

  // Guardar edición
  const handleEditSave = async (id) => {
    const { db } = await import('../firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'cuentasPorPagar', id), {
      documento: editForm.documento,
      proveedor: editForm.proveedor,
      concepto: editForm.concepto,
      montoUSD: parseFloat(editForm.montoUSD) || 0,
      montoBs: parseFloat(editForm.montoBs) || 0,
      vencimiento: editForm.vencimiento
    });
    setEditId(null);
    setEditForm({ documento: '', proveedor: '', concepto: '', montoUSD: '', montoBs: '', vencimiento: '' });
  };

  // Cancelar edición
  const handleEditCancel = () => {
    setEditId(null);
    setEditForm({ documento: '', proveedor: '', concepto: '', montoUSD: '', montoBs: '', vencimiento: '' });
  };
  useEffect(() => {
    let unsubscribe;
    setLoading(true);
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, onSnapshot }) => {
        unsubscribe = onSnapshot(collection(db, 'cuentasPorPagar'), (snapshot) => {
          setCuentas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { db } = await import('../firebase');
    const { addDoc, collection } = await import('firebase/firestore');
    await addDoc(collection(db, 'cuentasPorPagar'), {
      documento: form.documento,
      proveedor: form.proveedor,
      concepto: form.concepto,
      montoUSD: parseFloat(form.montoUSD) || 0,
      montoBs: parseFloat(form.montoBs) || 0,
      vencimiento: form.vencimiento
    });
    setForm({ documento: '', proveedor: '', concepto: '', montoUSD: '', montoBs: '', vencimiento: '' });
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Cuentas por Pagar
      </Typography>
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>+ Agregar cuenta por pagar</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
              <TextField fullWidth label="Documento" name="documento" value={form.documento} onChange={handleChange} size="small" sx={{ minWidth: 120 }} />
              <TextField fullWidth label="Proveedor" name="proveedor" value={form.proveedor} onChange={handleChange} size="small" sx={{ minWidth: 120 }} />
              <TextField fullWidth label="Concepto" name="concepto" value={form.concepto} onChange={handleChange} size="small" sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
              <TextField fullWidth label="Monto $" name="montoUSD" value={form.montoUSD} onChange={handleChange} size="small" type="number" sx={{ minWidth: 100 }} />
              <TextField fullWidth label="Monto Bs" name="montoBs" value={form.montoBs} onChange={handleChange} size="small" type="number" sx={{ minWidth: 100 }} />
              <TextField fullWidth label="Vencimiento" name="vencimiento" value={form.vencimiento} onChange={handleChange} size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }} />
              <Button type="submit" variant="contained" color="primary" sx={{ height: 40, width: { xs: '100%', md: 'auto' } }}>Agregar</Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
  {loading && <LinearProgress sx={{ mb: 1 }} />}
  {/* Vista escritorio: tabla */}
  <Table component={Paper} size="small" sx={{ mb: 2, display: { xs: 'none', md: 'table' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Documento</TableCell>
            <TableCell>Proveedor</TableCell>
            <TableCell>Concepto</TableCell>
            <TableCell align="right">Monto $</TableCell>
            <TableCell align="right">Monto Bs</TableCell>
            <TableCell>Vencimiento</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cuentas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">No hay cuentas por pagar registradas.</TableCell>
            </TableRow>
          ) : (
            cuentas.map((cuenta, idx) => (
              <TableRow key={cuenta.id || idx}>
                {editId === cuenta.id ? (
                  <>
                    <TableCell><TextField name="documento" value={editForm.documento} onChange={e => setEditForm({ ...editForm, documento: e.target.value })} size="small" /></TableCell>
                    <TableCell><TextField name="proveedor" value={editForm.proveedor} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} size="small" /></TableCell>
                    <TableCell><TextField name="concepto" value={editForm.concepto} onChange={e => setEditForm({ ...editForm, concepto: e.target.value })} size="small" /></TableCell>
                    <TableCell align="right"><TextField name="montoUSD" value={editForm.montoUSD} onChange={e => setEditForm({ ...editForm, montoUSD: e.target.value })} size="small" type="number" /></TableCell>
                    <TableCell align="right"><TextField name="montoBs" value={editForm.montoBs} onChange={e => setEditForm({ ...editForm, montoBs: e.target.value })} size="small" type="number" /></TableCell>
                    <TableCell><TextField name="vencimiento" value={editForm.vencimiento} onChange={e => setEditForm({ ...editForm, vencimiento: e.target.value })} size="small" type="date" InputLabelProps={{ shrink: true }} /></TableCell>
                    <TableCell align="center">
                      <Button color="success" size="small" onClick={() => handleEditSave(cuenta.id)} sx={{ mr: 1 }}>Guardar</Button>
                      <Button color="inherit" size="small" onClick={handleEditCancel}>Cancelar</Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{cuenta.documento ? cuenta.documento.toUpperCase() : '-'}</TableCell>
                    <TableCell>{cuenta.proveedor ? cuenta.proveedor.toUpperCase() : '-'}</TableCell>
                    <TableCell>{cuenta.concepto ? cuenta.concepto.toUpperCase() : '-'}</TableCell>
                    <TableCell align="right">{typeof cuenta.montoUSD === 'number' && cuenta.montoUSD !== 0 ? cuenta.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                    <TableCell align="right">{typeof cuenta.montoBs === 'number' && cuenta.montoBs !== 0 ? cuenta.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                    <TableCell>{cuenta.vencimiento ? cuenta.vencimiento.toUpperCase() : '-'}</TableCell>
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
                        onClick={() => setConfirmPayId(cuenta.id)}
                      >
                        Pagar
                      </Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Vista móvil: cards */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {cuentas.length === 0 ? (
          <Paper sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            No hay cuentas por pagar registradas.
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {cuentas.map((cuenta, idx) => {
              const montoUSD = (typeof cuenta.montoUSD === 'number' && cuenta.montoUSD !== 0)
                ? cuenta.montoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-';
              const montoBs = (typeof cuenta.montoBs === 'number' && cuenta.montoBs !== 0)
                ? cuenta.montoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-';
              return (
                <Box key={cuenta.id || idx} sx={{ p: 1.25, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, bgcolor: '#fff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {cuenta.proveedor ? cuenta.proveedor.toUpperCase() : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cuenta.vencimiento || '-'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {cuenta.concepto ? cuenta.concepto.toUpperCase() : '-'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {cuenta.documento && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Doc:</Typography>
                        <Typography variant="caption">{cuenta.documento.toUpperCase()}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">$:</Typography>
                      <Typography variant="caption">{montoUSD}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Bs:</Typography>
                      <Typography variant="caption">{montoBs}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.75 }}>
                    <IconButton color="primary" size="small" onClick={() => { handleEditInit(cuenta); setEditingMobile(true); }} aria-label="Editar cuenta">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => setConfirmDeleteId(cuenta.id)} aria-label="Eliminar cuenta">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      startIcon={<PaidIcon />}
                      onClick={() => setConfirmPayId(cuenta.id)}
                    >
                      Pagar
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      {/* Diálogos globales: pagar, eliminar y editar en móvil */}
      <Dialog open={!!confirmPayId} onClose={() => setConfirmPayId(null)}>
        <DialogTitle>¿Confirmar pago de cuenta?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción enviará la cuenta a egresos y la eliminará de la lista de cuentas por pagar. ¿Deseas continuar?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPayId(null)} color="primary">Cancelar</Button>
          <Button
            onClick={async () => {
              const cuenta = cuentas.find(c => c.id === confirmPayId);
              if (!cuenta) return;
              const { db } = await import('../firebase');
              const { addDoc, collection, doc, deleteDoc } = await import('firebase/firestore');
              const hoy = new Date();
              const fechaPago = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
              await addDoc(collection(db, 'egresos'), {
                descripcion: `${cuenta.proveedor?.toUpperCase() || ''} - ${cuenta.documento?.toUpperCase() || ''}`,
                montoUSD: cuenta.montoUSD,
                montoBs: cuenta.montoBs,
                fecha: fechaPago
              });
              await deleteDoc(doc(db, 'cuentasPorPagar', cuenta.id));
              setConfirmPayId(null);
              setSnackbarMsg('Pago realizado exitosamente');
              setSnackbarOpen(true);
            }}
            color="success"
            variant="contained"
          >
            Pagar
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>¿Eliminar cuenta por pagar?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción no se puede deshacer. ¿Deseas continuar?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} color="primary">Cancelar</Button>
          <Button onClick={() => handleDelete(confirmDeleteId)} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={editingMobile && !!editId} onClose={() => { setEditingMobile(false); handleEditCancel(); }} fullWidth maxWidth="sm">
        <DialogTitle>Editar cuenta por pagar</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Documento" value={editForm.documento} onChange={e => setEditForm({ ...editForm, documento: e.target.value })} size="small" fullWidth />
          <TextField label="Proveedor" value={editForm.proveedor} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} size="small" fullWidth />
          <TextField label="Concepto" value={editForm.concepto} onChange={e => setEditForm({ ...editForm, concepto: e.target.value })} size="small" fullWidth />
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField label="Monto $" value={editForm.montoUSD} onChange={e => setEditForm({ ...editForm, montoUSD: e.target.value })} size="small" type="number" fullWidth />
            <TextField label="Monto Bs" value={editForm.montoBs} onChange={e => setEditForm({ ...editForm, montoBs: e.target.value })} size="small" type="number" fullWidth />
          </Box>
          <TextField label="Vencimiento" value={editForm.vencimiento} onChange={e => setEditForm({ ...editForm, vencimiento: e.target.value })} size="small" type="date" InputLabelProps={{ shrink: true }} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditingMobile(false); handleEditCancel(); }}>Cancelar</Button>
          <Button onClick={() => { handleEditSave(editId); setEditingMobile(false); }} variant="contained" color="success">Guardar</Button>
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
