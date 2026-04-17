import React, { useEffect, useState } from "react";
import { obtenerFactorConversion } from "../lib/factorConversionFirebase";
import Skeleton from "@mui/material/Skeleton";
import { obtenerFondoCajaChica } from "../lib/configuracionCajaChicaFirebase";
import { obtenerMovimientosCajaChica } from "../lib/cajaChicaFirebase";
import dayjs from "dayjs";
import { obtenerIngresos } from "../lib/ingresosFirebase";
import { obtenerEgresos } from "../lib/egresosFirebase";
import { obtenerCierresDiarios } from "../lib/cierresDiariosFirebase";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
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
  Button,
  useMediaQuery,
  Checkbox,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function agruparPorDia(arr, tipo) {
  return arr.reduce((acc, item) => {
    let fecha = "-";
    if (item._fechaDate instanceof Date) {
      const d = String(item._fechaDate.getDate()).padStart(2, "0");
      const m = String(item._fechaDate.getMonth() + 1).padStart(2, "0");
      const y = item._fechaDate.getFullYear();
      fecha = `${d}/${m}/${y}`;
    } else if (typeof item.fecha === "string" && item.fecha.includes("/")) {
      fecha = item.fecha;
    }
    if (!acc[fecha]) acc[fecha] = { ingresos: [], egresos: [] };
    acc[fecha][tipo === "ingreso" ? "ingresos" : "egresos"].push(item);
    return acc;
  }, {});
}

function getItemTimestamp(item) {
  if (!item) return 0;
  if (item._fechaDate instanceof Date) return item._fechaDate.getTime();
  if (item.fecha && typeof item.fecha.toDate === "function") return item.fecha.toDate().getTime();
  if (item.fecha && item.fecha.seconds) return item.fecha.seconds * 1000;
  if (typeof item.fecha === "string" && item.fecha.includes("/")) {
    const [d, m, y] = item.fecha.split("/");
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0).getTime();
  }
  return 0;
}

