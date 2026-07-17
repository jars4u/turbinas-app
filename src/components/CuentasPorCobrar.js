import React, { useState, useEffect } from "react";
import { Skeleton } from "@mui/material";
import PaymentModal from "./PaymentModal";
import ServicioEditorDialog from "./dashboard/ServicioEditorDialog";
import { useMediaQuery } from "@mui/material";
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button, IconButton, Snackbar } from "@mui/material";
import ConfirmDialog from "./common/ConfirmDialog";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaidIcon from '@mui/icons-material/Paid';
// ExpandMoreIcon removed due to Accordion removal

export default function CuentasPorCobrar() {
  const isXs = useMediaQuery('(max-width:600px)');
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cuentaServicio, setCuentaServicio] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogForm, setEditDialogForm] = useState({ vehiculo: '', placa: '', servicio: '', observaciones: '', precio: '', precioBs: '', customerName: '', customerPhone: '+58' });
  const [editDialogId, setEditDialogId] = useState(null);
  // editModalidad no es necesario tras unificar modalidad servicio
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ vehiculo: '', placa: '', servicio: '', observaciones: '', precio: '', precioBs: '', customerName: '', customerPhone: '+58' });
  const [clientes, setClientes] = useState([]);

  // Eliminar cuenta por cobrar
  const handleDelete = async (id) => {
  const { db } = await import('../firebase');
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'cuentasPorCobrar', id));
  setConfirmDeleteId(null);
  };

  // Iniciar edición vía ServicioEditorDialog
  const handleEditInit = (cuenta) => {
    setEditDialogId(cuenta.id);
    // Unificado: siempre modalidad 'servicio'
    const v = normalizeCuenta(cuenta);
    setEditDialogForm({
      vehiculo: v.vehiculo || '',
      placa: cuenta.placa || '',
      servicio: v.servicio || '',
      observaciones: v.observaciones || '',
      precio: v.precio || '',
      precioBs: v.precioBs || '',
      customerName: cuenta.customerName || cuenta.cliente || '',
      customerPhone: cuenta.customerPhone || '+58'
    });
    setEditDialogOpen(true);
  };

  // Guardar edición desde ServicioEditorDialog
  const handleEditSave = async () => {
    if (!editDialogId) return;
    const { db } = await import('../firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    const updatedData = {
      modalidad: 'servicio',
      vehiculo: (editDialogForm.vehiculo || '').toUpperCase(),
      placa: (editDialogForm.placa || '').toUpperCase(),
      servicio: (editDialogForm.servicio || '').toUpperCase(),
      observaciones: editDialogForm.observaciones || '',
      precio: parseFloat(editDialogForm.precio) || 0,
      precioBs: parseFloat(editDialogForm.precioBs) || 0,
      customerPhone: editDialogForm.customerPhone || '',
      customerName: editDialogForm.customerName ? editDialogForm.customerName.trim().toUpperCase() : '',
      // Sincronizar campo legacy
      cliente: editDialogForm.customerName ? editDialogForm.customerName.trim().toUpperCase() : '',
    };
    await updateDoc(doc(db, 'cuentasPorCobrar', editDialogId), updatedData);
    setEditDialogOpen(false);
    setEditDialogId(null);
    // Unificado: no se usa modalidad al cerrar
    setSnackbarMsg('Cuenta actualizada');
    setSnackbarOpen(true);
  };

  // Cancelar edición
  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setEditDialogId(null);
    // Unificado: no se usa modalidad al cancelar
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

  // Cargar clientes para el diálogo
  useEffect(() => {
    import('../lib/clientesFirebase').then(({ obtenerClientes }) => {
      obtenerClientes().then(setClientes).catch(() => setClientes([]));
    });
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

  const formatCuentaFecha = (cuenta) => {
    const ts = toMillis(cuenta.fechaRegistro) ?? toMillis(cuenta.arrivalTime);
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString('es-VE');
  };

  // Normalizar a esquema de servicio (soporta legacy 'documento')
  const normalizeCuenta = (cuenta) => {
    if (!cuenta) return { vehiculo: '', servicio: '', observaciones: '', precio: 0, precioBs: 0 };
    if (cuenta.modalidad === 'servicio' || !cuenta.modalidad) {
      return {
        vehiculo: cuenta.vehiculo || '',
        placa: cuenta.placa || '',
        servicio: cuenta.servicio || '',
        observaciones: cuenta.observaciones || '',
        precio: typeof cuenta.precio === 'number' ? cuenta.precio : (parseFloat(cuenta.precio) || 0),
        precioBs: typeof cuenta.precioBs === 'number' ? cuenta.precioBs : (parseFloat(cuenta.precioBs) || 0),
      };
    }
    return {
      vehiculo: cuenta.documento || '',
      servicio: cuenta.cliente || '',
      observaciones: cuenta.concepto || '',
      precio: typeof cuenta.montoUSD === 'number' ? cuenta.montoUSD : (parseFloat(cuenta.montoUSD) || 0),
      precioBs: typeof cuenta.montoBs === 'number' ? cuenta.montoBs : (parseFloat(cuenta.montoBs) || 0),
    };
  };

  // Legacy handlers removed (handleChange, handleSubmit) due to ServicioEditorDialog integration

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Cuentas por Cobrar
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="contained" color="primary" onClick={() => setRegisterDialogOpen(true)}>Registrar cuenta</Button>
      </Box>
      {/* Tabla escritorio */}
      <Table component={Paper} size="small" sx={{ mb: 2, display: { xs: 'none', md: 'table' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Modelo</TableCell>
            <TableCell>Servicio</TableCell>
            <TableCell>Cliente</TableCell>
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
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={140} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="center"><Skeleton variant="rectangular" width={120} height={32} /></TableCell>
              </TableRow>
            ))
          ) : cuentas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center">No hay cuentas por cobrar registradas.</TableCell>
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
                {(() => {
                  const v = normalizeCuenta(cuenta);
                  return (
                    <>
                      <TableCell>{formatCuentaFecha(cuenta)}</TableCell>
                      <TableCell>{v.vehiculo ? v.vehiculo.toUpperCase() : '-'}</TableCell>
                      <TableCell>{v.servicio ? v.servicio.toUpperCase() : '-'}</TableCell>
                      <TableCell>{(cuenta.customerName || cuenta.cliente || '')}</TableCell>
                      <TableCell align="right">{typeof v.precio === 'number' && v.precio !== 0 ? v.precio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                      <TableCell align="right">{typeof v.precioBs === 'number' && v.precioBs !== 0 ? v.precioBs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
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
                            // Se preserva la cuenta completa (cliente, teléfono, vehiculoId, fechas)
                            // y solo se normalizan los campos de visualización, para no perder
                            // datos al momento de cobrar.
                            const vServ = normalizeCuenta(cuenta);
                            setCuentaServicio({ ...cuenta, ...vServ, id: cuenta.id });
                            setPaymentModalOpen(true);
                          }}
                        >
                          Cobrar
                        </Button>
                      </TableCell>
                    </>
                  );
                })()}
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
                const v = normalizeCuenta(cuenta);
                const montoUSD = (typeof v.precio === 'number' && v.precio !== 0) ? v.precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                const montoBs = (typeof v.precioBs === 'number' && v.precioBs !== 0) ? v.precioBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                return (
                  <Box key={cuenta.id || idx} sx={{ p: 1.25, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {v.vehiculo ? v.vehiculo.toUpperCase() : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                        {formatCuentaFecha(cuenta)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {v.servicio ? v.servicio.toUpperCase() : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      {(cuenta.customerName || cuenta.cliente || '') + (cuenta.customerPhone ? ` (${cuenta.customerPhone})` : '')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      {v.observaciones ? v.observaciones : '-'}
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
                      <IconButton color="primary" size="small" onClick={() => { handleEditInit(cuenta); }} aria-label="Editar">
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
                          // Igual que en la vista de escritorio: no descartar datos del cliente
                          // ni el vínculo con el servicio original.
                          const vServ = normalizeCuenta(cuenta);
                          setCuentaServicio({ ...cuenta, ...vServ, id: cuenta.id });
                          setPaymentModalOpen(true);
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
      {/* Diálogo de edición vía ServicioEditorDialog */}
      <ServicioEditorDialog
        open={editDialogOpen}
        isXs={isXs}
        onDialogClose={handleEditCancel}
        onClose={handleEditCancel}
        actionLoading={false}
        editId={editDialogId}
        form={editDialogForm}
        onChange={(e) => setEditDialogForm({ ...editDialogForm, [e.target.name]: e.target.value })}
        isRegistering={false}
        editSection={false}
        setEditSection={() => {}}
        isEditing={true}
        onSave={handleEditSave}
        onCancelEditSection={handleEditCancel}
        clientes={clientes}
        onClienteInputChange={(_, value) => setEditDialogForm({ ...editDialogForm, customerName: value })}
        onClienteChange={(_, value) => {
          if (value) {
            const phone = (value.telefono || '').replace(/[-\s]/g, '');
            const normalized = phone.startsWith('+58') ? phone : '+58' + phone.replace(/^0+/, '');
            setEditDialogForm({ ...editDialogForm, customerName: value.nombre || '', customerPhone: normalized });
          }
        }}
        onCustomerPhoneChange={(e) => {
          const raw = e.target.value.replace(/[-\s]/g, '');
          if (!raw) {
            setEditDialogForm({ ...editDialogForm, customerPhone: '' });
          } else {
            const normalized = raw.startsWith('+58') ? raw : '+58' + raw.replace(/^0+/, '');
            setEditDialogForm({ ...editDialogForm, customerPhone: normalized });
          }
        }}
        porCobrarDisabled={true}
        facturarDisabled={true}
        onWhatsAppSend={() => {}}
        onPorCobrar={() => {}}
        onOpenFactura={() => {}}
        paymentUSDEnabled={false}
      />
      {/* Diálogo para registrar cuenta por cobrar (ServicioEditorDialog) */}
      <ServicioEditorDialog
        open={registerDialogOpen}
        isXs={isXs}
        onDialogClose={() => setRegisterDialogOpen(false)}
        onClose={() => setRegisterDialogOpen(false)}
        actionLoading={false}
        editId={null}
        form={registerForm}
        onChange={(e) => setRegisterForm({ ...registerForm, [e.target.name]: e.target.value })}
        isRegistering={true}
        clientes={clientes}
        onClienteInputChange={(_, value) => setRegisterForm({ ...registerForm, customerName: value })}
        onClienteChange={(_, value) => {
          if (value) {
            const phone = (value.telefono || '').replace(/[-\s]/g, '');
            const normalized = phone.startsWith('+58') ? phone : '+58' + phone.replace(/^0+/, '');
            setRegisterForm({ ...registerForm, customerName: value.nombre || '', customerPhone: normalized });
          }
        }}
        onCustomerPhoneChange={(e) => {
          const raw = e.target.value.replace(/[-\s]/g, '');
          if (!raw) {
            setRegisterForm({ ...registerForm, customerPhone: '' });
          } else {
            const normalized = raw.startsWith('+58') ? raw : '+58' + raw.replace(/^0+/, '');
            setRegisterForm({ ...registerForm, customerPhone: normalized });
          }
        }}
        paymentUSDEnabled={false}
        onRegisterSave={async () => {
          const { crearCuentaPorCobrar } = await import('../lib/cuentasPorCobrarFirebase');
          await crearCuentaPorCobrar({
            vehiculo: registerForm.vehiculo,
            placa: registerForm.placa,
            servicio: registerForm.servicio,
            precio: registerForm.precio,
            precioBs: registerForm.precioBs,
            observaciones: registerForm.observaciones,
            customerName: registerForm.customerName,
            customerPhone: registerForm.customerPhone,
          });
          setRegisterDialogOpen(false);
          setRegisterForm({ vehiculo: '', placa: '', servicio: '', observaciones: '', precio: '', precioBs: '', customerName: '', customerPhone: '+58' });
          setSnackbarMsg('Cuenta por cobrar registrada');
          setSnackbarOpen(true);
        }}
      />
      {/* Flujo de cobro: siempre vía PaymentModal (servicio) */}

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
          const { cobrarCuentaPorCobrar } = await import('../lib/cuentasPorCobrarFirebase');
          await cobrarCuentaPorCobrar(cuentaServicio, facturaData);
          setPaymentModalOpen(false);
          setCuentaServicio(null);
          setSnackbarMsg('Cobro de servicio registrado exitosamente');
          setSnackbarOpen(true);
        }}
      />
      {/* Modal de confirmación de eliminación */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="¿Eliminar cuenta por cobrar?"
        message="Esta acción no se puede deshacer. ¿Deseas continuar?"
        cancelText="Cancelar"
        confirmText="Eliminar"
        confirmColor="error"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDelete(confirmDeleteId)}
      />
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
