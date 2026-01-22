import React, { useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Paper,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import CloseIcon from "@mui/icons-material/Close";
import AddTaskIcon from "@mui/icons-material/AddTask";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import TodayIcon from "@mui/icons-material/Today";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { getWeekRangeLocal } from "../lib/dateUtils";

// Reporte semanal/día: muestra L–V y totales. Autónomo y sin dependencias externas.
export default function ReporteDia({ open, onClose, servicios = [], fecha }) {
  

  const formatLocalYMD = React.useCallback((d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const y = String(d.getFullYear()).padStart(4, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const formatYMDToDMY = React.useCallback((v) => {
    if (!v) return "";
    if (v instanceof Date) {
      const d = v;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear()).padStart(4, '0');
      return `${dd}/${mm}/${yyyy}`;
    }
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return v;
    }
    return String(v);
  }, []);

  const todayStr = formatLocalYMD(new Date());

  const [semanaBase, setSemanaBase] = React.useState(() => {
    if (fecha instanceof Date) return formatLocalYMD(fecha);
    if (typeof fecha === 'string' && fecha.length >= 10) return fecha.slice(0, 10);
    return todayStr;
  });

  const semana = useMemo(() => getWeekRangeLocal(semanaBase), [semanaBase]);
  const diasES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const regSetsRef = React.useRef({});
  const entSetsRef = React.useRef({});
  const [detalleDia, setDetalleDia] = React.useState({ open: false, dia: null });
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const { registradosPorDia, entregadosPorDia, totalRegistrados, totalEntregados } = useMemo(() => {
    const rpd = {};
    const epd = {};
    let totalR = 0;
    let totalE = 0;
    let registradosHoyCount = 0;
    let inicio = 0;

    const monday = semana?.mondayStr;

    // Crear sets por día para deduplicar
    const regSets = {};
    const entSets = {};
    (semana?.days || []).forEach(d => { regSets[d] = new Set(); entSets[d] = new Set(); });

    // Set para inicio de semana (deduplicado)
    const inicioSet = new Set();

    servicios.forEach(s => {
      const key = s.id || s._id || s.vehiculo || JSON.stringify(s);
      const regDate = s.arrivalTime ? formatLocalYMD(new Date(s.arrivalTime)) : (s.fechaRegistro ? String(s.fechaRegistro).slice(0, 10) : null);
      const entDate = s.fechaEntrega ? formatLocalYMD(new Date(s.fechaEntrega)) : null;

      if (monday) {
        if (regDate && regDate < monday && (!entDate || entDate >= monday)) inicioSet.add(key);
      }

      (semana?.days || []).forEach(dia => {
        let countedReg = false;
        let countedEnt = false;

        if (regDate === dia) countedReg = true;
        if (!countedReg && Array.isArray(s.historial)) {
          countedReg = s.historial.some(h => {
            const hDate = h.fecha ? formatLocalYMD(new Date(h.fecha)) : null;
            return hDate === dia && (h.nuevoEstado === 'registrado' || h.estado === 'registrado');
          });
        }

        if (entDate === dia) countedEnt = true;
        if (!countedEnt && Array.isArray(s.historial)) {
          countedEnt = s.historial.some(h => {
            const hDate = h.fecha ? formatLocalYMD(new Date(h.fecha)) : null;
            return hDate === dia && (h.nuevoEstado === 'entregado' || h.estado === 'entregado');
          });
        }

        if (countedReg) regSets[dia].add(key);
        if (countedEnt) entSets[dia].add(key);
      });
    });

    // Convertir sets en counts
    (semana?.days || []).forEach(d => {
      const rCount = regSets[d]?.size || 0;
      const eCount = entSets[d]?.size || 0;
      rpd[d] = rCount;
      epd[d] = eCount;
      totalR += rCount;
      totalE += eCount;
    });

    registradosHoyCount = regSets[todayStr] ? regSets[todayStr].size : 0;
    inicio = inicioSet.size;

    // Exponer sets para uso fuera del memo (handler de detalle)
    try { regSetsRef.current = regSets; entSetsRef.current = entSets; } catch (e) { }

    // Logs para depuración: mostrar siempre qué servicios se cuentan el lunes
    try {
      if (typeof window !== 'undefined') {
        const mondayKey = monday;
        console.group('[ReporteDia] Detalle Lunes', { monday: mondayKey });
        const mondayKeys = Array.from(regSets[mondayKey] || []);
        console.log('Keys contadas para Lunes:', mondayKeys);
        console.log('Conteo por día (muestras):', Object.fromEntries(Object.keys(regSets).map(k => [k, regSets[k].size])));

        // Mostrar tabla con detalles por key: regDate, entDate, vehiculo y resumen de historial
        const mondayDetails = mondayKeys.map(k => {
          const s = servicios.find(x => (x.id || x._id || x.vehiculo || JSON.stringify(x)) === k) || {};
          return {
            key: k,
            vehiculo: s.vehiculo ?? null,
            regDate: s.arrivalTime ? formatLocalYMD(new Date(s.arrivalTime)) : (s.fechaRegistro ? String(s.fechaRegistro).slice(0, 10) : null),
            entDate: s.fechaEntrega ? formatLocalYMD(new Date(s.fechaEntrega)) : null,
            historial: Array.isArray(s.historial) ? s.historial.map(h => ({ fecha: h.fecha, estado: h.nuevoEstado || h.estado })) : undefined
          };
        });
        if (mondayDetails.length) console.table(mondayDetails);
        console.groupEnd();
      }
    } catch (e) {
      // no-op
    }

    return { registradosPorDia: rpd, entregadosPorDia: epd, totalRegistrados: totalR, totalEntregados: totalE, registradosHoy: registradosHoyCount, inicioSemana: inicio };
  }, [servicios, semana, formatLocalYMD, todayStr]);

  const cambiarSemana = (dir) => {
    // parse semanaBase (YYYY-MM-DD) robustly to avoid timezone issues
    const parseYMD = (s) => {
      if (!s || typeof s !== 'string') return new Date();
      const parts = s.split('-').map(n => parseInt(n, 10));
      if (parts.length < 3 || parts.some(Number.isNaN)) return new Date(s);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };
    const baseDate = parseYMD(semanaBase || semana?.mondayStr || todayStr);
    baseDate.setDate(baseDate.getDate() + dir * 7);
    setSemanaBase(formatLocalYMD(baseDate));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 0 }}>
        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            Reporte semanal
          </Typography>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar"><CloseIcon /></IconButton>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'center', gap: 1 }}>
          <TodayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Tooltip title="Semana anterior"><IconButton onClick={() => cambiarSemana(-1)} size="small"><ArrowBackIosNewIcon fontSize="small" /></IconButton></Tooltip>
          <Typography variant="body2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.6 }}>
            {formatYMDToDMY(semana?.mondayStr) || ''} — {formatYMDToDMY(semana?.fridayStr) || ''}
          </Typography>
          <Tooltip title="Semana siguiente"><IconButton onClick={() => cambiarSemana(1)} size="small"><ArrowForwardIosIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {/* Estadísticas resumidas eliminadas: usar detalle por fila */}

        {isSmall ? (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddTaskIcon color="warning" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totalRegistrados}</Typography>
                <Typography variant="caption" color="text.secondary">Registrados</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DoneAllIcon color="success" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totalEntregados}</Typography>
                <Typography variant="caption" color="text.secondary">Entregados</Typography>
              </Box>
            </Box>
            {(semana?.days || []).map((dia, idx) => (
              <Paper key={dia} elevation={0} sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderRadius: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{diasES[idx]}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYMDToDMY(dia)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <AddTaskIcon color="warning" />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{registradosPorDia[dia] ?? 0}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <DoneAllIcon color="success" />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{entregadosPorDia[dia] ?? 0}</Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setDetalleDia({ open: true, dia })} aria-label={`Detalle ${dia}`}>
                  <TodayIcon />
                </IconButton>
              </Paper>
            ))}
          </Box>
        ) : (
          <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'background.default' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Día</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}><AddTaskIcon color="warning" sx={{ verticalAlign: 'middle', mr: 0.5 }} />Registrados</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}><DoneAllIcon color="success" sx={{ verticalAlign: 'middle', mr: 0.5 }} />Entregados</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>Detalle</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ '& tr:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                {(semana?.days || []).map((dia, idx) => (
                  <TableRow key={dia} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{diasES[idx] || dia}</TableCell>
                    <TableCell align="center">{registradosPorDia[dia] ?? 0}</TableCell>
                    <TableCell align="center">{entregadosPorDia[dia] ?? 0}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalles">
                        <IconButton size="small" onClick={() => setDetalleDia({ open: true, dia })}>
                          <TodayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'background.paper' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{totalRegistrados}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{totalEntregados}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        )}
      </DialogContent>
      {/* Dialog para mostrar detalle de servicios por día */}
      <Dialog open={detalleDia.open} onClose={() => setDetalleDia({ open: false, dia: null })} maxWidth="xs" fullWidth>
        {isSmall ? (
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <IconButton size="small" onClick={() => setDetalleDia({ open: false, dia: null })}><CloseIcon /></IconButton>
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={800}>Detalle</Typography>
              <Typography variant="caption" color="text.secondary">{formatYMDToDMY(detalleDia.dia) || ''}</Typography>
            </Box>
            <Box sx={{ width: 36 }} />
          </DialogTitle>
        ) : (
          <DialogTitle sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Detalle — {formatYMDToDMY(detalleDia.dia) || ''}</Typography>
              <Typography variant="caption" color="text.secondary">Servicios registrados / entregados</Typography>
            </Box>
            <IconButton size="small" onClick={() => setDetalleDia({ open: false, dia: null })} sx={{ alignSelf: 'flex-end' }}><CloseIcon /></IconButton>
          </DialogTitle>
        )}
        <Divider />
        <DialogContent sx={{ p: 2, maxHeight: isSmall ? '50vh' : '60vh', overflow: 'auto' }}>
          {detalleDia.dia ? (() => {
            const regKeys = Array.from((regSetsRef.current && regSetsRef.current[detalleDia.dia]) || []);
            const entKeys = Array.from((entSetsRef.current && entSetsRef.current[detalleDia.dia]) || []);
            const union = Array.from(new Set([...regKeys, ...entKeys]));
            const items = union.map(k => {
              const s = servicios.find(x => (x.id || x._id || x.vehiculo || JSON.stringify(x)) === k) || {};
              return {
                key: k,
                vehiculo: s.vehiculo || s.placa || null,
                regDate: s.arrivalTime ? formatLocalYMD(new Date(s.arrivalTime)) : (s.fechaRegistro ? String(s.fechaRegistro).slice(0, 10) : null),
                entDate: s.fechaEntrega ? formatLocalYMD(new Date(s.fechaEntrega)) : null,
                registrado: regKeys.includes(k),
                entregado: entKeys.includes(k)
              };
            });

            if (isSmall) {
              return (
                <Box>
                  <Box sx={{ display: 'flex', gap: 2, mb: 0.5, justifyContent: 'center  ' }}>
                    <Typography variant="body2">Registrados: <strong>{regKeys.length}</strong></Typography>
                    <Typography variant="body2">Entregados: <strong>{entKeys.length}</strong></Typography>
                  </Box>
                  <List disablePadding sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                    {items.map(it => (
                      <ListItem key={it.key} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <ListItemText
                          primary={it.vehiculo || it.key}
                          primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                          secondary={
                            <span>
                              <Typography component="span" variant="caption" color="text.secondary">Reg: {it.regDate ? formatYMDToDMY(it.regDate) : '-'} </Typography>
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>Ent: {it.entDate ? formatYMDToDMY(it.entDate) : '-'}</Typography>
                            </span>
                          }
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, ml: 1, alignItems: 'center' }}>
                          {it.registrado ? (
                            <Tooltip title="Registrado">
                              <AddTaskIcon color="warning" fontSize="small" />
                            </Tooltip>
                          ) : null}
                          {it.entregado ? (
                            <Tooltip title="Entregado">
                              <DoneAllIcon color="success" fontSize="small" />
                            </Tooltip>
                          ) : null}
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              );
            }

            return (
              <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Typography variant="subtitle1">Registrados: <strong>{regKeys.length}</strong></Typography>
                  <Typography variant="subtitle1">Entregados: <strong>{entKeys.length}</strong></Typography>
                </Box>
                <Paper elevation={0} sx={{ maxHeight: 220, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vehículo</TableCell>
                        <TableCell>Registro</TableCell>
                        <TableCell>Entrega</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map(it => (
                        <TableRow key={it.key}>
                          <TableCell>{it.vehiculo || it.key}</TableCell>
                          <TableCell>{it.regDate ? formatYMDToDMY(it.regDate) : '-'}</TableCell>
                          <TableCell>{it.entDate ? formatYMDToDMY(it.entDate) : '-'}</TableCell>
                          <TableCell>
                            {it.registrado && it.entregado ? <Chip label="Registrado / Entregado" size="small" color="primary" /> : (it.entregado ? <Chip label="Entregado" size="small" color="success" /> : <Chip label="Registrado" size="small" color="warning" />)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
