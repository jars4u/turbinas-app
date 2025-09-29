import React, { useState, useEffect } from "react";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Timestamp } from "firebase/firestore";
import { guardarEgreso, obtenerEgresos } from "../lib/egresosFirebase";
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
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export default function Egresos({ tasaBCV, isOwner }) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [montoUSD, setMontoUSD] = useState("");
  const [montoBs, setMontoBs] = useState("");
  const [tasa, setTasa] = useState(tasaBCV || "");
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editIdx, setEditIdx] = useState(null);
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editMontoUSD, setEditMontoUSD] = useState("");
  const [editMontoBs, setEditMontoBs] = useState("");
    const [editTasa, setEditTasa] = useState(tasaBCV || "");

  useEffect(() => {
    obtenerEgresos().then((data) => {
      // Normalizar la fecha a formato dd/mm/yyyy para todos los egresos
      const egresosConFecha = data.map(e => {
        let fechaDate = null;
        let fechaStr = "";
        if (e.fecha && e.fecha.seconds) {
          fechaDate = new Date(e.fecha.seconds * 1000);
          const d = String(fechaDate.getDate()).padStart(2, '0');
          const m = String(fechaDate.getMonth() + 1).padStart(2, '0');
          const y = fechaDate.getFullYear();
          fechaStr = `${d}/${m}/${y}`;
        } else if (e.fecha && typeof e.fecha === 'string') {
          const parts = e.fecha.split(/[/-]/);
          if (parts.length === 3) {
            fechaStr = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
            fechaDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else {
            fechaStr = e.fecha;
            fechaDate = Date.parse(e.fecha) ? new Date(e.fecha) : null;
          }
        }
        return { ...e, _fechaDate: fechaDate, _fechaStr: fechaStr };
      });
      setEgresos(
        egresosConFecha.sort((a, b) => {
          const fechaA = a._fechaDate ? a._fechaDate.getTime() : 0;
          const fechaB = b._fechaDate ? b._fechaDate.getTime() : 0;
          return fechaB - fechaA;
        })
      );
      setLoading(false);
      // Seleccionar el día de hoy por defecto si existe
      const hoy = new Date();
      const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      const fechas = egresosConFecha.map(e => e._fechaStr).filter(Boolean);
      if (fechas.includes(hoyStr)) {
        setTimeout(() => setFechaSeleccionada(hoyStr), 0);
      } else if (fechas.length > 0) {
        setTimeout(() => setFechaSeleccionada(fechas[0]), 0);
      }
    });
  }, []);

  const handleAddEgreso = async () => {
    if (!descripcion || (!montoUSD && !montoBs)) return;
    let usd = montoUSD;
    let bs = montoBs;
    if (usd && tasa) {
      bs = (Number(usd) * Number(tasa)).toFixed(2);
    } else if (bs && tasa) {
      usd = (Number(bs) / Number(tasa)).toFixed(2);
    }
    const hoy = new Date();
    const d = String(hoy.getDate()).padStart(2, '0');
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const y = hoy.getFullYear();
    const egreso = {
      descripcion,
      montoUSD: Number(usd),
      montoBs: Number(bs),
      tasa: Number(tasa),
      fecha: `${d}/${m}/${y}`,
    };
    await guardarEgreso(egreso);
    const actualizados = await obtenerEgresos();
    const egresosConFecha = actualizados.map(e => {
      let fechaDate = null;
      let fechaStr = "";
      if (e.fecha && typeof e.fecha === 'string') {
        const parts = e.fecha.split(/[/-]/);
        if (parts.length === 3) {
          fechaStr = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
          fechaDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else {
          fechaStr = e.fecha;
          fechaDate = Date.parse(e.fecha) ? new Date(e.fecha) : null;
        }
      } else if (e.fecha && e.fecha.seconds) {
        fechaDate = new Date(e.fecha.seconds * 1000);
        const dd = String(fechaDate.getDate()).padStart(2, '0');
        const mm = String(fechaDate.getMonth() + 1).padStart(2, '0');
        const yy = fechaDate.getFullYear();
        fechaStr = `${dd}/${mm}/${yy}`;
      }
      return { ...e, _fechaDate: fechaDate, _fechaStr: fechaStr };
    });
    setEgresos(
      egresosConFecha.sort((a, b) => {
        const fechaA = a._fechaDate ? a._fechaDate.getTime() : 0;
        const fechaB = b._fechaDate ? b._fechaDate.getTime() : 0;
        return fechaB - fechaA;
      })
    );
    setFechaSeleccionada(`${d}/${m}/${y}`);
    setDescripcion("");
    setMontoUSD("");
    setMontoBs("");
    setTasa(tasaBCV || "");
  };

  // Eliminar egreso
  const handleDelete = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
      const firestore = getFirestore();
      await deleteDoc(doc(firestore, "egresos", deleteId));
      const actualizados = await obtenerEgresos();
      const egresosConFecha = actualizados.map(e => ({
        ...e,
        _fechaDate: e.fecha && e.fecha.toDate ? e.fecha.toDate() : (e.fecha && e.fecha.seconds ? new Date(e.fecha.seconds * 1000) : null)
      }));
      setEgresos(
        egresosConFecha.sort((a, b) => {
          const fechaA = a._fechaDate ? a._fechaDate.getTime() : 0;
          const fechaB = b._fechaDate ? b._fechaDate.getTime() : 0;
          return fechaB - fechaA;
        })
      );
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setDeleteId(null);
  };

  // Iniciar edición
  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditDescripcion(egresos[idx].descripcion);
    setEditMontoUSD(egresos[idx].montoUSD.toString());
    setEditMontoBs(egresos[idx].montoBs.toString());
    setEditTasa(egresos[idx].tasa ? egresos[idx].tasa.toString() : tasaBCV ? tasaBCV.toString() : "");
  };

  // Guardar edición
  const handleSaveEdit = async (id) => {
    if (!editDescripcion || (!editMontoUSD && !editMontoBs)) return;
    let usd = editMontoUSD;
    let bs = editMontoBs;
    let tasaEdit = editTasa || tasaBCV;
    if (usd && tasaEdit) {
      bs = (Number(usd) * Number(tasaEdit)).toFixed(2);
    } else if (bs && tasaEdit) {
      usd = (Number(bs) / Number(tasaEdit)).toFixed(2);
    }
    const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
    const firestore = getFirestore();
    await updateDoc(doc(firestore, "egresos", id), {
      descripcion: editDescripcion,
      montoUSD: Number(usd),
      montoBs: Number(bs),
      tasa: Number(tasaEdit),
      fecha: Timestamp.now(),
    });
    const actualizados = await obtenerEgresos();
    const egresosConFecha = actualizados.map(e => {
      let fechaDate = null;
      if (e.fecha && e.fecha.toDate) {
        fechaDate = e.fecha.toDate();
      } else if (e.fecha && e.fecha.seconds) {
        fechaDate = new Date(e.fecha.seconds * 1000);
      }
      return { ...e, _fechaDate: fechaDate };
    });
    setEgresos(
      egresosConFecha.sort((a, b) => {
        const fechaA = a._fechaDate ? a._fechaDate.getTime() : 0;
        const fechaB = b._fechaDate ? b._fechaDate.getTime() : 0;
        return fechaB - fechaA;
      })
    );
    setEditIdx(null);
    setEditDescripcion("");
    setEditMontoUSD("");
    setEditMontoBs("");
    setEditTasa("");
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditIdx(null);
    setEditDescripcion("");
    setEditMontoUSD("");
    setEditMontoBs("");
  };

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
    <Dialog open={confirmOpen} onClose={cancelDelete}>
      <DialogTitle>Confirmar eliminación</DialogTitle>
      <DialogContent>
        <DialogContentText>
          ¿Estás seguro que deseas eliminar este egreso? Esta acción no se puede deshacer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancelDelete} color="primary">Cancelar</Button>
        <Button onClick={confirmDelete} color="error" autoFocus>Eliminar</Button>
      </DialogActions>
    </Dialog>
    {/* Accordion para móviles, bloque normal para desktop */}
    <Box sx={{ mb: 2 }}>
      {/* xs: Accordion, sm+: bloque normal */}
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0 }}>
          Registrar egreso
        </Typography>
      </Box>
      <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            mb: 2,
            pt: 1,
            flexWrap: "nowrap",
            overflowX: "auto",
          }}
        >
          <TextField
            label="Tasa"
            type="number"
            value={tasa}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              setTasa(val);
              // Actualizar los montos si ya hay valores
              if (montoUSD && val) {
                setMontoBs((Number(montoUSD) * Number(val)).toFixed(2));
              } else if (montoBs && val) {
                setMontoUSD((Number(montoBs) / Number(val)).toFixed(2));
              }
            }}
            size="small"
            sx={{ maxWidth: 120 }}
          />
          <TextField
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Monto ($)"
            type="number"
            value={montoUSD}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              setMontoUSD(val);
              if (tasa && val) {
                setMontoBs((Number(val) * Number(tasa)).toFixed(2));
              } else {
                setMontoBs("");
              }
            }}
            size="small"
            sx={{ maxWidth: 120 }}
          />
          <TextField
            label="Monto (Bs)"
            type="number"
            value={montoBs}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              setMontoBs(val);
              if (tasa && val) {
                setMontoUSD((Number(val) / Number(tasa)).toFixed(2));
              } else {
                setMontoUSD("");
              }
            }}
            size="small"
            sx={{ maxWidth: 120 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddEgreso}
            disabled={!descripcion || !montoUSD}
          >
            +
          </Button>
        </Box>
      </Box>
      {/* Accordion para xs */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<span>▼</span>}>
            <Typography variant="h6">Registrar egreso</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                pt: 1,
              }}
            >
              <TextField
                label="Tasa"
                type="number"
                value={tasa}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setTasa(val);
                  if (montoUSD && val) {
                    setMontoBs((Number(montoUSD) * Number(val)).toFixed(2));
                  } else if (montoBs && val) {
                    setMontoUSD((Number(montoBs) / Number(val)).toFixed(2));
                  }
                }}
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="Descripción"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                size="small"
                fullWidth
                sx={{ mb: 1 }}
              />
              <TextField
                label="Monto ($)"
                type="number"
                value={montoUSD}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setMontoUSD(val);
                  if (tasa && val) {
                    setMontoBs((Number(val) * Number(tasa)).toFixed(2));
                  } else {
                    setMontoBs("");
                  }
                }}
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="Monto (Bs)"
                type="number"
                value={montoBs}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setMontoBs(val);
                  if (tasa && val) {
                    setMontoUSD((Number(val) / Number(tasa)).toFixed(2));
                  } else {
                    setMontoUSD("");
                  }
                }}
                size="small"
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddEgreso}
                disabled={!descripcion || !montoUSD}
                sx={{ mb: 1 }}
              >
                Agregar
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Egresos registrados
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
      minDate={egresos.length > 0 ? (() => {
        const fechas = egresos.map(e => e._fechaStr).filter(Boolean);
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
        return !egresos.some(e => e._fechaStr === fechaStr);
      }}
    />
  </LocalizationProvider>
      </Box>
      <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
        <Table component={Paper} size="small" sx={{ mb: 2, minWidth: 400 }}>
        <TableHead>
          {/* Fila de total de egresos al inicio */}
          <TableRow>
            <TableCell colSpan={6} sx={{ fontWeight: 700, bgcolor: '#ffe0e0', width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Total Egresos</span>
                <span>
                  $ {egresos.reduce((acc, eg) => acc + (Number(eg.montoUSD) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  {' '}| Bs. {egresos.reduce((acc, eg) => acc + (Number(eg.montoBs) || (Number(eg.montoUSD) * tasaBCV) || 0), 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </span>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell align="right">Monto ($)</TableCell>
            <TableCell align="right">Monto (Bs)</TableCell>
            <TableCell align="right">Tasa</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ p: 0 }}>
                <LinearProgress sx={{ width: '100%' }} />
              </TableCell>
            </TableRow>
          ) : egresos.filter(e => e._fechaStr === fechaSeleccionada).length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                align="center"
                sx={{ color: "text.secondary" }}
              >
                Sin egresos registrados
              </TableCell>
            </TableRow>
          ) : (
            egresos.filter(e => e._fechaStr === fechaSeleccionada).map((e, idx) => (
              <TableRow key={e.id || idx}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {e._fechaDate
                    ? e._fechaDate.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "-"}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {editIdx === idx ? (
                    <TextField
                      value={editDescripcion}
                      onChange={(ev) => setEditDescripcion(ev.target.value)}
                      size="small"
                      fullWidth
                      sx={{ whiteSpace: 'nowrap' }}
                    />
                  ) : (
                    e.descripcion
                  )}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {editIdx === idx ? (
                    <TextField
                      value={editMontoUSD}
                      onChange={(ev) => {
                        const val = ev.target.value.replace(/[^0-9.]/g, "");
                        setEditMontoUSD(val);
                        if (editTasa && val) {
                          setEditMontoBs((Number(val) * Number(editTasa)).toFixed(2));
                        } else {
                          setEditMontoBs("");
                        }
                      }}
                      size="small"
                      sx={{ maxWidth: 90, whiteSpace: 'nowrap' }}
                    />
                  ) : (
                    e.montoUSD.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  )}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {editIdx === idx ? (
                    <TextField
                      value={editMontoBs}
                      onChange={(ev) => {
                        const val = ev.target.value.replace(/[^0-9.]/g, "");
                        setEditMontoBs(val);
                        if (editTasa && val) {
                          setEditMontoUSD((Number(val) / Number(editTasa)).toFixed(2));
                        } else {
                          setEditMontoUSD("");
                        }
                      }}
                      size="small"
                      sx={{ maxWidth: 90 }}
                    />
                  ) : (
                    e.montoBs.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  )}
                </TableCell>
                <TableCell align="right">
                  {editIdx === idx ? (
                    <TextField
                      label="Tasa"
                      type="number"
                      value={editTasa}
                      onChange={(ev) => {
                        const val = ev.target.value.replace(/[^0-9.]/g, "");
                        setEditTasa(val);
                        // Actualizar los montos si ya hay valores
                        if (editMontoUSD && val) {
                          setEditMontoBs((Number(editMontoUSD) * Number(val)).toFixed(2));
                        } else if (editMontoBs && val) {
                          setEditMontoUSD((Number(editMontoBs) / Number(val)).toFixed(2));
                        }
                      }}
                      size="small"
                      sx={{ maxWidth: 90 }}
                    />
                  ) : (
                    e.tasa ? e.tasa.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (tasaBCV ? tasaBCV.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-")
                  )}
                </TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, whiteSpace: 'nowrap', justifyContent: 'center' }}>
                    {editIdx === idx ? (
                      <>
                        <Button
                          color="success"
                          size="small"
                          onClick={() => handleSaveEdit(e.id)}
                          sx={{ minWidth: 32 }}
                        >
                          Guardar
                        </Button>
                        <Button
                          color="error"
                          size="small"
                          onClick={handleCancelEdit}
                          sx={{ minWidth: 32 }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        {isOwner ? (
                          <>
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() => handleEdit(idx)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleDelete(e.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              color="primary"
                              size="small"
                              disabled
                              title="Solo el Owner puede editar egresos"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              disabled
                              title="Solo el Owner puede eliminar egresos"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </Box>
    </Box>
  );
}