export default function ResumenContable({ tasaBCV }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [fondoCajaChica, setFondoCajaChica] = useState(null);
  const [movimientosCajaChica, setMovimientosCajaChica] = useState([]);
  const [selectedIngresos, setSelectedIngresos] = useState(new Set());
  const [selectedEgresos, setSelectedEgresos] = useState(new Set());
  const getIngresoKey = (i, idx) => (i && i.id) || `${i?.descripcion || ''}-${i?.fecha || ''}-${idx}`;
  const getEgresoKey = (e, idx) => (e && e.id) || `${e?.descripcion || ''}-${e?._fechaDate || e?.fecha || ''}-${idx}`;
  const formatFecha = (item) => {
    if (!item) return "-";
    if (item._fechaDate instanceof Date) {
      const d = String(item._fechaDate.getDate()).padStart(2, "0");
      const m = String(item._fechaDate.getMonth() + 1).padStart(2, "0");
      const y = item._fechaDate.getFullYear();
      return `${d}/${m}/${y}`;
    }
    if (item.fecha && item.fecha.seconds) {
      const dt = new Date(item.fecha.seconds * 1000);
      const d = String(dt.getDate()).padStart(2, "0");
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const y = dt.getFullYear();
      return `${d}/${m}/${y}`;
    }
    if (typeof item.fecha === "string" && item.fecha.includes("/")) return item.fecha;
    return "-";
  };
  useEffect(() => {
    Promise.all([
      obtenerFondoCajaChica(),
      obtenerMovimientosCajaChica()
    ]).then(([fondo, movs]) => {
      setFondoCajaChica(fondo);
      setMovimientosCajaChica(movs);
    });
  }, []);
  const [factorConversion, setFactorConversion] = useState(1);
  useEffect(() => {
    async function fetchFactor() {
      const val = await obtenerFactorConversion();
      setFactorConversion(val);
    }
    fetchFactor();
  }, []);
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
        _fechaDate: i.fecha && i.fecha.seconds ? new Date(i.fecha.seconds * 1000) : null,
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
          const d = String(new Date(cierre.fecha.seconds * 1000).getDate()).padStart(2, "0");
          const m = String(new Date(cierre.fecha.seconds * 1000).getMonth() + 1).padStart(2, "0");
          const y = new Date(cierre.fecha.seconds * 1000).getFullYear();
          fecha = `${d}/${m}/${y}`;
        } else if (cierre.fechaStr) {
          fecha = cierre.fechaStr;
        }
        cierresMap[fecha] = cierre;
      });
      setCierresPorDia(cierresMap);
      setLoading(false);

      // Establecer por defecto el rango de la semana actual: lunes a viernes
      const todayDj = window.dayjs ? window.dayjs() : require('dayjs')();
      const dow = todayDj.day(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const monday = todayDj.subtract((dow + 6) % 7, 'day').startOf('day');
      const friday = monday.add(4, 'day').startOf('day');
      setFechaInicio(monday);
      setFechaFin(friday);
      // Limpiar selección de fecha única para que prevalezca el rango
      setFechaSeleccionada("");
    });
  }, []);

  // Suscribirse en tiempo real a egresos
  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(collection(db, "egresos"), (snap) => {
      const egresos = snap.docs.map((d) => {
        const data = d.data();
        // Si viene Timestamp, normalizar a Date en _fechaDate
        let _fechaDate = null;
        if (data.fecha && typeof data.fecha.toDate === "function") {
          _fechaDate = data.fecha.toDate();
        }
        return { ...data, id: d.id, _fechaDate };
      });
      const egresosAgr = agruparPorDia(egresos, "egreso");
      setDatosPorDia((prev) => {
        const merged = {};
        const fechas = new Set([...Object.keys(prev || {}), ...Object.keys(egresosAgr)]);
        fechas.forEach((f) => {
          merged[f] = {
            ingresos: prev && prev[f] ? prev[f].ingresos : [],
            egresos: egresosAgr[f]?.egresos || [],
          };
        });
        return merged;
      });
    });
    return () => unsub();
  }, []);

  // Suscribirse en tiempo real a cierres diarios
  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(collection(db, "cierresDiarios"), (snap) => {
      const cierresMap = {};
      snap.docs.forEach((docu) => {
        const cierre = { id: docu.id, ...docu.data() };
        let fecha = "-";
        if (cierre.fecha && cierre.fecha.seconds) {
          const d = String(new Date(cierre.fecha.seconds * 1000).getDate()).padStart(2, "0");
          const m = String(new Date(cierre.fecha.seconds * 1000).getMonth() + 1).padStart(2, "0");
          const y = new Date(cierre.fecha.seconds * 1000).getFullYear();
          fecha = `${d}/${m}/${y}`;
        } else if (cierre.fechaStr) {
          fecha = cierre.fechaStr;
        }
        cierresMap[fecha] = cierre;
      });
      setCierresPorDia(cierresMap);
    });
    return () => unsub();
  }, []);

  if (loading)
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
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
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          justifyContent: { xs: "center", sm: "space-between" },
          mb: 2,
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Typography
          variant="h5"
          fontWeight={700}
          gutterBottom
          sx={{
            textAlign: { xs: "center", sm: "left" },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          Resumen diario
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: { xs: "100%", sm: "auto" },
            justifyContent: { xs: "center", sm: "flex-start" },
          }}
        >
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Desde"
              value={fechaInicio}
              onChange={setFechaInicio}
              renderInput={(params) => (
                <TextField {...params} size="small" sx={{ minWidth: 120 }} />
              )}
              disableFuture
              minDate={
                Object.keys(datosPorDia).length > 0
                  ? dayjs(
                      (() => {
                        const toMs = (s) => { const p = (s || '').split('/'); return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getTime(); };
                        const first = Object.keys(datosPorDia).sort((a, b) => toMs(a) - toMs(b))[0] || '';
                        const parts = first.split('/');
                        return [parts[2], parts[1], parts[0]].join('-');
                      })()
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
              renderInput={(params) => (
                <TextField {...params} size="small" sx={{ minWidth: 120 }} />
              )}
              disableFuture
              minDate={
                fechaInicio ||
                (Object.keys(datosPorDia).length > 0
                  ? dayjs(
                      (() => {
                        const toMs = (s) => { const p = (s || '').split('/'); return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getTime(); };
                        const first = Object.keys(datosPorDia).sort((a, b) => toMs(a) - toMs(b))[0] || '';
                        const parts = first.split('/');
                        return [parts[2], parts[1], parts[0]].join('-');
                      })()
                    )
                  : undefined)
              }
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
              // Comparación robusta por timestamps locales (evita discrepancias de instancias de dayjs)
              const startMs = fechaInicio.startOf('day').valueOf();
              const endMs = fechaFin.endOf('day').valueOf();
              fechasFiltradas = Object.keys(datosPorDia)
                .filter((f) => {
                  // f en formato DD/MM/YYYY
                  const [d, m, y] = (f || '').split('/');
                  const fMs = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
                  if (isNaN(fMs)) return false;
                  return fMs >= startMs && fMs <= endMs;
                })
                .sort((a, b) => {
                  const faParts = (a || '').split('/');
                  const fbParts = (b || '').split('/');
                  const fa = new Date(Number(faParts[2]), Number(faParts[1]) - 1, Number(faParts[0])).getTime();
                  const fb = new Date(Number(fbParts[2]), Number(fbParts[1]) - 1, Number(fbParts[0])).getTime();
                  return fa - fb;
                });
            } else if (fechaSeleccionada) {
              fechasFiltradas = [fechaSeleccionada];
            }
            if (fechasFiltradas.length === 0) {
              return (
                <Typography color="text.secondary">
                  No hay datos en el rango seleccionado.
                </Typography>
              );
            }
            // Acumular ingresos y egresos de todas las fechas seleccionadas
            let ingresos = [];
            let egresos = [];
            let cierres = [];
            fechasFiltradas.forEach((f) => {
              if (datosPorDia[f]) {
                ingresos = ingresos.concat(datosPorDia[f].ingresos);
                egresos = egresos.concat(datosPorDia[f].egresos);
              }
              if (cierresPorDia[f]) {
                cierres.push(cierresPorDia[f]);
              }
            });
            const ingresosOrdenados = [...ingresos].sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
            const egresosOperativos = egresos.filter((e) => (e.tipo || "") !== "gastoDia");
            const egresosOperativosOrdenados = [...egresosOperativos].sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
            const gastosDelDiaFiltrados = egresos.filter((e) => (e.tipo || "") === "gastoDia");
            const gastosSemanaOrdenados = [...gastosDelDiaFiltrados].sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
            // Usar la tasa histórica del último cierre del rango, si existe
            const cierre =
              cierres.length > 0 ? cierres[cierres.length - 1] : undefined;
            // (Nota) tasaHistorica y totales globales no se usan más en este bloque; se mantienen los cálculos específicos más abajo
            // DEBUG: Mostrar montos en efectivo (USD) en consola
            // Calcular total de "gastos del día" dentro del rango (usaremos para restar del efectivo)
            const tasaParaConvGlobal = tasaBCV || factorConversion || 1;
            const gastosDelDiaArrayGlobal = gastosDelDiaFiltrados;
            const gastosSemanaUSD = gastosDelDiaArrayGlobal.reduce((acc, g) => {
              if (typeof g.montoUSD === "number" && !isNaN(g.montoUSD)) return acc + g.montoUSD;
              if (typeof g.montoBs === "number" && !isNaN(g.montoBs)) return acc + g.montoBs / tasaParaConvGlobal;
              if (typeof g.monto === "number" && !isNaN(g.monto)) return acc + g.monto;
              return acc;
            }, 0);
            const gastosSemanaBs = gastosDelDiaArrayGlobal.reduce((acc, g) => {
              if (typeof g.montoBs === "number" && !isNaN(g.montoBs)) return acc + g.montoBs;
              return acc;
            }, 0);
            const efectivoIngresosUSD = ingresosOrdenados.reduce((acc, i) => {
              if (!Array.isArray(i.formasPago) || i.formasPago.length === 0) return acc;
              return acc + i.formasPago.reduce((sum, fp) => {
                const forma = (fp.formaPago || "").trim().toLowerCase();
                if (["efectivo", "$", "usd"].includes(forma) && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                  return sum + Number(fp.monto);
                }
                return sum;
              }, 0);
            }, 0);
            const efectivoNetoResumenUSD = efectivoIngresosUSD - gastosSemanaUSD;
            try {
              const pagosEfectivo = [];
              ingresosOrdenados.forEach((i) => {
                if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                  i.formasPago.forEach((fp) => {
                    const forma = (fp.formaPago || "").trim().toLowerCase();
                    const monto = fp?.monto;
                    if (
                      forma === "efectivo" &&
                      monto !== undefined &&
                      monto !== null &&
                      !isNaN(Number(monto))
                    ) {
                      pagosEfectivo.push({ descripcion: i.descripcion, monto: Number(monto) });
                    }
                  });
                }
              });
              const totalEfectivoUSD = pagosEfectivo.reduce((acc, p) => acc + p.monto, 0);

              // Calcular gastos del día (tipo === 'gastoDia') dentro del rango
              const tasaParaConv = tasaBCV || factorConversion || 1;
              const gastosDelDiaArray = egresos.filter((e) => (e.tipo || "") === "gastoDia");
              const totalGastosDelDiaUSD = gastosDelDiaArray.reduce((acc, g) => {
                if (typeof g.montoUSD === "number" && !isNaN(g.montoUSD)) return acc + g.montoUSD;
                if (typeof g.montoBs === "number" && !isNaN(g.montoBs)) return acc + g.montoBs / tasaParaConv;
                // Intentar otros campos compatibles
                if (typeof g.monto === "number" && !isNaN(g.monto)) return acc + g.monto;
                return acc;
              }, 0);

              const efectivoNetoUSD = totalEfectivoUSD - totalGastosDelDiaUSD;

              // Mostrar array de montos y el total (debug)
              console.log(
                "[ResumenContable] Montos en efectivo ($):",
                pagosEfectivo.map((p) => p.monto),
                "Total:",
                totalEfectivoUSD,
                "Gastos del día (USD):",
                totalGastosDelDiaUSD,
                "Efectivo neto:",
                efectivoNetoUSD
              );
            } catch (_) { /* noop */ }

            return (
              <Box key={fechasFiltradas.join("-")} sx={{ mb: 4 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    gap: { xs: 1, sm: 0 },
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ textAlign: { xs: "center", sm: "left" } }}
                  >
                    {fechaInicio && fechaFin
                      ? `Rango: ${fechaInicio.format(
                        "DD/MM/YYYY"
                      )} a ${fechaFin.format("DD/MM/YYYY")}`
                      : `Fecha: ${fechasFiltradas[0]}`}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="success"
                    size={isMobile ? "medium" : "small"}
                    endIcon={<WhatsAppIcon sx={{ fontSize: 20 }} />}
                    sx={{ minWidth: 100, width: { xs: "100%", sm: "auto" } }}
                    onClick={() => {
                      // Generar el texto del resumen para WhatsApp
                      let texto = `Resumen contable\n`;
                      texto +=
                        fechaInicio && fechaFin
                          ? `Rango: ${fechaInicio.format(
                            "DD/MM/YYYY"
                          )} a ${fechaFin.format("DD/MM/YYYY")}`
                          : `Fecha: ${fechasFiltradas[0]}`;
                      texto += `\n\n`;
                      // Ingresos
                      texto += `Ingresos totales: $ ${ingresos
                        .reduce((acc, i) => {
                          if (
                            Array.isArray(i.formasPago) &&
                            i.formasPago.length > 0
                          ) {
                            return (
                              acc +
                              i.formasPago
                                .filter((fp) => {
                                  const f = (fp.formaPago || "").trim().toLowerCase();
                                  return f !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto));
                                })
                                .reduce((sum, fp) => sum + Number(fp.monto), 0)
                            );
                          }
                          return acc;
                        }, 0)
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}`;
                      texto += `\n`;
                      texto += `Ingresos totales: Bs. ${ingresos
                        .reduce((acc, i) => {
                          if (
                            Array.isArray(i.formasPago) &&
                            i.formasPago.length > 0
                          ) {
                            return (
                              acc +
                              i.formasPago
                                .filter(
                                  (fp) =>
                                    (fp.formaPago || "")
                                      .trim()
                                      .toLowerCase() === "pago movil" &&
                                    ((fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) || (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))))
                                )
                                .reduce((sum, fp) => sum + (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)) ? Number(fp.montoBs) : Number(fp.monto)), 0)
                            );
                          }
                          return acc;
                        }, 0)
                        .toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })}`;
                      texto += `\n`;
                      // Egresos
                      texto += `Egresos totales: $ ${egresosOperativos
                        .reduce(
                          (acc, e) =>
                            acc +
                            (typeof e.montoUSD === "number" && e.montoUSD > 0
                              ? e.montoUSD
                              : 0),
                          0
                        )
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}`;
                      texto += `\n`;
                      texto += `Egresos totales: Bs. ${egresosOperativos
                        .reduce(
                          (acc, e) =>
                            acc +
                            (typeof e.montoBs === "number" && e.montoBs > 0
                              ? e.montoBs
                              : 0),
                          0
                        )
                        .toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })}`;
                      texto += `\n`;
                      // Utilidad
                      let totalUSD = ingresos.reduce((acc, i) => {
                        if (
                          Array.isArray(i.formasPago) &&
                          i.formasPago.length > 0
                        ) {
                          return (
                            acc +
                            i.formasPago
                              .filter((fp) => {
                                const f = (fp.formaPago || "").trim().toLowerCase();
                                return f !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto));
                              })
                              .reduce((sum, fp) => sum + Number(fp.monto), 0)
                          );
                        }
                        return acc;
                      }, 0);
                      let totalBs = ingresos.reduce((acc, i) => {
                        if (
                          Array.isArray(i.formasPago) &&
                          i.formasPago.length > 0
                        ) {
                          return (
                            acc +
                            i.formasPago
                              .filter(
                                (fp) =>
                                  (fp.formaPago || "").trim().toLowerCase() ===
                                  "pago movil" &&
                                  ((fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) || (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))))
                              )
                              .reduce((sum, fp) => {
                                const montoBs = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                                  ? Number(fp.montoBs)
                                  : Number(fp.monto);
                                return sum + montoBs;
                              }, 0)
                          );
                        }
                        return acc;
                      }, 0);
                      let totalBsUSD = ingresos.reduce((acc, i) => {
                        if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                          return acc + i.formasPago
                            .filter(fp => (fp.formaPago || '').trim().toLowerCase() === 'pago movil')
                            .reduce((sum, fp) => {
                              const montoBs = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                                ? Number(fp.montoBs)
                                : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                              const usdEq = (fp.usdEquiv !== undefined && fp.usdEquiv !== null && !isNaN(Number(fp.usdEquiv)))
                                ? Number(fp.usdEquiv)
                                : (factorConversion ? (montoBs / factorConversion) : 0);
                              return sum + usdEq;
                            }, 0);
                        }
                        return acc;
                      }, 0);
                      let totalEgresosUSD = egresosOperativos.reduce(
                        (acc, e) =>
                          acc +
                          (typeof e.montoUSD === "number" && e.montoUSD > 0
                            ? e.montoUSD
                            : 0),
                        0
                      );
                      let totalEgresosBs = egresosOperativos.reduce(
                        (acc, e) =>
                          acc +
                          (typeof e.montoBs === "number" && e.montoBs > 0
                            ? e.montoBs
                            : 0),
                        0
                      );
                      texto += `Utilidad: $ ${(
                        totalUSD - totalEgresosUSD
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })} | Bs. ${(totalBs - totalEgresosBs).toLocaleString(
                        "de-DE",
                        { minimumFractionDigits: 2 }
                      )}`;
                      texto += `\n`;
                      // Total Pago Móvil en Bs y en $
                      texto += `Total Pago Movil: Bs. ${totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })} / $ ${totalBsUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                      // Total $ en cierre
                      const totalCierreUSD = totalUSD + totalBsUSD - gastosSemanaUSD;
                      texto += `\nTotal $ en cierre: $ ${totalCierreUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                      // Abrir WhatsApp con el texto
                      const url = `https://wa.me/?text=${encodeURIComponent(
                        texto
                      )}`;
                      window.open(url, "_blank");
                    }}
                  >
                    {isMobile ? "Compartir" : "Enviar"}
                  </Button>
                </Box>
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Gastos de la semana: $ {gastosSemanaUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
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
                  <Box sx={{ display: { xs: "block", sm: "none" }, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 13, sm: 16 }, whiteSpace: { xs: "nowrap", sm: "normal" } }}>
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
                      flexDirection: { xs: "column", sm: "row" },
                      justifyContent: { xs: "flex-start", sm: "space-between" },
                      alignItems: { xs: "flex-start", sm: "center" },
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                      <b>• Ingresos totales:</b>
                      {(() => {
                        // Sumar solo los montos de pagos Zelle/Efectivo en USD y Pago Móvil en Bs
                        let totalUSD = 0;
                        let totalBs = 0;
                        ingresos.forEach((i) => {
                          if (
                            Array.isArray(i.formasPago) &&
                            i.formasPago.length > 0
                          ) {
                            i.formasPago.forEach((fp) => {
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
                        return ` $ ${totalUSD.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })} | Bs. ${totalBs.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })}`;
                      })()}
                    </Typography>
                    {/* Tasa BCV en línea para desktop */}
                    <Box sx={{ display: { xs: "none", sm: "block" } }}>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
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
                        <Typography variant="body2" color="text.secondary">
                          Factor:{" "}
                          {factorConversion
                            ? `${factorConversion.toLocaleString("de-DE")}`
                            : "No disponible"}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {/* Mostrar montos por forma de pago como subtítulo */}
                  <Box sx={{ mb: 1, mt: 1 }}>
                    {/* Sumatoria por forma de pago */}
                    {(() => {
                      // Mostrar sumatoria total por cada forma de pago
                      const desglose = {};
                      ingresos.forEach((i) => {
                        if (
                          Array.isArray(i.formasPago) &&
                          i.formasPago.length > 0
                        ) {
                          i.formasPago.forEach((fp) => {
                            const formaNorm = (
                              fp.formaPago || "Sin especificar"
                            )
                              .trim()
                              .toLowerCase();
                            if (!desglose[formaNorm])
                              desglose[formaNorm] = { usd: 0, bs: 0, usdEquivBs: 0 };
                            if (formaNorm === "pago movil") {
                              const montoBs = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                                ? Number(fp.montoBs)
                                : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                              desglose[formaNorm].bs += montoBs;
                              const usdEquiv = (fp.usdEquiv !== undefined && fp.usdEquiv !== null && !isNaN(Number(fp.usdEquiv)))
                                ? Number(fp.usdEquiv)
                                : (factorConversion ? (montoBs / factorConversion) : 0);
                              desglose[formaNorm].usdEquivBs += usdEquiv;
                            } else if (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              desglose[formaNorm].usd += Number(fp.monto);
                            }
                          });
                        }
                      });
                      if (!desglose.efectivo) {
                        desglose.efectivo = { usd: 0, bs: 0, usdEquivBs: 0 };
                      }
                      desglose.efectivo.usd -= gastosSemanaUSD;

                      return Object.entries(desglose)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([formaNorm, montos]) => {
                          const nombreMostrar = formaNorm
                            .split(" ")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ");
                          return (
                            <Typography
                              key={"total-" + nombreMostrar}
                              variant="body2"
                              sx={{ mb: 0.5, pl: 2, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}
                            >
                              <b>Total {nombreMostrar}:</b>
                              {formaNorm === "pago movil"
                                ? ` Bs. ${montos.bs.toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                })} ($ ${montos.usdEquivBs.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })})  `
                                : ` $ ${montos.usd.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}`}
                            </Typography>
                          );
                        });
                    })()}
                  </Box>
                  <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Egresos totales:</b>
                    {(() => {
                      // Sumar solo los valores que se muestran en la tabla de egresos
                      let totalUSD = 0;
                      let totalBs = 0;
                      egresosOperativos.forEach((e) => {
                        if (typeof e.montoUSD === "number" && e.montoUSD > 0) {
                          totalUSD += e.montoUSD;
                        }
                        if (typeof e.montoBs === "number" && e.montoBs > 0) {
                          totalBs += e.montoBs;
                        }
                      });
                      return ` $ ${totalUSD.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })} | Bs. ${totalBs.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                      })}`;
                    })()}
                  </Typography>
                  <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Gastos semana:</b>
                    {` $ ${gastosSemanaUSD.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })} | Bs. ${gastosSemanaBs.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                    })}`}
                  </Typography>
                  <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Efectivo neto:</b>
                    {` $ ${efectivoNetoResumenUSD.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}`}
                  </Typography>
                  {/* <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Utilidad:</b>
                    {(() => {
                      // Calcular utilidad por divisa: ingresos menos egresos en cada moneda
                      let ingresosUSD = 0;
                      let ingresosBs = 0;
                      ingresos.forEach((i) => {
                        if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                          i.formasPago.forEach((fp) => {
                            const forma = (fp.formaPago || "").trim().toLowerCase();
                            if (forma !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              ingresosUSD += Number(fp.monto);
                            }
                            if (forma === "pago movil" && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              ingresosBs += Number(fp.monto);
                            }
                          });
                        }
                      });
                      let egresosUSD = 0;
                      let egresosBs = 0;
                      egresos.forEach((e) => {
                        if (typeof e.montoUSD === "number" && !isNaN(e.montoUSD)) {
                          egresosUSD += e.montoUSD;
                        }
                        if (typeof e.montoBs === "number" && !isNaN(e.montoBs)) {
                          egresosBs += e.montoBs;
                        }
                      });
                      const utilidadUSD = ingresosUSD - egresosUSD;
                      const utilidadBs = ingresosBs - egresosBs;
                      return ` $ ${utilidadUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Bs. ${utilidadBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
                    })()}
                  </Typography> */}
                  <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Caja chica:</b>
                    {(() => {
                      if (typeof fondoCajaChica === 'undefined' || typeof movimientosCajaChica === 'undefined') {
                        return <span style={{ color: '#ed6c02', fontWeight: 500, marginLeft: 8 }}>No disponible</span>;
                      }
                      const saldo = (fondoCajaChica !== null ? Number(fondoCajaChica) : 0) - movimientosCajaChica.reduce((acc, mov) => acc + mov.monto, 0);
                      if (saldo === 0) {
                        return <span style={{ color: '#ed6c02', fontWeight: 500, marginLeft: 8 }}>Reponer</span>;
                      }
                      return ` $ ${saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                    })()}
                  </Typography>
                  {/* <Typography sx={{ mb: 1, fontSize: { xs: 13, sm: 16 }, lineHeight: { xs: 1.2, sm: "inherit" }, whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }}>
                    <b>• Total $ en cierre:</b>
                    {(() => {
                      // Sumar ingresos en USD + el valor en USD de los pagos movil (Bs / factorConversion)
                      // Restar solo egresos en USD
                      let ingresosUSD = 0;
                      let ingresosBs = 0;
                      ingresos.forEach((i) => {
                        if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                          i.formasPago.forEach((fp) => {
                            const forma = (fp.formaPago || "").trim().toLowerCase();
                            if (["zelle", "efectivo", "$", "usd"].includes(forma) && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              ingresosUSD += Number(fp.monto);
                            }
                            if (forma === "pago movil" && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))) {
                              ingresosBs += Number(fp.monto);
                            }
                          });
                        }
                      });
                      let egresosUSD = 0;
                      egresos.forEach((e) => {
                        if (typeof e.montoUSD === "number" && !isNaN(e.montoUSD)) {
                          egresosUSD += e.montoUSD;
                        }
                      });
                      const totalCierreUSD = (ingresosUSD + ingresosBs / factorConversion) - egresosUSD;
                      return ` $ ${totalCierreUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                    })()}
                  </Typography> */}
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
                      minHeight: { xs: 44, sm: 36 },
                      "& .MuiAccordionSummary-content": { my: 0.5 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight={700} color="primary" fontSize={15}>
                        INGRESOS
                      </Typography>
                      {/* <Box sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        px: 1,
                        py: '2px',
                        borderRadius: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        minWidth: 28,
                        textAlign: 'center'
                      }}>
                        {ingresosOrdenados.length}
                      </Box> */}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0.5 }}>
                    <Box
                      sx={{
                        width: "100%",
                        overflowX: { xs: "auto", sm: "visible" },
                      }}
                    >
                      {isMobile ? (
                        <Box>
                          {ingresosOrdenados.length === 0 ? (
                            <Typography align="center" color="text.secondary" sx={{ py: 1 }}>
                              Sin ingresos
                            </Typography>
                          ) : (
                            ingresosOrdenados.map((i, idx) => {
                              // Calcular totales por registro
                              let totalUSD = 0;
                              let totalBs = 0;
                              if (Array.isArray(i.formasPago) && i.formasPago.length > 0) {
                                i.formasPago.forEach((fp) => {
                                  const forma = (fp.formaPago || "").trim().toLowerCase();
                                  if (forma !== 'pago movil' && fp.monto != null && !isNaN(Number(fp.monto))) {
                                    totalUSD += Number(fp.monto);
                                  }
                                  if (forma === "pago movil") {
                                    const v = (fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)))
                                      ? Number(fp.montoBs)
                                      : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : 0);
                                    if (v > 0) totalBs += v;
                                  }
                                });
                              }
                              return (
                                <Paper key={idx} sx={{ p: 1.5, mb: 1 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                                    <Checkbox
                                      size="small"
                                      checked={selectedIngresos.has(getIngresoKey(i, idx))}
                                      onChange={() => setSelectedIngresos((prev) => { const next = new Set(prev); const k = getIngresoKey(i, idx); if (next.has(k)) next.delete(k); else next.add(k); return next; })}
                                      inputProps={{ 'aria-label': 'Seleccionar ingreso' }}
                                    />
                                  </Box>
                                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                    {`${i.vehiculo ? i.vehiculo + ' - ' : ''}${i.servicio || i.descripcion || i.observaciones || '-'}`}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    Fecha: {formatFecha(i)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {Array.isArray(i.formasPago) && i.formasPago.length > 0
                                      ? i.formasPago.map((fp, fidx) => {
                                          const nombre = (fp.formaPago || "").trim();
                                          return (
                                            <span key={fidx}>
                                              {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                                              {fidx < i.formasPago.length - 1 ? ", " : ""}
                                            </span>
                                          );
                                        })
                                      : "-"}
                                  </Typography>
                                  <Divider sx={{ my: 1 }} />
                                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="body2">
                                      <b>$</b> {totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </Typography>
                                    <Typography variant="body2">
                                      <b>Bs</b> {totalBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                                    </Typography>
                                  </Box>
                                </Paper>
                              );
                            })
                          )}
                        </Box>
                      ) : (
                        <Table
                          component={Paper}
                          size="small"
                          sx={{ boxShadow: "none", mb: 0, minWidth: 340 }}
                        >
                          <TableHead>
                            <TableRow sx={{ height: 28 }}>
                              <TableCell sx={{ py: 0.5, fontSize: 13, width: 36 }}>
                                <Checkbox
                                  size="small"
                                  inputProps={{ 'aria-label': 'Seleccionar todos ingresos' }}
                                  checked={ingresosOrdenados.length > 0 && ingresosOrdenados.every((it, ix) => selectedIngresos.has(getIngresoKey(it, ix)))}
                                  indeterminate={ingresosOrdenados.some((it, ix) => selectedIngresos.has(getIngresoKey(it, ix))) && !(ingresosOrdenados.length > 0 && ingresosOrdenados.every((it, ix) => selectedIngresos.has(getIngresoKey(it, ix))))}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedIngresos((prev) => {
                                      const next = new Set(prev);
                                      if (checked) ingresosOrdenados.forEach((it, ix) => next.add(getIngresoKey(it, ix)));
                                      else ingresosOrdenados.forEach((it, ix) => next.delete(getIngresoKey(it, ix)));
                                      return next;
                                    });
                                  }}
                                />
                              </TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: 13 }}>Fecha</TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                Descripción
                              </TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                Forma de pago
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
                            {ingresosOrdenados.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
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
                              ingresosOrdenados.map((i, idx) => (
                                <TableRow key={idx} sx={{ height: 28 }}>
                                  <TableCell sx={{ py: 0.5, fontSize: 13, width: 36 }}>
                                    <Checkbox
                                      size="small"
                                      checked={selectedIngresos.has(getIngresoKey(i, idx))}
                                      onChange={() => setSelectedIngresos((prev) => { const next = new Set(prev); const k = getIngresoKey(i, idx); if (next.has(k)) next.delete(k); else next.add(k); return next; })}
                                      inputProps={{ 'aria-label': 'Seleccionar ingreso' }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>{formatFecha(i)}</TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                    {`${i.vehiculo ? i.vehiculo + ' - ' : ''}${i.servicio || i.descripcion || i.observaciones || '-'}`}
                                  </TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                    {Array.isArray(i.formasPago) &&
                                      i.formasPago.length > 0
                                      ? i.formasPago.map((fp, fidx) => {
                                        const nombre = (fp.formaPago || "").trim();
                                        return (
                                          <span key={fidx}>
                                            {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                                            {fidx < i.formasPago.length - 1 ? ", " : ""}
                                          </span>
                                        );
                                      })
                                      : "-"}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontSize: 13 }}
                                  >
                                    {(() => {
                                      // Mostrar solo montos asociados a formaPago Zelle y Efectivo usando atributo monto
                                      if (
                                        Array.isArray(i.formasPago) &&
                                        i.formasPago.length > 0
                                      ) {
                                        const montosUSD = i.formasPago
                                          .filter((fp) => {
                                            const f = (fp.formaPago || '').trim().toLowerCase();
                                            return f !== 'pago movil' && fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto));
                                          })
                                          .map((fp) =>
                                            Number(fp.monto).toLocaleString(
                                              "en-US",
                                              { minimumFractionDigits: 2 }
                                            )
                                          );
                                        return montosUSD.length > 0
                                          ? montosUSD.join(" + ")
                                          : "-";
                                      }
                                      return "-";
                                    })()}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontSize: 13 }}
                                  >
                                    {(() => {
                                      // Mostrar solo montos asociados a formaPago 'pago movil'
                                      if (
                                        Array.isArray(i.formasPago) &&
                                        i.formasPago.length > 0
                                      ) {
                                        const montosBs = i.formasPago
                                          .filter(
                                            (fp) =>
                                              fp.formaPago &&
                                              fp.formaPago
                                                .trim()
                                                .toLowerCase() === "pago movil" &&
                                              ((fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))) || (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto))))
                                          )
                                          .map((fp) =>
                                            Number(fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs)) ? fp.montoBs : fp.monto).toLocaleString(
                                              "de-DE",
                                              { minimumFractionDigits: 2 }
                                            )
                                          );
                                        return montosBs.length > 0
                                          ? montosBs.join(" + ")
                                          : "-";
                                      }
                                      return "-";
                                    })()}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
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
                      minHeight: { xs: 44, sm: 36 },
                      "& .MuiAccordionSummary-content": { my: 0.5 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight={700} color="error" fontSize={15}>
                        EGRESOS
                      </Typography>
                      {/* <Box sx={{
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        px: 1,
                        py: '2px',
                        borderRadius: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        minWidth: 28,
                        textAlign: 'center'
                      }}>
                        {egresosOperativosOrdenados.length}
                      </Box> */}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0.5 }}>
                    <Box
                      sx={{
                        width: "100%",
                        overflowX: { xs: "auto", sm: "visible" },
                      }}
                    >
                      {isMobile ? (
                        <Box>
                          {egresosOperativos.length === 0 ? (
                            <Typography align="center" color="text.secondary" sx={{ py: 1 }}>
                              Sin egresos
                            </Typography>
                          ) : (
                              egresosOperativosOrdenados.map((e, idx) => (
                              <Paper key={idx} sx={{ p: 1.5, mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                                  <Checkbox
                                    size="small"
                                    checked={selectedEgresos.has(getEgresoKey(e, idx))}
                                    onChange={() => setSelectedEgresos((prev) => { const next = new Set(prev); const k = getEgresoKey(e, idx); if (next.has(k)) next.delete(k); else next.add(k); return next; })}
                                    inputProps={{ 'aria-label': 'Seleccionar egreso' }}
                                  />
                                </Box>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                  {e.proveedor || "-"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  Fecha: {formatFecha(e)}
                                </Typography>
                                {e.numeroDocumento && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    Doc: {e.numeroDocumento}
                                  </Typography>
                                )}
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                  <Typography variant="body2">
                                    <b>$</b> {typeof e.montoUSD === "number" && e.montoUSD > 0 ? e.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                                  </Typography>
                                  <Typography variant="body2">
                                    <b>Bs</b> {typeof e.montoBs === "number" && e.montoBs > 0 ? e.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "-"}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  Tasa: {(e.tasaFactura || e.tasa)
                                    ? (e.tasaFactura || e.tasa).toLocaleString("de-DE", { minimumFractionDigits: 2 })
                                    : "-"}
                                </Typography>
                              </Paper>
                            ))
                          )}
                        </Box>
                      ) : (
                        <Table
                          component={Paper}
                          size="small"
                          sx={{ boxShadow: "none", mb: 0, minWidth: 400 }}
                        >
                          <TableHead>
                            <TableRow sx={{ height: 28 }}>
                              <TableCell sx={{ py: 0.5, fontSize: 13, width: 36 }}>
                                <Checkbox
                                  size="small"
                                  inputProps={{ 'aria-label': 'Seleccionar todos egresos' }}
                                  checked={egresosOperativosOrdenados.length > 0 && egresosOperativosOrdenados.every((it, ix) => selectedEgresos.has(getEgresoKey(it, ix)))}
                                  indeterminate={egresosOperativosOrdenados.some((it, ix) => selectedEgresos.has(getEgresoKey(it, ix))) && !(egresosOperativosOrdenados.length > 0 && egresosOperativosOrdenados.every((it, ix) => selectedEgresos.has(getEgresoKey(it, ix))))}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedEgresos((prev) => {
                                      const next = new Set(prev);
                                      if (checked) egresosOperativosOrdenados.forEach((it, ix) => next.add(getEgresoKey(it, ix)));
                                      else egresosOperativosOrdenados.forEach((it, ix) => next.delete(getEgresoKey(it, ix)));
                                      return next;
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>Fecha</TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                Proveedor
                              </TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                Factura/N-E
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
                            {egresosOperativosOrdenados.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
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
                              egresosOperativosOrdenados.map((e, idx) => (
                                <TableRow key={idx} sx={{ height: 28 }}>
                                  <TableCell sx={{ py: 0.5, fontSize: 13, width: 36 }}>
                                    <Checkbox
                                      size="small"
                                      checked={selectedEgresos.has(getEgresoKey(e, idx))}
                                      onChange={() => setSelectedEgresos((prev) => { const next = new Set(prev); const k = getEgresoKey(e, idx); if (next.has(k)) next.delete(k); else next.add(k); return next; })}
                                      inputProps={{ 'aria-label': 'Seleccionar egreso' }}
                                    />
                                  </TableCell>
                                    <TableCell sx={{ py: 0.5, fontSize: 13 }}>{formatFecha(e)}</TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                    {e.proveedor || "-"}
                                  </TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>
                                    {e.numeroDocumento || "-"}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontSize: 13 }}
                                  >
                                    {typeof e.montoUSD === "number" &&
                                      e.montoUSD > 0
                                      ? e.montoUSD.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })
                                      : "-"}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontSize: 13 }}
                                  >
                                    {typeof e.montoBs === "number" &&
                                      e.montoBs > 0
                                      ? e.montoBs.toLocaleString("de-DE", {
                                        minimumFractionDigits: 2,
                                      })
                                      : "-"}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontSize: 13 }}
                                  >
                                    {(e.tasaFactura || e.tasa)
                                      ? (e.tasaFactura || e.tasa).toLocaleString("de-DE", {
                                        minimumFractionDigits: 2,
                                      })
                                      : "-"}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
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
                      bgcolor: "#fff4e6",
                      minHeight: { xs: 44, sm: 36 },
                      "& .MuiAccordionSummary-content": { my: 0.5 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight={700} sx={{ color: '#b26a00' }} fontSize={15}>
                        GASTOS DE LA SEMANA
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0.5 }}>
                    <Box
                      sx={{
                        width: "100%",
                        overflowX: { xs: "auto", sm: "visible" },
                      }}
                    >
                      {isMobile ? (
                        <Box>
                          {gastosSemanaOrdenados.length === 0 ? (
                            <Typography align="center" color="text.secondary" sx={{ py: 1 }}>
                              Sin gastos registrados
                            </Typography>
                          ) : (
                            gastosSemanaOrdenados.map((g, idx) => (
                              <Paper key={g.id || idx} sx={{ p: 1.5, mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                                    {g.proveedor || g.descripcion || '-'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                    {formatFecha(g)}
                                  </Typography>
                                </Box>
                                {g.numeroDocumento && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    Doc: {g.numeroDocumento}
                                  </Typography>
                                )}
                                {g.descripcion && g.proveedor !== g.descripcion && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    {g.descripcion}
                                  </Typography>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="body2">
                                    <b>$</b> {typeof g.montoUSD === "number" && g.montoUSD > 0 ? g.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2 }) : '-'}
                                  </Typography>
                                  <Typography variant="body2">
                                    <b>Bs</b> {typeof g.montoBs === "number" && g.montoBs > 0 ? g.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : '-'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                    Tasa: {(g.tasaFactura || g.tasa)
                                      ? (g.tasaFactura || g.tasa).toLocaleString("de-DE", { minimumFractionDigits: 2 })
                                      : '-'}
                                  </Typography>
                                </Box>
                              </Paper>
                            ))
                          )}
                        </Box>
                      ) : (
                        <Table
                          component={Paper}
                          size="small"
                          sx={{ boxShadow: "none", mb: 0, minWidth: 560 }}
                        >
                          <TableHead>
                            <TableRow sx={{ height: 28 }}>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>Fecha</TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>Proveedor</TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>Descripción</TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: 13 }}>Factura/N-E</TableCell>
                              <TableCell align="right" sx={{ py: 0.5, fontSize: 13 }}>Monto ($)</TableCell>
                              <TableCell align="right" sx={{ py: 0.5, fontSize: 13 }}>Monto (Bs)</TableCell>
                              <TableCell align="right" sx={{ py: 0.5, fontSize: 13 }}>Tasa</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {gastosSemanaOrdenados.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 0.5, fontSize: 13 }}>
                                  Sin gastos registrados
                                </TableCell>
                              </TableRow>
                            ) : (
                              gastosSemanaOrdenados.map((g, idx) => (
                                <TableRow key={g.id || idx} sx={{ height: 28 }}>
                                  <TableCell sx={{ py: 0.5, fontSize: 13, whiteSpace: 'nowrap' }}>{formatFecha(g)}</TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>{g.proveedor || '-'}</TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13 }}>{g.descripcion || '-'}</TableCell>
                                  <TableCell sx={{ py: 0.5, fontSize: 13, whiteSpace: 'nowrap' }}>{g.numeroDocumento || '-'}</TableCell>
                                  <TableCell align="right" sx={{ py: 0.5, fontSize: 13, whiteSpace: 'nowrap' }}>
                                    {typeof g.montoUSD === "number" && g.montoUSD > 0
                                      ? g.montoUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })
                                      : '-'}
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 0.5, fontSize: 13, whiteSpace: 'nowrap' }}>
                                    {typeof g.montoBs === "number" && g.montoBs > 0
                                      ? g.montoBs.toLocaleString("de-DE", { minimumFractionDigits: 2 })
                                      : '-'}
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 0.5, fontSize: 13, whiteSpace: 'nowrap' }}>
                                    {(g.tasaFactura || g.tasa)
                                      ? (g.tasaFactura || g.tasa).toLocaleString("de-DE", { minimumFractionDigits: 2 })
                                      : '-'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
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
