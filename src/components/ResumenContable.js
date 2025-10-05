import React, { useEffect, useState } from "react";
import Skeleton from '@mui/material/Skeleton';
import dayjs from "dayjs";
import { obtenerIngresos } from "../lib/ingresosFirebase";
import { obtenerEgresos } from "../lib/egresosFirebase";
import { obtenerCierresDiarios } from "../lib/cierresDiariosFirebase";
import {
  Box,
  Typography,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TextField,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from '@mui/x-date-pickers';
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function agruparPorDia(arr, tipo) {
  return arr.reduce((acc, item) => {
    let fecha = "-";
    let d, m, y;
    if (item._fechaDate instanceof Date) {
      d = String(item._fechaDate.getDate()).padStart(2, "0");
      m = String(item._fechaDate.getMonth() + 1).padStart(2, "0");
      y = item._fechaDate.getFullYear();
    } else if (item.fecha) {
      const parts = item.fecha.split("/");
      if (parts.length === 3) {
        d = String(parts[0]).padStart(2, "0");
        m = String(parts[1]).padStart(2, "0");
        y = parts[2];
      }
    }
    if (d && m && y) {
      fecha = `${d}/${m}/${y}`;
    }
    if (!acc[fecha]) acc[fecha] = { ingresos: [], egresos: [] };
    acc[fecha][tipo === "ingreso" ? "ingresos" : "egresos"].push(item);
    return acc;
  }, {});
}

export default function ResumenContable({ tasaBCV }) {
  const [datosPorDia, setDatosPorDia] = useState({});
  const [cierresPorDia, setCierresPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);

  useEffect(() => {
    // Consultar ingresos, egresos y cierres diarios
    Promise.all([
      obtenerIngresos(),
      obtenerEgresos(),
      obtenerCierresDiarios(),
    ]).then(([ingresos, egresos, cierres]) => {
      const ingresosMap = ingresos.map((i) => ({
        ...i,
        _fechaDate:
          i.fecha && i.fecha.seconds ? new Date(i.fecha.seconds * 1000) : null,
      }));
      const egresosMap = egresos.map((e) => ({
        ...e,
        _fechaDate:
          e.fecha && e.fecha.seconds ? new Date(e.fecha.seconds * 1000) : null,
      }));
      let agrupados = agruparPorDia(ingresosMap, "ingreso");
      agrupados = Object.entries(agruparPorDia(egresosMap, "egreso")).reduce(
        (acc, [fecha, val]) => {
          if (!acc[fecha]) acc[fecha] = { ingresos: [], egresos: [] };
          acc[fecha].egresos = val.egresos;
          return acc;
        },
        agrupados
      );
      setDatosPorDia(agrupados);

      // Mapear cierres por fecha (dd/mm/yyyy)
      const cierresMap = {};
      cierres.forEach((cierre) => {
        let fecha = "-";
        if (cierre.fecha && cierre.fecha.seconds) {
          const d = String(
            new Date(cierre.fecha.seconds * 1000).getDate()
          ).padStart(2, "0");
          const m = String(
            new Date(cierre.fecha.seconds * 1000).getMonth() + 1
          ).padStart(2, "0");
          const y = new Date(cierre.fecha.seconds * 1000).getFullYear();
          fecha = `${d}/${m}/${y}`;
        } else if (cierre.fechaStr) {
          fecha = cierre.fechaStr;
        }
        cierresMap[fecha] = cierre;
      });
      setCierresPorDia(cierresMap);
      setLoading(false);

      // Seleccionar el día de hoy por defecto si existe, si no el más cercano con información
      const hoy = new Date();
      const hoyStr = `${String(hoy.getDate()).padStart(2, "0")}/${String(
        hoy.getMonth() + 1
      ).padStart(2, "0")}/${hoy.getFullYear()}`;
      const fechas = Object.keys(agrupados).sort((a, b) => {
        const fa = Date.parse(a.split("/").reverse().join("-"));
        const fb = Date.parse(b.split("/").reverse().join("-"));
        return Math.abs(fa - Date.parse(hoyStr.split("/").reverse().join("-"))) - Math.abs(fb - Date.parse(hoyStr.split("/").reverse().join("-")));
      });
      let fechaInicial = hoyStr;
      if (fechas.includes(hoyStr)) {
        setFechaSeleccionada(hoyStr);
        fechaInicial = hoyStr;
      } else if (fechas.length > 0) {
        // Seleccionar el día más reciente (mayor fecha) con información
        const fechasOrdenadas = fechas.sort((a, b) => {
          const fa = Date.parse(a.split('/').reverse().join('-'));
          const fb = Date.parse(b.split('/').reverse().join('-'));
          return fb - fa;
        });
        const fechaMasReciente = fechasOrdenadas[0];
        setFechaSeleccionada(fechaMasReciente);
        fechaInicial = fechaMasReciente;
      }
      // Sincronizar el DatePicker con la fecha seleccionada
      const [d, m, y] = fechaInicial.split('/');
      const fechaDayjs = window.dayjs ? window.dayjs(`${y}-${m}-${d}`) : require('dayjs')(`${y}-${m}-${d}`);
      setFechaInicio(fechaDayjs);
      setFechaFin(fechaDayjs);
    });
  }, []);

  if (loading) return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton variant="text" width={180} height={38} />
        <Skeleton variant="rectangular" width={160} height={38} />
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
      <Skeleton variant="text" width={220} height={32} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'center' },
          justifyContent: { xs: 'center', sm: 'space-between' },
          mb: 2,
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Typography
          variant="h5"
          fontWeight={700}
          gutterBottom
          sx={{ textAlign: { xs: 'center', sm: 'left' }, width: { xs: '100%', sm: 'auto' } }}
        >
          Resumen diario
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Desde"
              value={fechaInicio}
              onChange={setFechaInicio}
              renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 120 }} />}
              disableFuture
              minDate={
                Object.keys(datosPorDia).length > 0
                  ? dayjs(
                    Object.keys(datosPorDia)
                      .sort((a, b) => {
                        const fa = Date.parse(
                          a.split("/").reverse().join("-")
                        );
                        const fb = Date.parse(
                          b.split("/").reverse().join("-")
                        );
                        return fa - fb;
                      })[0]
                      .split("/")
                      .reverse()
                      .join("-")
                  )
                  : undefined
              }
              maxDate={fechaFin || dayjs().startOf("day")}
            />
            <Box sx={{ mx: 1 }}>a</Box>
            <DatePicker
              label="Hasta"
              value={fechaFin}
              onChange={setFechaFin}
              renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 120 }} />}
              disableFuture
              minDate={fechaInicio || (Object.keys(datosPorDia).length > 0
                ? dayjs(
                  Object.keys(datosPorDia)
                    .sort((a, b) => {
                      const fa = Date.parse(
                        a.split("/").reverse().join("-")
                      );
                      const fb = Date.parse(
                        b.split("/").reverse().join("-")
                      );
                      return fa - fb;
                    })[0]
                    .split("/")
                    .reverse()
                    .join("-")
                )
                : undefined)}
              maxDate={dayjs().startOf("day")}
            />
          </LocalizationProvider>
        </Box>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {Object.keys(datosPorDia).length === 0 ? (
        <Typography color="text.secondary">
          No hay datos registrados.
        </Typography>
      ) : (
        <>
          {(() => {
            // Si hay rango de fechas seleccionado, filtrar y acumular
            let fechasFiltradas = [];
            if (fechaInicio && fechaFin) {
              // Normalizar fechas a formato DD/MM/YYYY para comparar correctamente
              const start = fechaInicio.startOf('day');
              const end = fechaFin.startOf('day');
              fechasFiltradas = Object.keys(datosPorDia).filter(f => {
                // f ya está en formato DD/MM/YYYY
                const [d, m, y] = f.split('/');
                // Comparar usando dayjs para evitar problemas de zona horaria
                const fecha = dayjs(`${y}-${m}-${d}`);
                // Incluir la fecha de inicio y fin
                return fecha.isValid() && (fecha.isAfter(start) || fecha.isSame(start, 'day')) && (fecha.isBefore(end) || fecha.isSame(end, 'day'));
              }).sort((a, b) => {
                const fa = Date.parse(a.split("/").reverse().join("-"));
                const fb = Date.parse(b.split("/").reverse().join("-"));
                return fa - fb;
              });
            } else if (fechaSeleccionada) {
              fechasFiltradas = [fechaSeleccionada];
            }
            if (fechasFiltradas.length === 0) {
              return <Typography color="text.secondary">No hay datos en el rango seleccionado.</Typography>;
            }
            // Acumular ingresos y egresos de todas las fechas seleccionadas
            let ingresos = [];
            let egresos = [];
            let cierres = [];
            fechasFiltradas.forEach(f => {
              if (datosPorDia[f]) {
                ingresos = ingresos.concat(datosPorDia[f].ingresos);
                egresos = egresos.concat(datosPorDia[f].egresos);
              }
              if (cierresPorDia[f]) {
                cierres.push(cierresPorDia[f]);
              }
            });
            // Usar la tasa histórica del último cierre del rango, si existe
            const cierre = cierres.length > 0 ? cierres[cierres.length - 1] : undefined;
            const tasaHistorica = cierre?.tasa ?? tasaBCV;
            // Sumar todos los montos de formasPago en los ingresos
            let totalIngresosUSD = ingresos.reduce((acc, i) => {
              if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                return acc + i.formasPago.reduce((sum, fp) => sum + (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0), 0);
              }
              return acc + Number(i.montoUSD || i.monto || 0);
            }, 0);
            let totalIngresosBs = tasaHistorica ? totalIngresosUSD * tasaHistorica : ingresos.reduce((acc, i) => acc + (Number(i.montoBs) || 0), 0);
            let totalEgresosUSD = egresos.reduce((acc, e) => acc + (Number(e.montoUSD) || 0), 0);
            let totalEgresosBs = egresos.reduce((acc, e) => acc + (Number(e.montoBs) || 0), 0);
            let utilidadUSD = totalIngresosUSD - totalEgresosUSD;
            // Agrupar ingresos por forma de pago, sumando todos los montos de formasPago
            const pagosPorForma = ingresos.reduce((acc, i) => {
              if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                i.formasPago.forEach(fp => {
                  const forma = (fp.formaPago || "Sin especificar").toUpperCase();
                  if (!acc[forma]) acc[forma] = 0;
                  acc[forma] += fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0;
                });
              } else {
                const forma = (i.formaPago || "Sin especificar").toUpperCase();
                if (!acc[forma]) acc[forma] = 0;
                acc[forma] += Number(i.montoUSD || i.monto || 0);
              }
              return acc;
            }, {});
            return (
              <Box key={fechasFiltradas.join('-')} sx={{ mb: 4 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{ mb: 1 }}
                >
                  {fechaInicio && fechaFin
                    ? `Rango: ${fechaInicio.format('DD/MM/YYYY')} a ${fechaFin.format('DD/MM/YYYY')}`
                    : `Fecha: ${fechasFiltradas[0]}`}
                </Typography>
                {/* ...el resto del renderizado permanece igual... */}
                {/* <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ mb: 1 }}
                  >
                    Fecha: {fechaSeleccionada}
                  </Typography> */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: "#f5f5f5" }}>
                  {/* Tasa BCV en bloque al inicio para móviles */}
                  <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 1 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Tasa BCV:{" "}
                      {cierre?.tasa
                        ? `${cierre.tasa.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })} (histórica)`
                        : tasaBCV
                          ? `${tasaBCV.toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                          })}`
                          : "No disponible"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: { xs: 'flex-start', sm: 'space-between' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                    }}
                  >
                    <Typography>
                      <b>Ingresos totales:</b>
                      {(() => {
                        // Sumar todos los montos en USD y Bs, sin conversión
                        let totalUSD = 0;
                        let totalBs = 0;
                        ingresos.forEach(i => {
                          // Sumar monto USD principal si existe
                          if (i.monto !== undefined && i.monto !== null && !isNaN(Number(i.monto))) {
                            totalUSD += Number(i.monto);
                          }
                          // Sumar montoBs principal si existe
                          if (i.montoBs !== undefined && i.montoBs !== null && !isNaN(Number(i.montoBs))) {
                            totalBs += Number(i.montoBs);
                          }
                          // Sumar montos de formasPago si existen
                          if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                            i.formasPago.forEach(fp => {
                              if (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                                totalUSD += Number(fp.monto);
                              }
                              if (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) {
                                totalBs += Number(fp.montoBs);
                              }
                            });
                          }
                        });
                        return ` $ ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. ${totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
                      })()}
                    </Typography>
                    {/* Tasa BCV en línea para desktop */}
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 2 }}
                      >
                        Tasa BCV:{" "}
                        {cierre?.tasa
                          ? `${cierre.tasa.toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                          })} (histórica)`
                          : tasaBCV
                            ? `${tasaBCV.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                            })}`
                            : "No disponible"}
                      </Typography>
                    </Box>
                  </Box>
                  {/* Mostrar montos por forma de pago como subtítulo */}
                  <Box sx={{ mb: 1, mt: 1 }}>
                    {(() => {
                      // Agrupar montos por forma de pago y divisa (insensible a mayúsculas y espacios)
                      const desglose = {};
                      ingresos.forEach(i => {
                        // Procesar formasPago
                        if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                          i.formasPago.forEach(fp => {
                            const formaNorm = (fp.formaPago || "Sin especificar").trim().toLowerCase();
                            if (!desglose[formaNorm]) desglose[formaNorm] = { usd: 0, bs: 0 };
                            // Sumar montoBs si existe
                            if (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) {
                              desglose[formaNorm].bs += Number(fp.montoBs);
                            }
                            // Sumar monto USD si existe y no es pago movil
                            if (formaNorm !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              desglose[formaNorm].usd += Number(fp.monto);
                            }
                          });
                        }
                        // Procesar campo principal
                        const formaPrincipalNorm = (i.formaPago || "sin especificar").trim().toLowerCase();
                        // Si el montoBs existe y la forma principal es 'pago movil', sumar bajo 'pago movil'
                        if (i.montoBs !== undefined && i.montoBs !== null && !isNaN(Number(i.montoBs))) {
                          if (formaPrincipalNorm === 'pago movil' || formaPrincipalNorm === '' || formaPrincipalNorm === 'sin especificar' || formaPrincipalNorm === null) {
                            if (!desglose['pago movil']) desglose['pago movil'] = { usd: 0, bs: 0 };
                            desglose['pago movil'].bs += Number(i.montoBs);
                          }
                        }
                        // Sumar monto USD si existe y no es pago movil
                        if (formaPrincipalNorm !== 'pago movil' && i.monto !== undefined && i.monto !== null && !isNaN(Number(i.monto))) {
                          if (!desglose[formaPrincipalNorm]) desglose[formaPrincipalNorm] = { usd: 0, bs: 0 };
                          desglose[formaPrincipalNorm].usd += Number(i.monto);
                        }
                      });
                      return Object.entries(desglose)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .filter(([formaNorm, montos]) => {
                          // Ocultar 'sin especificar' si ambos montos son cero
                          if (formaNorm === 'sin especificar') {
                            return (montos.usd > 0 || montos.bs > 0);
                          }
                          return true;
                        })
                        .map(([formaNorm, montos]) => {
                          // Capitalizar la forma de pago para mostrarla correctamente
                          const nombreMostrar = formaNorm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                          const esPagoMovil = formaNorm === 'pago movil';
                          return (
                            <Typography
                              key={nombreMostrar}
                              variant="body2"
                              sx={{ mb: 0.5, pl: 1 }}
                            >
                              <b>{nombreMostrar}:</b>
                              {/* Para pago movil, mostrar solo Bs; para otros, solo USD */}
                              {esPagoMovil
                                ? (typeof montos.bs === 'number' && !isNaN(montos.bs)
                                    ? <span> Bs. {montos.bs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                                    : montos.bs === 0
                                      ? <span> Bs. 0,00</span>
                                      : <span> - </span>)
                                : (typeof montos.usd === 'number' && !isNaN(montos.usd)
                                    ? <span> $ {montos.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                    : <span> - </span>)}
                            </Typography>
                          );
                        });
                    })()}
                  </Box>
                  <Typography>
                    <b>Egresos totales:</b>
                    {(() => {
                      // Sumar por separado los montos en USD y Bs según la divisa y forma de pago
                      let totalUSD = 0;
                      let totalBs = 0;
                      egresos.forEach(e => {
                        if (Array.isArray(e.formasPago) && e.formasPago.length > 0) {
                          e.formasPago.forEach(fp => {
                            if (fp.formaPago && fp.formaPago.toLowerCase() === 'pago movil') {
                              // Solo sumar montoBs para pago movil
                              if (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) {
                                totalBs += Number(fp.montoBs);
                              }
                            } else {
                              // Para otras formas, solo sumar monto USD si existe
                              if (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                                totalUSD += Number(fp.monto);
                              }
                            }
                          });
                        } else {
                          // Si no hay formasPago, decidir por la divisa
                          if (e.formaPago && e.formaPago.toLowerCase() === 'pago movil') {
                            if (e.montoBs !== undefined && e.montoBs !== null && !isNaN(Number(e.montoBs))) {
                              totalBs += Number(e.montoBs);
                            }
                          } else {
                            if (e.monto !== undefined && e.monto !== null && !isNaN(Number(e.monto))) {
                              totalUSD += Number(e.monto);
                            }
                          }
                        }
                      });
                      return ` $ ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. ${totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
                    })()}
                  </Typography>
                  <Typography>
                    <b>Utilidad:</b>
                    {(() => {
                      // Calcular utilidad por separado para USD y Bs, sumando todos los montoBs y montos
                      let totalIngresosUSD = 0;
                      let totalIngresosBs = 0;
                      ingresos.forEach(i => {
                        if (i.monto !== undefined && i.monto !== null && !isNaN(Number(i.monto))) {
                          totalIngresosUSD += Number(i.monto);
                        }
                        if (i.montoBs !== undefined && i.montoBs !== null && !isNaN(Number(i.montoBs))) {
                          totalIngresosBs += Number(i.montoBs);
                        }
                        if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                          i.formasPago.forEach(fp => {
                            if (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              totalIngresosUSD += Number(fp.monto);
                            }
                            if (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) {
                              totalIngresosBs += Number(fp.montoBs);
                            }
                          });
                        }
                      });
                      let totalEgresosUSD = 0;
                      let totalEgresosBs = 0;
                      egresos.forEach(e => {
                        if (e.monto !== undefined && e.monto !== null && !isNaN(Number(e.monto))) {
                          totalEgresosUSD += Number(e.monto);
                        }
                        if (e.montoBs !== undefined && e.montoBs !== null && !isNaN(Number(e.montoBs))) {
                          totalEgresosBs += Number(e.montoBs);
                        }
                        if (Array.isArray(e.formasPago) && e.formasPago.length > 0) {
                          e.formasPago.forEach(fp => {
                            if (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              totalEgresosUSD += Number(fp.monto);
                            }
                            if (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) {
                              totalEgresosBs += Number(fp.montoBs);
                            }
                          });
                        }
                      });
                      const utilidadUSD = totalIngresosUSD - totalEgresosUSD;
                      const utilidadBs = totalIngresosBs - totalEgresosBs;
                      return ` $ ${utilidadUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. ${utilidadBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
                    })()}
                  </Typography>
                  {cierre?.observaciones && (
                    <Typography sx={{ mt: 1 }} color="text.secondary">
                      <b>Observaciones:</b> {cierre.observaciones}
                    </Typography>
                  )}
                  {cierre?.usuario && (
                    <Typography sx={{ mt: 1 }} color="text.secondary">
                      <b>Usuario cierre:</b> {cierre.usuario}
                    </Typography>
                  )}
                </Paper>
                <Accordion
                  sx={{
                    mb: 1,
                    boxShadow: "none",
                    border: "1px solid #e0e0e0",
                    borderRadius: 1,
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      bgcolor: "#e0f7fa",
                      minHeight: 36,
                      "& .MuiAccordionSummary-content": { my: 0.5 },
                    }}
                  >
                    <Typography
                      fontWeight={700}
                      color="primary"
                      fontSize={15}
                    >
                      Ingresos
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0.5 }}>
                    <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
                      <Table
                        component={Paper}
                        size="small"
                        sx={{ boxShadow: "none", mb: 0, minWidth: 340 }}
                      >
                        <TableHead>
                          <TableRow sx={{ height: 28 }}>
                            <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                              Descripción
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ py: 0.5, fontSize: 13 }}
                            >
                              Monto ($)
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ py: 0.5, fontSize: 13 }}
                            >
                              Monto (Bs)
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {ingresos.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                align="center"
                                sx={{
                                  color: "text.secondary",
                                  py: 0.5,
                                  fontSize: 13,
                                }}
                              >
                                Sin ingresos
                              </TableCell>
                            </TableRow>
                          ) : (
                            ingresos.map((i, idx) => (
                              <TableRow key={idx} sx={{ height: 28 }}>
                                <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                  {i.descripcion}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {(() => {
                                    // Si hay formasPago, mostrar todos los montos en $ separados por ' + '
                                    if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                                      const montosUSD = i.formasPago
                                        .filter(fp => fp.formaPago && fp.formaPago.toLowerCase() !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)))
                                        .map(fp => Number(fp.monto).toLocaleString("en-US", { minimumFractionDigits: 2 }));
                                      return montosUSD.length > 0 ? montosUSD.join(' + ') : "-";
                                    }
                                    // Si existe montoUSD
                                    if (typeof i.montoUSD === 'number' && !isNaN(i.montoUSD)) {
                                      return i.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2 });
                                    }
                                    // Si existe monto
                                    if (typeof i.monto === 'number' && !isNaN(i.monto)) {
                                      return i.monto.toLocaleString("en-US", { minimumFractionDigits: 2 });
                                    }
                                    return "-";
                                  })()}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {(() => {
                                    // Mostrar todos los montos en Bs, sumando principal y formasPago, igual que en ingresos.js
                                    let montosBs = [];
                                    // Principal
                                    if (typeof i.montoBs === 'number' && !isNaN(i.montoBs) && i.montoBs > 0) {
                                      montosBs.push(i.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2 }));
                                    }
                                    // formasPago
                                    if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                                      i.formasPago.forEach(fp => {
                                        if (typeof fp.montoBs === 'number' && !isNaN(fp.montoBs) && fp.montoBs > 0) {
                                          montosBs.push(fp.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2 }));
                                        }
                                      });
                                    }
                                    return montosBs.length > 0 ? montosBs.join(' + ') : "-";
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                        </Table>
                      </Box>
                  </AccordionDetails>
                </Accordion>
                <Accordion
                  sx={{
                    mb: 1,
                    boxShadow: "none",
                    border: "1px solid #e0e0e0",
                    borderRadius: 1,
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      bgcolor: "#ffe0e0",
                      minHeight: 36,
                      "& .MuiAccordionSummary-content": { my: 0.5 },
                    }}
                  >
                    <Typography fontWeight={700} color="error" fontSize={15}>
                      Egresos
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0.5 }}>
                    <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
                      <Table
                        component={Paper}
                        size="small"
                        sx={{ boxShadow: "none", mb: 0, minWidth: 400 }}
                      >
                        <TableHead>
                          <TableRow sx={{ height: 28 }}>
                            <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                              Descripción
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ py: 0.5, fontSize: 13 }}
                            >
                              Monto ($)
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ py: 0.5, fontSize: 13 }}
                            >
                              Monto (Bs)
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ py: 0.5, fontSize: 13 }}
                            >
                              Tasa
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {egresos.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                align="center"
                                sx={{
                                  color: "text.secondary",
                                  py: 0.5,
                                  fontSize: 13,
                                }}
                              >
                                Sin egresos
                              </TableCell>
                            </TableRow>
                          ) : (
                            egresos.map((e, idx) => (
                              <TableRow key={idx} sx={{ height: 28 }}>
                                <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                  {e.descripcion}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {e.montoUSD.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {(e.montoBs && e.montoBs > 0
                                    ? e.montoBs
                                    : (e.montoUSD || 0) * (e.tasa || tasaHistorica)
                                  ).toLocaleString("de-DE", {
                                    minimumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {e.tasa
                                    ? e.tasa.toLocaleString("de-DE", {
                                      minimumFractionDigits: 2,
                                    })
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            );
          })()}
        </>
      )}
    </Box>
  );
}
