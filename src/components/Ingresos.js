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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { guardarIngreso, obtenerIngresos, eliminarIngreso } from "../lib/ingresosFirebase";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

export default function Ingresos({ tasaBCV }) {
  const { isOwner } = useAuth();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editIngreso, setEditIngreso] = useState(null);
  const [ingresoFactura, setIngresoFactura] = useState("");
  const [ingresoDescripcion, setIngresoDescripcion] = useState("");
  const [ingresoMontoUSD, setIngresoMontoUSD] = useState("");
  const [ingresoMontoBs, setIngresoMontoBs] = useState("");
  const [formaPago, setFormaPago] = useState("");
  // El ingreso manual no debe tener vehiculoId
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  // Establecer el día actual como valor por defecto
  const hoy = new Date();
  const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyStr);
  // Estado para guardar el ingreso original antes de editar
  const [originalIngreso, setOriginalIngreso] = useState(null);

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

  const handleEditarIngreso = (ingreso) => {
    // Si el ingreso tiene formasPago (array), tomar el primer elemento
    let monto = ingreso.monto;
    let montoBs = ingreso.montoBs;
    let formaPago = ingreso.formaPago;
    let descripcion = ingreso.descripcion;
    if (Array.isArray(ingreso.formasPago) && ingreso.formasPago.length > 0) {
      monto = ingreso.formasPago[0].monto ?? monto;
      montoBs = ingreso.formasPago[0].montoBs ?? montoBs;
      formaPago = ingreso.formasPago[0].formaPago ?? ingreso.formasPago[0].metodo ?? formaPago;
      descripcion = ingreso.descripcion ?? ingreso.formasPago[0].descripcion ?? '';
    }
    const mappedIngreso = {
      ...ingreso,
      monto,
      montoBs,
      formaPago,
      descripcion,
    };
    setEditIngreso(mappedIngreso);
    setOriginalIngreso(mappedIngreso);
    setEditModalOpen(true);
  };

  const handleGuardarEdicion = async (actualizado) => {
    const db = getFirestore();
    const ingresoId = actualizado.id;
    if (!ingresoId) return;
    // Filtra los campos undefined/null y elimina monto/montoBs si no son numéricos
    const ingresoEditadoRaw = { ...actualizado };
    if (ingresoEditadoRaw.monto !== undefined && isNaN(Number(ingresoEditadoRaw.monto))) delete ingresoEditadoRaw.monto;
    if (ingresoEditadoRaw.montoBs !== undefined && isNaN(Number(ingresoEditadoRaw.montoBs))) delete ingresoEditadoRaw.montoBs;
    // Actualiza también el array formasPago si existe y filtra sus campos
    if (Array.isArray(ingresoEditadoRaw.formasPago) && ingresoEditadoRaw.formasPago.length > 0) {
      ingresoEditadoRaw.formasPago = [
        Object.fromEntries(Object.entries({
          ...ingresoEditadoRaw.formasPago[0],
          monto: ingresoEditadoRaw.monto,
          montoBs: ingresoEditadoRaw.montoBs,
          formaPago: ingresoEditadoRaw.formaPago,
          descripcion: ingresoEditadoRaw.descripcion,
        }).filter(([_, v]) => v !== undefined && v !== null))
      ];
    }
    const ingresoEditado = Object.fromEntries(
      Object.entries(ingresoEditadoRaw).filter(([_, v]) => v !== undefined && v !== null)
    );
    await updateDoc(doc(db, "ingresosMovimientos", ingresoId), ingresoEditado);
    setEditModalOpen(false);
    setEditIngreso(null);
    setLoading(true);
    const actualizados = await obtenerIngresos();
    setIngresos(actualizados);
    setLoading(false);
  };

  const handleAgregarIngreso = async () => {
    const montoUSD = ingresoMontoUSD !== '' ? Number(ingresoMontoUSD) : undefined;
    const montoBs = ingresoMontoBs !== '' ? Number(ingresoMontoBs) : undefined;
    if (!ingresoFactura || (!montoUSD && !montoBs) || !formaPago) {
      alert('Debes completar todos los campos obligatorios.');
      return;
    }
    const hoy = new Date();
    const d = String(hoy.getDate()).padStart(2, '0');
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const y = hoy.getFullYear();
    // Construir formasPago: cada monto va como 'monto', el backend adapta montoBs si es pago movil
    let formasPago = [];
    if (montoUSD) {
      formasPago.push({ formaPago, monto: montoUSD });
    }
    if (montoBs) {
      formasPago.push({ formaPago, monto: montoBs });
    }
    // Generar vehiculoId único para ingresos manuales
    const vehiculoIdManual = `manual-${Date.now()}`;
    // Construye el objeto y elimina cualquier campo undefined o null
    const nuevoIngresoRaw = {
      factura: ingresoFactura ? ingresoFactura.toUpperCase() : undefined,
      descripcion: ingresoDescripcion || undefined,
      formaPago: formaPago || undefined,
      fecha: `${d}/${m}/${y}`,
      formasPago: formasPago.length > 0 ? formasPago : undefined,
      vehiculoId: vehiculoIdManual,
    };
    const nuevoIngreso = Object.fromEntries(
      Object.entries(nuevoIngresoRaw).filter(([_, v]) => v !== undefined && v !== null)
    );
    await guardarIngreso(nuevoIngreso);

    // Crear vehículo virtual para el ingreso manual
    const { crearVehiculo } = await import("../lib/vehiculosFirebase");
    // Obtener el estado dejarDeMostrar
    let estadoDejarDeMostrar = "oculto";
    try {
      const { obtenerEstadosServicio } = await import("../lib/estadosServicioFirebase");
      const estados = await obtenerEstadosServicio();
      const estadoOcultar = estados.find(e => e.dejarDeMostrar);
      if (estadoOcultar) {
        estadoDejarDeMostrar = estadoOcultar.nombre;
      }
    } catch (e) {
      // Si falla, usar "oculto" por defecto
      estadoDejarDeMostrar = "oculto";
    }
    await crearVehiculo({
      vehiculo: "Ingreso manual",
      servicio: "-",
      customerName: "-",
      customerPhone: "-",
      arrivalTime: Date.now(),
      precio: null,
      precioBs: null,
      status: estadoDejarDeMostrar,
      registradoPor: "-",
      entregadoPor: "-",
      id: vehiculoIdManual,
    });

    const actualizados = await obtenerIngresos();
    setIngresos(actualizados);
    const hoyStr = `${d}/${m}/${y}`;
    setFechaSeleccionada(hoyStr);
    setIngresoFactura("");
    setIngresoDescripcion("");
    setIngresoMontoUSD("");
    setIngresoMontoBs("");
    setFormaPago("");
  };

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

  // Función para comparar si hubo cambios
  const ingresoEditadoEsIgual = () => {
    if (!editIngreso || !originalIngreso) return true;
    return (
      editIngreso.factura === originalIngreso.factura &&
      editIngreso.descripcion === originalIngreso.descripcion &&
      editIngreso.monto === originalIngreso.monto &&
      editIngreso.montoBs === originalIngreso.montoBs &&
      editIngreso.formaPago === originalIngreso.formaPago
    );
  };

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
    {/* Modal de edición */}
    {isOwner && editModalOpen && editIngreso && (
      <Paper sx={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, p: 3, minWidth: 320 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Editar ingreso</Typography>
        <TextField
          label="N° Factura"
          size="small"
          value={editIngreso.factura || ''}
          onChange={e => setEditIngreso({ ...editIngreso, factura: e.target.value })}
          sx={{ mb: 2, width: '100%' }}
        />
        <TextField
          label="Descripción"
          size="small"
          value={editIngreso.descripcion || ''}
          onChange={e => setEditIngreso({ ...editIngreso, descripcion: e.target.value })}
          sx={{ mb: 2, width: '100%' }}
        />
        <TextField
          select
          label="Forma de pago"
          size="small"
          value={editIngreso.formaPago || ''}
          onChange={e => setEditIngreso({ ...editIngreso, formaPago: e.target.value })}
          sx={{ mb: 2, width: '100%' }}
          SelectProps={{ native: true, displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
        >
          <option value="" disabled hidden>Selecciona una forma</option>
          <option value="efectivo">Efectivo</option>
          <option value="pago movil">Pago móvil</option>
          <option value="zelle">Zelle</option>
          <option value="divisas">Divisas</option>
          <option value="transferencia" disabled>Transferencia</option>
          <option value="credito" disabled>Credito</option>
        </TextField>
        <TextField
          label="Monto ($)"
          type="number"
          size="small"
          value={editIngreso.monto || ''}
          onChange={e => setEditIngreso({ ...editIngreso, monto: Number(e.target.value) })}
          sx={{ mb: 2, width: '100%' }}
        />
        <TextField
          label="Monto (Bs)"
          type="number"
          size="small"
          value={editIngreso.montoBs || ''}
          onChange={e => setEditIngreso({ ...editIngreso, montoBs: Number(e.target.value) })}
          sx={{ mb: 2, width: '100%' }}
        />
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleGuardarEdicion(editIngreso)}
            disabled={ingresoEditadoEsIgual()}
          >
            Guardar
          </Button>
          <Button variant="outlined" color="secondary" onClick={() => { setEditModalOpen(false); setEditIngreso(null); }}>Cancelar</Button>
        </Box>
      </Paper>
    )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0 }}>
          Registro de Ingresos
        </Typography>
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
      </Box>
      <Divider sx={{ mb: 2 }} />
      {/* Accordion para ingreso manual en móviles, box normal en desktop */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" fontWeight={600} color="text.secondary">Ingreso manual</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* El campo de vehículoId se asigna automáticamente y no se muestra */}
                <TextField
                  label="N° Factura"
                  size="small"
                  value={ingresoFactura}
                  onChange={e => setIngresoFactura(e.target.value)}
                  sx={{ minWidth: 180, width: '100%' }}
                />
                <TextField
                  label="Descripción"
                  size="small"
                  value={ingresoDescripcion}
                  onChange={e => setIngresoDescripcion(e.target.value)}
                  sx={{ minWidth: 180, width: '100%' }}
                />
                <TextField
                  select
                  label="Forma de pago"
                  size="small"
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  sx={{ minWidth: 180, width: '100%' }}
                  SelectProps={{ native: true, displayEmpty: true }}
                  InputLabelProps={{ shrink: true }}
                >
                  <option value="" disabled hidden>Selecciona una forma</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="pago movil">Pago móvil</option>
                  <option value="zelle">Zelle</option>
                  <option value="divisas">Divisas</option>
                  <option value="otro">Otro</option>
                </TextField>
                <TextField
                  label="Monto ($)"
                  type="number"
                  size="small"
                  value={ingresoMontoUSD}
                  onChange={e => setIngresoMontoUSD(e.target.value)}
                  sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 180, width: '100%' }}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="Monto (Bs)"
                  type="number"
                  size="small"
                  value={ingresoMontoBs}
                  onChange={e => setIngresoMontoBs(e.target.value)}
                  sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 180, width: '100%' }}
                  inputProps={{ min: 0 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAgregarIngreso}
                  disabled={!ingresoFactura || (!ingresoMontoUSD && !ingresoMontoBs) || !formaPago}
                  sx={{ width: '100%' }}
                >
                  Agregar
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="subtitle1" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
            Ingreso manual
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              mb: 1,
            }}
          >
            {/* El campo de vehículoId se asigna automáticamente y no se muestra */}
            <TextField
              label="N° Factura"
              size="small"
              value={ingresoFactura}
              onChange={e => setIngresoFactura(e.target.value)}
              sx={{ flex: 2, minWidth: 120 }}
            />
            <TextField
              label="Descripción"
              size="small"
              value={ingresoDescripcion}
              onChange={e => setIngresoDescripcion(e.target.value)}
              sx={{ flex: 2, minWidth: 120 }}
            />
            <TextField
              select
              label="Forma de pago"
              size="small"
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              sx={{ flex: 1, minWidth: 90 }}
              SelectProps={{ native: true, displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="" disabled hidden>Selecciona una forma</option>
              <option value="efectivo">Efectivo</option>
              {/* <option value="transferencia">Transferencia</option> */}
              <option value="pago movil">Pago móvil</option>
              <option value="zelle">Zelle</option>
              {/* <option value="divisas">Divisas</option>
              <option value="otro">Otro</option> */}
            </TextField>
            <TextField
              label="Monto ($)"
              type="number"
              size="small"
              value={ingresoMontoUSD}
              onChange={e => setIngresoMontoUSD(e.target.value)}
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Monto (Bs)"
              type="number"
              size="small"
              value={ingresoMontoBs}
              onChange={e => setIngresoMontoBs(e.target.value)}
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
              inputProps={{ min: 0 }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleAgregarIngreso}
              disabled={!ingresoFactura || (!ingresoMontoUSD && !ingresoMontoBs) || !formaPago}
              sx={{ minWidth: 90 }}
            >
              +
            </Button>
          </Box>
        </Box>
      </Box>
      <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
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
                          if (fp.formaPago && ["zelle", "efectivo", "$", "usd"].includes(fp.formaPago.trim().toLowerCase()) && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                            totalUSD += Number(fp.monto);
                          }
                          if (fp.formaPago && fp.formaPago.trim().toLowerCase() === "pago movil" && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                            totalBs += Number(fp.monto);
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
                <TableCell>{ing.factura || ing.descripcion || '-'}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {(() => {
                    // Mostrar monto en $ solo si la forma de pago es Zelle, Efectivo, USD, $
                    if (Array.isArray(ing.formasPago) && ing.formasPago.length > 0) {
                      const montosUSD = ing.formasPago
                        .filter(fp => fp.formaPago && ["zelle", "efectivo", "$", "usd"].includes(fp.formaPago.trim().toLowerCase()) && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)))
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
                        .filter(fp => fp.formaPago && fp.formaPago.trim().toLowerCase() === 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)))
                        .map(fp => Number(fp.monto).toLocaleString("de-DE", { minimumFractionDigits: 2 }));
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
                    // Si es ingreso manual y tiene descripción, mostrarla junto con la referencia
                    if (!ing.vehiculoId || (ing.vehiculoId && ing.vehiculoId.startsWith('manual'))) {
                      let desc = ing.descripcion ? ing.descripcion : '';
                      let ref = Array.isArray(ing.formasPago) && ing.formasPago.length > 0
                        ? ing.formasPago.map(fp => fp.referencia || '-').join(' + ')
                        : (ing.referencia || '-');
                      return desc ? `${desc} ${ref !== '-' ? '| ' + ref : ''}` : ref;
                    }
                    // Si no es manual, mostrar referencia normal
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
      </Box>
    </Box>
  );
}
