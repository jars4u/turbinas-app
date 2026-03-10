import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Divider,
  LinearProgress,
  useMediaQuery,
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { obtenerIngresos, eliminarIngreso } from "../lib/ingresosFirebase";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import ServicioEditorDialog from "./dashboard/ServicioEditorDialog";
import { obtenerClientes } from "../lib/clientesFirebase";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import AddIcon from "@mui/icons-material/Add";


export default function Ingresos({ tasaBCV, onOpenRegistrarIngreso }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const { isOwner } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    vehiculo: "",
    servicio: "",
    observaciones: "",
    precio: "",
    precioBs: "",
    customerName: "",
    customerPhone: "",
    factura: "",
    paymentUSDMethod: "efectivo",
  });
  const [editId, setEditId] = useState(null);
  const [clientes, setClientes] = useState([]);
  // UI de ingreso manual legacy eliminada
  // El ingreso manual no debe tener vehiculoId
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  // Establecer el día actual como valor por defecto
  const hoy = new Date();
  const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyStr);
  // Estado para guardar el ingreso original antes de editar (eliminado por no uso)

  // Depuración: mostrar ingresos en consola
  useEffect(() => {
    console.log('Ingresos:', ingresos);
  }, [ingresos]);
  
  useEffect(() => {
    setLoading(true);
    obtenerIngresos().then(data => {
      setIngresos(data);
      setLoading(false);
      // Seleccionar el día de hoy por defecto si existe
      const hoy = new Date();
      const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      // Siempre mostrar el día de hoy en el selector, aunque no haya ingresos
      setTimeout(() => setFechaSeleccionada(hoyStr), 0);
    });
  }, []);

  useEffect(() => {
    obtenerClientes().then(setClientes).catch(() => setClientes([]));
  }, []);

  const handleEditarIngreso = (ing) => {
    // Mapear ingreso a formulario del ServicioEditorDialog
    let pagoMetodo = 'efectivo';
    let precioUSD = '';
    let precioBs = '';
    if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
      // Priorizar pago movil para Bs, de lo contrario primer no "pago movil" para USD
      const pm = ing.formasPago.find(fp => (fp.formaPago || '').trim().toLowerCase() === 'pago movil');
      const usd = ing.formasPago.find(fp => (fp.formaPago || '').trim().toLowerCase() !== 'pago movil');
      if (pm) {
        pagoMetodo = 'pago movil';
        precioBs = (pm.montoBs !== undefined && pm.montoBs !== null) ? pm.montoBs : (pm.monto !== undefined && pm.monto !== null ? pm.monto : '');
      } else if (usd) {
        pagoMetodo = (usd.formaPago || usd.metodo || 'efectivo').toString().trim().toLowerCase();
        precioUSD = usd.monto !== undefined && usd.monto !== null ? usd.monto : '';
      }
    } else {
      // Legacy campos
      if ((ing.formaPago || '').trim().toLowerCase() === 'pago movil') {
        pagoMetodo = 'pago movil';
        precioBs = ing.montoBs ?? ing.monto ?? '';
      } else {
        pagoMetodo = (ing.formaPago || 'efectivo').toString().trim().toLowerCase();
        precioUSD = ing.monto ?? '';
      }
    }
    // Derivar vehículo y servicio desde la descripción si no existen en el objeto
    let vehiculoVal = ing.vehiculo || '';
    let servicioVal = ing.servicio || '';
    if (!vehiculoVal && !servicioVal && typeof ing.descripcion === 'string') {
      const parts = ing.descripcion.split('-');
      vehiculoVal = (parts[0] || '').trim();
      servicioVal = parts.slice(1).join('-').trim();
    }
    setEditForm({
      vehiculo: vehiculoVal,
      servicio: servicioVal,
      observaciones: ing.observaciones || '',
      precio: precioUSD !== '' ? Number(precioUSD) : '',
      precioBs: precioBs !== '' ? Number(precioBs) : '',
      customerName: ing.customerName || ing.cliente || '',
      customerPhone: ing.customerPhone || '+580000000000',
      factura: ing.factura || ing.numeroFactura || '',
      paymentUSDMethod: pagoMetodo || 'efectivo',
    });
    setEditId(ing.id || null);
    setEditDialogOpen(true);
  };

  const handleGuardarEdicion = async () => {
    if (!editId) return;
    const db = getFirestore();
    // Construir formasPago según método
    const metodo = (editForm.paymentUSDMethod || 'efectivo').toString().trim().toLowerCase();
    const formasPago = [];
    if (metodo === 'pago movil') {
      const montoParaBs = editForm.precioBs !== undefined && editForm.precioBs !== null && editForm.precioBs !== '' ? Number(editForm.precioBs) : (editForm.precio !== undefined && editForm.precio !== null && editForm.precio !== '' ? Number(editForm.precio) : undefined);
      if (montoParaBs !== undefined && !isNaN(montoParaBs) && montoParaBs > 0) {
        formasPago.push({ formaPago: 'pago movil', montoBs: montoParaBs });
      }
    } else {
      const montoUSD = editForm.precio !== undefined && editForm.precio !== null && editForm.precio !== '' ? Number(editForm.precio) : undefined;
      if (montoUSD !== undefined && !isNaN(montoUSD) && montoUSD > 0) {
        formasPago.push({ formaPago: metodo, monto: montoUSD });
      }
    }
    const ingresoEditadoRaw = {
      vehiculo: editForm.vehiculo || undefined,
      servicio: editForm.servicio || undefined,
      observaciones: editForm.observaciones || undefined,
      customerName: editForm.customerName || undefined,
      customerPhone: editForm.customerPhone || undefined,
      factura: editForm.factura || undefined,
      formasPago: formasPago.length > 0 ? formasPago : undefined,
      // Limpiar legacy
      formaPago: undefined,
      monto: undefined,
      referencia: undefined,
      formaPago2: undefined,
      monto2: undefined,
      referencia2: undefined,
    };
    const ingresoEditado = Object.fromEntries(Object.entries(ingresoEditadoRaw).filter(([_, v]) => v !== undefined && v !== null));
    await updateDoc(doc(db, "ingresosMovimientos", editId), ingresoEditado);

    // Guardar/actualizar cliente en la colección 'clientes'
    try {
      const nombreRaw = (editForm.customerName || '').trim();
      let telefono = (editForm.customerPhone || '').trim();
      telefono = telefono.replace(/[-\s]/g, "");
      if (telefono) {
        if (!telefono.startsWith("+58")) {
          if (telefono.startsWith("58")) {
            telefono = "+" + telefono;
          } else if (telefono.startsWith("0") && telefono.length >= 11) {
            telefono = "+58" + telefono.slice(1);
          } else if (/^\d{10}$/.test(telefono)) {
            telefono = "+58" + telefono;
          }
        }
        if (telefono.startsWith("+58")) {
          const local = telefono.slice(3).replace(/[^\d]/g, "");
          telefono = "+58" + local.replace(/^0+/, "");
        }
      }
      if (nombreRaw && /^\+58\d{10}$/.test(telefono)) {
        const nombre = nombreRaw.toUpperCase();
        const { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } = await import("firebase/firestore");
        const fdb = getFirestore();
        const clientesRef = collection(fdb, "clientes");
        const q = query(clientesRef, where("nombre", "==", nombre), where("telefono", "==", telefono));
        const snap = await getDocs(q);
        const modeloServicio = {
          fecha: Date.now(),
          modelo: ingresoEditado.vehiculo || "",
          servicio: ingresoEditado.servicio || "",
          nombre,
          telefono,
        };
        if (snap.empty) {
          await addDoc(clientesRef, { nombre, telefono, modelosServicios: [modeloServicio] });
        } else {
          const clienteDoc = snap.docs[0];
          const prev = clienteDoc.data().modelosServicios || [];
          await updateDoc(doc(fdb, "clientes", clienteDoc.id), { modelosServicios: [...prev, modeloServicio] });
        }
      }
    } catch (_) {
      // No bloquear edición si falla el guardado del cliente
    }

    setEditDialogOpen(false);
    setEditId(null);
    setLoading(true);
    const actualizados = await obtenerIngresos();
    setIngresos(actualizados);
    setLoading(false);
  };

  // UI y lógica de agregar ingreso manual legacy eliminadas

  const handleEliminarIngreso = async (ingreso) => {
    if (!window.confirm("¿Seguro que deseas eliminar este ingreso?")) return;
    setLoading(true);
    try {
      await eliminarIngreso(ingreso.id);
      const actualizados = await obtenerIngresos();
      setIngresos(actualizados);
    } catch (err) {
      alert("Error al eliminar ingreso");
    }
    setLoading(false);
  };

  // Edición mediante ServicioEditorDialog

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
    {/* {isOwner && (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          color="primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const res = await migrarNumeroFacturaAFactura();
              const actualizados = await obtenerIngresos();
              setIngresos(actualizados);
              alert(`Migración completada. Actualizados: ${res.actualizados}. Omitidos: ${res.omitidos}. Errores: ${res.errores}.`);
            } catch (e) {
              alert('Error ejecutando la migración.');
            }
            setLoading(false);
          }}
        >
          Migrar numeroFactura → factura
        </Button>
      </Box>
    )} */}
    {/* Dialogo de edición con ServicioEditorDialog */}
    {isOwner && editDialogOpen && (
      <ServicioEditorDialog
        open={editDialogOpen}
        isXs={isMobile}
        onDialogClose={() => setEditDialogOpen(false)}
        actionLoading={false}
        onClose={() => setEditDialogOpen(false)}
        editId={editId}
        editSection={true}
        onCancelEditSection={() => setEditDialogOpen(false)}
        form={editForm}
        onChange={(e) => {
          const { name, value } = e.target;
          setEditForm((prev) => ({ ...prev, [name]: value }));
        }}
        isRegistering={false}
        clientes={clientes}
        onClienteInputChange={(_e, value) => setEditForm((prev) => ({ ...prev, customerName: value }))}
        onClienteChange={(_e, opt) => {
          if (!opt) return;
          setEditForm((prev) => ({
            ...prev,
            customerName: opt.nombre || prev.customerName,
            customerPhone: opt.telefono ? (opt.telefono.startsWith('+58') ? opt.telefono : '+58' + opt.telefono.replace(/^0+/, '')) : prev.customerPhone,
          }));
        }}
        onCustomerPhoneChange={(e) => {
          const val = e.target.value || '';
          setEditForm((prev) => ({ ...prev, customerPhone: val }));
        }}
        isEditing={true}
        onSave={handleGuardarEdicion}
        paymentUSDEnabled={true}
        paymentUSDMethod={editForm.paymentUSDMethod}
        onPaymentUSDMethodChange={(val) => setEditForm((prev) => ({ ...prev, paymentUSDMethod: val }))}
        isManualIngreso={true}
      />
    )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
        <Typography variant="h6" sx={{ mb: 0, alignSelf: 'flex-start', width: '100%' }}>
          Registro de Ingresos
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Día"
              views={["year", "month", "day"]}
              value={fechaSeleccionada ? dayjs(fechaSeleccionada.split('/').reverse().join('-')) : null}
              onChange={date => {
                if (date && dayjs(date).isValid()) {
                  const d = String(dayjs(date).date()).padStart(2, '0');
                  const m = String(dayjs(date).month() + 1).padStart(2, '0');
                  const y = dayjs(date).year();
                  setFechaSeleccionada(`${d}/${m}/${y}`);
                }
              }}
              renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 120 }} />}
              disableFuture
              minDate={ingresos.length > 0 ? (() => {
                const fechas = ingresos.map(i => {
                  if (i.fecha && typeof i.fecha === 'string') return i.fecha;
                  if (i.fecha && i.fecha.seconds) {
                    const d = String(new Date(i.fecha.seconds * 1000).getDate()).padStart(2, '0');
                    const m = String(new Date(i.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                    const y = new Date(i.fecha.seconds * 1000).getFullYear();
                    return `${d}/${m}/${y}`;
                  }
                  return null;
                }).filter(Boolean);
                const min = fechas.sort((a, b) => {
                  const fa = Date.parse(a.split("/").reverse().join("-"));
                  const fb = Date.parse(b.split("/").reverse().join("-"));
                  return fa - fb;
                })[0];
                return dayjs(min.split('/').reverse().join('-'));
              })() : undefined}
              maxDate={dayjs().startOf('day')}
              shouldDisableDate={date => {
                if (!dayjs(date).isValid()) return true;
                const d = String(dayjs(date).date()).padStart(2, '0');
                const m = String(dayjs(date).month() + 1).padStart(2, '0');
                const y = dayjs(date).year();
                const fechaStr = `${d}/${m}/${y}`;
                return !ingresos.some(i => {
                  let ingresoFecha = '';
                  if (i.fecha && typeof i.fecha === 'string') {
                    const parts = i.fecha.split(/[/-]/);
                    if (parts.length === 3) {
                      ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
                    } else {
                      ingresoFecha = i.fecha;
                    }
                  } else if (i.fecha && i.fecha.seconds) {
                    const dd = String(new Date(i.fecha.seconds * 1000).getDate()).padStart(2, '0');
                    const mm = String(new Date(i.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                    const yy = new Date(i.fecha.seconds * 1000).getFullYear();
                    ingresoFecha = `${dd}/${mm}/${yy}`;
                  }
                  return ingresoFecha === fechaStr;
                });
              }}
            />
          </LocalizationProvider>
          {onOpenRegistrarIngreso && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onOpenRegistrarIngreso}
              sx={{
                px: { sm: 2 },
                borderRadius: 1.5,
                textTransform: 'capitalize',
                minWidth: { sm: 110 },
                boxShadow: { sm: 'none' },
              }}
            >
              ingreso
            </Button>
          )}
        </Box>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {/* UI de ingreso manual legacy removida */}
      <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
        {isMobile ? (
          <Box>
            {/* Resumen total en móvil */}
            <Paper sx={{ p: 1.5, mb: 1, bgcolor: '#e0f7fa' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="body2" fontWeight={700}>Total Ingresos</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {(() => {
                    const ingresosFiltrados = ingresos.filter(ing => {
                      if (!fechaSeleccionada) return false;
                      let ingresoFecha = '';
                      if (ing.fecha && typeof ing.fecha === 'string') {
                        const parts = ing.fecha.split(/[/-]/);
                        if (parts.length === 3) {
                          ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
                        } else {
                          ingresoFecha = ing.fecha;
                        }
                      } else if (ing.fecha && ing.fecha.seconds) {
                        const dd = String(new Date(ing.fecha.seconds * 1000).getDate()).padStart(2, '0');
                        const mm = String(new Date(ing.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                        const yy = new Date(ing.fecha.seconds * 1000).getFullYear();
                        ingresoFecha = `${dd}/${mm}/${yy}`;
                      }
                      return ingresoFecha === fechaSeleccionada;
                    });
                    let totalUSD = 0;
                    let totalBs = 0;
                    ingresosFiltrados.forEach(ing => {
                      if (Array.isArray(ing.formasPago)) {
                        ing.formasPago.forEach(fp => {
                          const forma = (fp.formaPago || '').trim().toLowerCase();
                          if (forma !== 'pago movil' && fp.monto != null && !isNaN(Number(fp.monto))) {
                            totalUSD += Number(fp.monto);
                          }
                          if (forma === 'pago movil') {
                            const v = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                              ? Number(fp.montoBs)
                              : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                            if (v > 0) totalBs += v;
                          }
                        });
                      }
                    });
                    return `$ ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Bs. ${totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
                  })()}
                </Typography>
              </Box>
            </Paper>

            {/* Lista de ingresos en tarjetas */}
            <Box>
              {loading ? (
                <LinearProgress sx={{ width: '100%' }} />
              ) : (
                (() => {
                  const filtrados = ingresos.filter(ing => {
                    if (!fechaSeleccionada) return false;
                    let ingresoFecha = '';
                    if (ing.fecha && typeof ing.fecha === 'string') {
                      const parts = ing.fecha.split(/[/-]/);
                      if (parts.length === 3) {
                        ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
                      } else {
                        ingresoFecha = ing.fecha;
                      }
                    } else if (ing.fecha && ing.fecha.seconds) {
                      const dd = String(new Date(ing.fecha.seconds * 1000).getDate()).padStart(2, '0');
                      const mm = String(new Date(ing.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                      const yy = new Date(ing.fecha.seconds * 1000).getFullYear();
                      ingresoFecha = `${dd}/${mm}/${yy}`;
                    }
                    return ingresoFecha === fechaSeleccionada;
                  });
                  if (filtrados.length === 0) {
                    return (
                      <Typography align="center" color="text.secondary" sx={{ py: 1 }}>
                        Sin ingresos
                      </Typography>
                    );
                  }
                  return filtrados.map((ing, idx) => {
                    let totalUSD = 0;
                    let totalBs = 0;
                    let formas = [];
                    let refs = [];
                    if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
                      formas = ing.formasPago.map(fp => (fp.formaPago || fp.metodo || '-')).filter(Boolean);
                      refs = ing.formasPago.map(fp => fp.referencia || '-');
                      ing.formasPago.forEach(fp => {
                        const f = (fp.formaPago || '').trim().toLowerCase();
                        if (f !== 'pago movil' && fp.monto != null && !isNaN(Number(fp.monto))) {
                          totalUSD += Number(fp.monto);
                        }
                        if (f === 'pago movil') {
                          const v = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                            ? Number(fp.montoBs)
                            : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                          if (v > 0) totalBs += v;
                        }
                      });
                    } else {
                      if (ing.formaPago) formas = [ing.formaPago];
                      if (ing.referencia) refs = [ing.referencia];
                    }
                    return (
                      <Paper key={idx} sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {ing.factura || ing.descripcion || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ing.fecha && typeof ing.fecha === 'string' ? ing.fecha : (ing.fecha && ing.fecha.seconds ? new Date(ing.fecha.seconds * 1000).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-')}
                          </Typography>
                        </Box>
                        {ing.descripcion && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {ing.descripcion}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formas.length > 0 ? formas.map((f, i) => (
                            <span key={i}>{String(f).toUpperCase()}{i < formas.length - 1 ? ', ' : ''}</span>
                          )) : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(() => {
                            const desc = (!ing.vehiculoId || (ing.vehiculoId && String(ing.vehiculoId).startsWith('manual'))) ? (ing.descripcion || '') : '';
                            const ref = refs.length > 0 ? refs.join(' + ') : (ing.referencia || '-');
                            return desc ? `${desc}${ref !== '-' ? ' | ' + ref : ''}` : ref;
                          })()}
                        </Typography>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2"><b>$</b> {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                          <Typography variant="body2"><b>Bs</b> {totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</Typography>
                        </Box>
                        {isOwner && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                            <Button size="small" variant="text" color="primary" sx={{ p: 0, minWidth: 28 }} onClick={() => handleEditarIngreso(ing)}>
                              <EditIcon fontSize="small" />
                            </Button>
                            <Button size="small" variant="text" color="error" sx={{ p: 0, minWidth: 28 }} onClick={() => handleEliminarIngreso(ing)}>
                              <DeleteIcon fontSize="small" />
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    );
                  });
                })()
              )}
            </Box>
          </Box>
        ) : (
          <Table component={Paper} size="small" sx={{ mb: 2, minWidth: 400 }}>
        {/* Fila de total de ingresos al inicio */}
        <TableHead>
          <TableRow className="w-100">
            <TableCell colSpan={8} sx={{ fontWeight: 700, bgcolor: '#e0f7fa', width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} className="w-100">
                <span>Total Ingresos</span>
                <span>
                  {(() => {
                    const ingresosFiltrados = ingresos.filter(ing => {
                      if (!fechaSeleccionada) return false;
                      let ingresoFecha = '';
                      if (ing.fecha && typeof ing.fecha === 'string') {
                        const parts = ing.fecha.split(/[/-]/);
                        if (parts.length === 3) {
                          ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
                        } else {
                          ingresoFecha = ing.fecha;
                        }
                      } else if (ing.fecha && ing.fecha.seconds) {
                        const dd = String(new Date(ing.fecha.seconds * 1000).getDate()).padStart(2, '0');
                        const mm = String(new Date(ing.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                        const yy = new Date(ing.fecha.seconds * 1000).getFullYear();
                        ingresoFecha = `${dd}/${mm}/${yy}`;
                      }
                      return ingresoFecha === fechaSeleccionada;
                    });
                    // Sumar por divisa usando formasPago
                    let totalUSD = 0;
                    let totalBs = 0;
                    ingresosFiltrados.forEach(ing => {
                      if (Array.isArray(ing.formasPago)) {
                        ing.formasPago.forEach(fp => {
                          const forma = (fp.formaPago || '').trim().toLowerCase();
                          if (forma !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                            totalUSD += Number(fp.monto);
                          }
                          if (forma === 'pago movil') {
                            const v = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                              ? Number(fp.montoBs)
                              : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                            if (v > 0) totalBs += v;
                          }
                        });
                      }
                    });
                    return `$ ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Bs. ${totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
                  })()}
                </span>
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Fecha</TableCell>
            <TableCell>Factura</TableCell>
            <TableCell align="right">Monto ($)</TableCell>
            <TableCell align="right">Monto (Bs)</TableCell>
            <TableCell>Forma de Pago</TableCell>
            <TableCell>Ref./Observaciones</TableCell>
            {isOwner && <TableCell align="center">Acciones</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ p: 0 }}>
                <LinearProgress sx={{ width: '100%' }} />
              </TableCell>
            </TableRow>
          ) : ingresos.filter(ing => {
            if (!fechaSeleccionada) return false;
            let ingresoFecha = '';
            if (ing.fecha && typeof ing.fecha === 'string') {
              const parts = ing.fecha.split(/[/-]/);
              if (parts.length === 3) {
                ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
              } else {
                ingresoFecha = ing.fecha;
              }
            } else if (ing.fecha && ing.fecha.seconds) {
              const dd = String(new Date(ing.fecha.seconds * 1000).getDate()).padStart(2, '0');
              const mm = String(new Date(ing.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
              const yy = new Date(ing.fecha.seconds * 1000).getFullYear();
              ingresoFecha = `${dd}/${mm}/${yy}`;
            }
            return ingresoFecha === fechaSeleccionada;
          }).length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ color: "text.secondary" }}>
                Sin ingresos
              </TableCell>
            </TableRow>
          ) : (
            ingresos.filter(ing => {
              if (!fechaSeleccionada) return false;
              let ingresoFecha = '';
              if (ing.fecha && typeof ing.fecha === 'string') {
                const parts = ing.fecha.split(/[/-]/);
                if (parts.length === 3) {
                  ingresoFecha = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
                } else {
                  ingresoFecha = ing.fecha;
                }
              } else if (ing.fecha && ing.fecha.seconds) {
                const dd = String(new Date(ing.fecha.seconds * 1000).getDate()).padStart(2, '0');
                const mm = String(new Date(ing.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
                const yy = new Date(ing.fecha.seconds * 1000).getFullYear();
                ingresoFecha = `${dd}/${mm}/${yy}`;
              }
              return ingresoFecha === fechaSeleccionada;
            }).map((ing, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{
                  ing.fecha && typeof ing.fecha === 'string'
                    ? (() => {
                        const parts = ing.fecha.split(/[/-]/);
                        if (parts.length === 3) {
                          // Si ya está en dd/mm/yyyy, mostrar igual
                          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
                        }
                        return ing.fecha;
                      })()
                    : ing.fecha && ing.fecha.seconds
                      ? new Date(ing.fecha.seconds * 1000).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '-'
                }</TableCell>
                <TableCell>
                  {(() => {
                    const esManual = !ing.vehiculoId || (ing.vehiculoId && ing.vehiculoId.startsWith('manual'));
                    if (esManual) {
                      return ing.factura || ing.numeroFactura || '-';
                    }
                    return ing.factura || ing.descripcion || '-';
                  })()}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {(() => {
                    // Mostrar monto en $ solo si la forma de pago es Zelle, Efectivo, USD, $
                    if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
                      const montosUSD = ing.formasPago
                        .filter(fp => {
                          const f = (fp.formaPago || '').trim().toLowerCase();
                          return f !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto));
                        })
                        .map(fp => Number(fp.monto).toLocaleString("en-US", { minimumFractionDigits: 2 }));
                      return montosUSD.length > 0 ? montosUSD.join(' + ') : "-";
                    }
                    return "-";
                  })()}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {(() => {
                    // Mostrar monto en Bs solo si la forma de pago es 'pago movil', usando el atributo monto
                    if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
                      const montosBs = ing.formasPago
                        .filter(fp => fp.formaPago && fp.formaPago.trim().toLowerCase() === 'pago movil' && ((fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) || (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)))))
                        .map(fp => Number(fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)) ? fp.montoBs : fp.monto).toLocaleString("de-DE", { minimumFractionDigits: 2 }));
                      return montosBs.length > 0 ? montosBs.join(' + ') : "-";
                    }
                    return "-";
                  })()}
                </TableCell>
                <TableCell>
                  {Array.isArray(ing.formasPago) && ing.formasPago.length > 0
                    ? ing.formasPago.map(fp => {
                        if (fp.formaPago) return fp.formaPago.toUpperCase();
                        if (fp.metodo) return fp.metodo.toUpperCase();
                        return '-';
                      }).join(' + ')
                    : (ing.formaPago ? ing.formaPago.toUpperCase() : '-')}
                </TableCell>
                <TableCell>
                  {(() => {
                    const esManual = !ing.vehiculoId || (ing.vehiculoId && ing.vehiculoId.startsWith('manual'));
                    if (esManual) {
                      return ing.observaciones || '-';
                    }
                    // No manual: referencias normales
                    return Array.isArray(ing.formasPago) && ing.formasPago.length > 0
                      ? ing.formasPago.map(fp => fp.referencia || '-').join(' + ')
                      : (ing.referencia || '-');
                  })()}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <Button size="small" variant="text" color="primary" sx={{ p: 0, minWidth: 28, mr: 0.5 }} onClick={() => handleEditarIngreso(ing)}>
                        <EditIcon fontSize="small" />
                      </Button>
                      <Button size="small" variant="text" color="error" sx={{ p: 0, minWidth: 28 }} onClick={() => handleEliminarIngreso(ing)}>
                        <DeleteIcon fontSize="small" />
                      </Button>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
        </Table>
          )}
      </Box>
    </Box>
  );
}
