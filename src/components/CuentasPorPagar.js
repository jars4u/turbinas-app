import React, { useState, useEffect } from "react";
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, LinearProgress as MuiLinearProgress } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaidIcon from '@mui/icons-material/Paid';
import EgresoFacturaDialog from "./EgresoFacturaDialog";
import { guardarEgreso } from "../lib/egresosFirebase";

export default function CuentasPorPagar() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasaBCV, setTasaBCV] = useState(null);
  // Firestore
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmPayId, setConfirmPayId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  // Dialog factura para alta/edición
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogInitial, setDialogInitial] = useState(null);
  const [editId, setEditId] = useState(null);
  // Eliminar cuenta por pagar
  const handleDelete = async (id) => {
    const { db } = await import('../firebase');
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'cuentasPorPagar', id));
    setConfirmDeleteId(null);
  };

  useEffect(() => {
    let unsubscribe;
    setLoading(true);
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, onSnapshot }) => {
        unsubscribe = onSnapshot(collection(db, 'cuentasPorPagar'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Mostrar siempre la cuenta más reciente primero
          data.sort((a, b) => (b?.fechaTimestamp?.seconds || 0) - (a?.fechaTimestamp?.seconds || 0));
          setCuentas(data);
          setLoading(false);
        });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    // Obtener tasa BCV para inicializar el diálogo con valor por defecto
    import('../lib/tasaBCVFirebase').then(({ obtenerTasaBCV }) => {
      obtenerTasaBCV().then((valor) => {
        setTasaBCV(valor ?? null);
      }).catch(() => setTasaBCV(null));
    }).catch(() => setTasaBCV(null));
  }, []);

  const openCreateDialog = () => {
    setDialogMode("create");
    const hoy = new Date();
    const fechaStr = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
    setDialogInitial({
      fechaStr,
      proveedor: "",
      rifCi: "",
      numeroDocumento: "",
      monedaFactura: "USD",
      tasaFactura: "",
      items: [{ descripcion: "", cantidad: 1, precioUnitario: "" }],
      observaciones: "",
      vencimiento: fechaStr,
    });
    setDialogOpen(true);
  };

  const handleSaveCuenta = async (payload) => {
    // Mapear payload del diálogo a documento de cuentasPorPagar
    const documento = payload?.numeroDocumento || "";
    const proveedor = payload?.proveedor || "";
    const concepto = payload?.observaciones || payload?.descripcion || "";
    const montoUSD = typeof payload?.montoUSD === "number" ? payload.montoUSD : 0;
    const montoBs = typeof payload?.montoBs === "number" ? payload.montoBs : 0;
    const vencimiento = payload?.vencimiento || ""; // dd/mm/yyyy (Opción A)
    const rifCi = payload?.rifCi || "";

    const { db } = await import('../firebase');
    const { addDoc, collection, Timestamp, doc, updateDoc } = await import('firebase/firestore');

    const data = {
      documento,
      proveedor,
      rifCi,
      concepto,
      descripcion: payload?.descripcion || concepto,
      montoUSD,
      montoBs,
      vencimiento,
      monedaFactura: payload?.monedaFactura || "USD",
      tasaFactura: payload?.tasaFactura ?? null,
      items: Array.isArray(payload?.items) ? payload.items : [],
      observaciones: payload?.observaciones || "",
      fecha: payload?.fechaStr || "",
      fechaTimestamp: Timestamp.fromDate(new Date())
    };

    if (dialogMode === "edit" && editId) {
      delete data.fechaTimestamp;
      await updateDoc(doc(db, 'cuentasPorPagar', editId), data);
    } else {
      await addDoc(collection(db, 'cuentasPorPagar'), data);
    }
    setDialogOpen(false);
    setDialogInitial(null);
    setEditId(null);
  };

  const openEditDialog = (cuenta) => {
    setDialogMode("edit");
    setEditId(cuenta?.id || null);
    const fechaStr = cuenta?.fecha || (() => {
      if (cuenta?.fechaTimestamp?.seconds) {
        const d = new Date(cuenta.fechaTimestamp.seconds * 1000);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      }
      return "";
    })();
    const totalUSD = typeof cuenta?.montoUSD === 'number' ? cuenta.montoUSD : 0;
    const totalBs = typeof cuenta?.montoBs === 'number' ? cuenta.montoBs : 0;
    const monedaFactura = totalBs > 0 && totalUSD === 0 ? 'Bs' : 'USD';
    const total = monedaFactura === 'Bs' ? totalBs : totalUSD;
    const items = Array.isArray(cuenta?.items) && cuenta.items.length > 0
      ? cuenta.items
      : [{ descripcion: cuenta?.descripcion || cuenta?.concepto || '', cantidad: 1, precioUnitario: total }];

    setDialogInitial({
      fechaStr,
      proveedor: cuenta?.proveedor || '',
      rifCi: cuenta?.rifCi || '',
      numeroDocumento: cuenta?.documento || '',
      monedaFactura: cuenta?.monedaFactura || monedaFactura,
      tasaFactura: cuenta?.tasaFactura ?? '',
      items,
      observaciones: cuenta?.observaciones || cuenta?.concepto || '',
      vencimiento: cuenta?.vencimiento || fechaStr,
    });
    setDialogOpen(true);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Cuentas por Pagar
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Button variant="contained" onClick={openCreateDialog}>Registrar cuenta</Button>
      </Box>

      <EgresoFacturaDialog
        open={dialogOpen}
        mode={dialogMode}
        tasaBCV={tasaBCV}
        initialValue={dialogInitial}
        includeVencimiento
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveCuenta}
        saving={false}
      />
  {loading && <MuiLinearProgress sx={{ mb: 1 }} />}
  <Table component={Paper} size="small" sx={{ mb: 2, minWidth: 720, display: { xs: 'none', md: 'table' } }}>
        <TableHead>
          <TableRow>
            <TableCell colSpan={7} sx={{ fontWeight: 700, bgcolor: '#ffe0e0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Cuentas por Pagar</span>
                <span>
                  $ {cuentas.reduce((a,c)=>a+(typeof c.montoUSD==='number'?c.montoUSD:0),0).toLocaleString('en-US',{minimumFractionDigits:2})}
                  {" "}| Bs. {cuentas.reduce((a,c)=>a+(typeof c.montoBs==='number'?c.montoBs:0),0).toLocaleString('de-DE',{minimumFractionDigits:2})}
                </span>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Vencimiento</TableCell>
            <TableCell>Proveedor</TableCell>
            <TableCell>Factura/N-E</TableCell>
            <TableCell align="right">Total ($)</TableCell>
            <TableCell align="right">Total (Bs)</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ p: 0 }}>
                <MuiLinearProgress sx={{ width: '100%' }} />
              </TableCell>
            </TableRow>
          ) : cuentas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>
                No hay cuentas por pagar registradas.
              </TableCell>
            </TableRow>
          ) : (
            cuentas.map((cuenta) => {
              const fechaDisp = cuenta?.fecha || (cuenta?.fechaTimestamp?.seconds ? (()=>{const d=new Date(cuenta.fechaTimestamp.seconds*1000);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;})() : '-');
              const montoUSD = typeof cuenta.montoUSD === 'number' ? cuenta.montoUSD : 0;
              const montoBs = typeof cuenta.montoBs === 'number' ? cuenta.montoBs : 0;
              return (
                <TableRow key={cuenta.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fechaDisp}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{cuenta.vencimiento || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{cuenta.proveedor ? cuenta.proveedor.toUpperCase() : '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{cuenta.documento ? cuenta.documento.toUpperCase() : '-'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {montoUSD > 0 ? montoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {montoBs > 0 ? montoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <IconButton size="small" color="primary" onClick={() => openEditDialog(cuenta)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setConfirmDeleteId(cuenta.id)}>
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
                  </TableCell>
                </TableRow>
              );
            })
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {cuenta.proveedor ? cuenta.proveedor.toUpperCase() : '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Venc.:</Typography>
                    <Typography variant="caption">{cuenta.vencimiento || '-'}</Typography>
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
                    <IconButton color="primary" size="small" onClick={() => openEditDialog(cuenta)} aria-label="Editar cuenta">
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
              const hoy = new Date();
              const fechaPago = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
              // Construir payload completo según EgresoFacturaDialog
              const proveedorUp = (cuenta.proveedor || '').toUpperCase();
              const documentoUp = (cuenta.documento || '').toUpperCase();
              const rifCiUp = (cuenta.rifCi || '').toUpperCase();
              const monedaFactura = cuenta.monedaFactura || (Number(cuenta.montoBs) > 0 && Number(cuenta.montoUSD) === 0 ? 'Bs' : 'USD');
              const tasaFactura = cuenta.tasaFactura ?? null;
              const items = Array.isArray(cuenta.items) && cuenta.items.length > 0
                ? cuenta.items
                : [{ descripcion: (cuenta.concepto || cuenta.documento || proveedorUp).toUpperCase(), cantidad: 1, precioUnitario: (monedaFactura === 'Bs' ? Number(cuenta.montoBs) : Number(cuenta.montoUSD)) }];

              const payload = {
                tipo: 'factura',
                fecha: fechaPago, // se normaliza a Timestamp en guardarEgreso
                fechaStr: fechaPago,
                vencimiento: cuenta.vencimiento || undefined,
                proveedor: proveedorUp,
                rifCi: rifCiUp,
                numeroDocumento: documentoUp,
                monedaFactura,
                tasaFactura,
                items,
                montoUSD: typeof cuenta.montoUSD === 'number' ? cuenta.montoUSD : 0,
                montoBs: typeof cuenta.montoBs === 'number' ? cuenta.montoBs : 0,
                observaciones: (cuenta.observaciones || cuenta.concepto || '').trim(),
              };

              await guardarEgreso(payload);
              const { db } = await import('../firebase');
              const { doc, deleteDoc } = await import('firebase/firestore');
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
      {/* Edición móvil reutiliza el mismo diálogo de factura */}
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
