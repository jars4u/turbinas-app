import React, { useState, useEffect } from "react";
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
} from "@mui/material";
  // ...existing code...
import { guardarIngreso, obtenerIngresos } from "../lib/ingresosFirebase";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

export default function Ingresos({ tasaBCV }) {
  const [ingresoFactura, setIngresoFactura] = useState("");
  const [ingresoMontoUSD, setIngresoMontoUSD] = useState("");
  const [ingresoMontoBs, setIngresoMontoBs] = useState("");
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");

  useEffect(() => {
    setLoading(true);
    obtenerIngresos().then(data => {
      setIngresos(data);
      setLoading(false);
      // Seleccionar el día de hoy por defecto si existe
      const hoy = new Date();
      const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      const fechas = data.map(i => {
        if (i.fecha && typeof i.fecha === 'string') {
          const parts = i.fecha.split(/[/-]/);
          if (parts.length === 3) {
            return `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
          }
          return i.fecha;
        }
        if (i.fecha && i.fecha.seconds) {
          const d = String(new Date(i.fecha.seconds * 1000).getDate()).padStart(2, '0');
          const m = String(new Date(i.fecha.seconds * 1000).getMonth() + 1).padStart(2, '0');
          const y = new Date(i.fecha.seconds * 1000).getFullYear();
          return `${d}/${m}/${y}`;
        }
        return null;
      }).filter(Boolean);
      if (fechas.includes(hoyStr)) {
        setTimeout(() => setFechaSeleccionada(hoyStr), 0);
      } else if (fechas.length > 0) {
        setTimeout(() => setFechaSeleccionada(fechas[0]), 0);
      }
    });
  }, []);

  const handleAgregarIngreso = async () => {
    const montoUSD = Number(ingresoMontoUSD);
    const montoBs = Number(ingresoMontoBs);
  if (!ingresoFactura || (!montoUSD && !montoBs)) return;
    const hoy = new Date();
    const d = String(hoy.getDate()).padStart(2, '0');
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const y = hoy.getFullYear();
    const nuevoIngreso = {
  factura: ingresoFactura,
      monto: montoUSD || (montoBs / tasaBCV),
      montoBs: montoBs || (montoUSD * tasaBCV),
      fecha: `${d}/${m}/${y}`,
    };
    await guardarIngreso(nuevoIngreso);
    // Recargar desde la base de datos para asegurar persistencia
    const actualizados = await obtenerIngresos();
    setIngresos(actualizados);
    // Si el ingreso es de hoy, actualizar la fecha seleccionada
    const hoyStr = `${d}/${m}/${y}`;
    setFechaSeleccionada(hoyStr);
  // setIngresoDesc eliminado, ahora se usa setIngresoFactura
  setIngresoFactura("");
    setIngresoMontoUSD("");
    setIngresoMontoBs("");
  };

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0 }}>
          Registro de Ingresos
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Día"
            views={["year", "month", "day"]}
            value={fechaSeleccionada ? (() => {
              const partes = fechaSeleccionada.split('/');
              return new Date(
                parseInt(partes[2]),
                parseInt(partes[1]) - 1,
                parseInt(partes[0])
              );
            })() : null}
            onChange={date => {
              if (date) {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
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
              const partes = min.split('/');
              return new Date(
                parseInt(partes[2]),
                parseInt(partes[1]) - 1,
                parseInt(partes[0])
              );
            })() : undefined}
            maxDate={(() => {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              return hoy;
            })()}
            shouldDisableDate={date => {
              // Unificar formato dd/mm/yyyy para comparar
              const d = String(date.getDate()).padStart(2, '0');
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const y = date.getFullYear();
              const fechaStr = `${d}/${m}/${y}`;
              return !ingresos.some(i => {
                let ingresoFecha = '';
                if (i.fecha && typeof i.fecha === 'string') {
                  // Si la fecha es string, normalizar separadores y ceros
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
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
          Ingreso manual
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="N° Factura"
            size="small"
            value={ingresoFactura}
            onChange={e => setIngresoFactura(e.target.value)}
            sx={{ flex: 2, minWidth: 120 }}
          />
          <TextField
            label="Monto ($)"
            type="number"
            size="small"
            value={ingresoMontoUSD}
            onChange={e => {
              const val = e.target.value;
              setIngresoMontoUSD(val);
              if (val !== "" && !isNaN(Number(val))) {
                setIngresoMontoBs((Number(val) * tasaBCV).toFixed(2));
              } else {
                setIngresoMontoBs("");
              }
            }}
            sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Monto (Bs)"
            type="number"
            size="small"
            value={ingresoMontoBs}
            onChange={e => {
              const val = e.target.value;
              setIngresoMontoBs(val);
              if (val !== "" && !isNaN(Number(val))) {
                setIngresoMontoUSD((Number(val) / tasaBCV).toFixed(2));
              } else {
                setIngresoMontoUSD("");
              }
            }}
            sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
            inputProps={{ min: 0 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAgregarIngreso}
            disabled={!ingresoFactura || (!ingresoMontoUSD && !ingresoMontoBs)}
          >
            Agregar
          </Button>
        </Box>
      </Box>
      <Table component={Paper} size="small" sx={{ mb: 2 }}>
        {/* Fila de total de ingresos al inicio */}
        <TableHead>
          <TableRow>
            <TableCell colSpan={7} sx={{ fontWeight: 700, bgcolor: '#e0f7fa', width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} className="w-100">
                <span>Total Ingresos</span>
                <span>
                  $ {ingresos.reduce((acc, ing) => acc + (Number(ing.monto) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  {' '}| Bs. {ingresos.reduce((acc, ing) => acc + (Number(ing.montoBs) || (Number(ing.monto) * tasaBCV) || 0), 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
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
                  {Math.abs(ing.monto).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {Math.abs(ing.montoBs || ing.monto * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>{ing.formaPago || '-'}</TableCell>
                <TableCell>{ing.referencia || '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
