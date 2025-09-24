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
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
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

      // Seleccionar el día de hoy por defecto si existe, si no el más reciente
      const hoy = new Date();
      const hoyStr = `${String(hoy.getDate()).padStart(2, "0")}/${String(
        hoy.getMonth() + 1
      ).padStart(2, "0")}/${hoy.getFullYear()}`;
      const fechas = Object.keys(agrupados).sort((a, b) => {
        const fa = Date.parse(a.split("/").reverse().join("-"));
        const fb = Date.parse(b.split("/").reverse().join("-"));
        return fb - fa;
      });
      if (fechas.includes(hoyStr)) {
        setFechaSeleccionada(hoyStr);
      } else if (fechas.length > 0) {
        setFechaSeleccionada(fechas[0]);
      }
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
    <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Resumen diario
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* <Typography variant="subtitle1">Selecciona el día:</Typography> */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Día"
              value={(() => {
                const hoy = dayjs().startOf("day");
                const hoyStr = `${hoy.date().toString().padStart(2, "0")}/${(
                  hoy.month() + 1
                )
                  .toString()
                  .padStart(2, "0")}/${hoy.year()}`;
                if (
                  !fechaSeleccionada &&
                  Object.keys(datosPorDia).includes(hoyStr)
                ) {
                  setFechaSeleccionada(hoyStr);
                  return hoy;
                }
                if (fechaSeleccionada) {
                  const partes = fechaSeleccionada.split("/");
                  return dayjs(`${partes[2]}-${partes[1]}-${partes[0]}`);
                }
                return null;
              })()}
              onChange={(date) => {
                if (date && dayjs(date).isValid()) {
                  const d = String(dayjs(date).date()).padStart(2, "0");
                  const m = String(dayjs(date).month() + 1).padStart(2, "0");
                  const y = dayjs(date).year();
                  const fechaStr = `${d}/${m}/${y}`;
                  if (Object.keys(datosPorDia).includes(fechaStr)) {
                    setFechaSeleccionada(fechaStr);
                  }
                }
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" sx={{ minWidth: 120 }} />
              )}
              disableFuture
              views={["year", "month", "day"]}
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
              maxDate={dayjs().startOf("day")}
              shouldDisableDate={(date) => {
                if (!dayjs(date).isValid()) return true;
                const d = String(dayjs(date).date()).padStart(2, "0");
                const m = String(dayjs(date).month() + 1).padStart(2, "0");
                const y = dayjs(date).year();
                const fechaStr = `${d}/${m}/${y}`;
                return !Object.keys(datosPorDia).includes(fechaStr);
              }}
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
          {fechaSeleccionada &&
            Object.keys(datosPorDia).includes(fechaSeleccionada) &&
            datosPorDia[fechaSeleccionada] &&
            (() => {
              const { ingresos, egresos } = datosPorDia[fechaSeleccionada];
              const cierre = cierresPorDia[fechaSeleccionada];
              // Si hay cierre, mostrar la tasa guardada; si no, mostrar la tasaBCV recibida por prop
              let tasaDia = cierre?.tasa ?? tasaBCV;
              let totalIngresosUSD =
                cierre?.totalIngresosUSD ??
                ingresos.reduce(
                  (acc, i) => acc + Number(i.montoUSD || i.monto || 0),
                  0
                );
              let totalIngresosBs =
                cierre?.totalIngresosBs ??
                (tasaDia
                  ? totalIngresosUSD * tasaDia
                  : ingresos.reduce(
                      (acc, i) => acc + (Number(i.montoBs) || 0),
                      0
                    ));
              let totalEgresosUSD =
                cierre?.totalEgresosUSD ??
                egresos.reduce((acc, e) => acc + (Number(e.montoUSD) || 0), 0);
              let totalEgresosBs =
                cierre?.totalEgresosBs ??
                (tasaDia
                  ? totalEgresosUSD * tasaDia
                  : egresos.reduce(
                      (acc, e) => acc + (Number(e.montoBs) || 0),
                      0
                    ));
              let utilidadUSD =
                cierre?.utilidadUSD ?? totalIngresosUSD - totalEgresosUSD;
              let utilidadBs =
                cierre?.utilidadBs ??
                (tasaDia
                  ? utilidadUSD * tasaDia
                  : totalIngresosBs - totalEgresosBs);

              // Agrupar ingresos por forma de pago
              const pagosPorForma = ingresos.reduce((acc, i) => {
                const forma = i.formaPago || "Sin especificar";
                if (!acc[forma]) acc[forma] = 0;
                acc[forma] += Number(i.montoUSD || i.monto || 0);
                return acc;
              }, {});

              return (
                <Box key={fechaSeleccionada} sx={{ mb: 4 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ mb: 1 }}
                  >
                    Fecha: {fechaSeleccionada}
                  </Typography>
                  <Paper sx={{ p: 2, mb: 2, bgcolor: "#f5f5f5" }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography>
                        <b>Ingresos totales:</b> ${" "}
                        {totalIngresosUSD.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        | Bs.{" "}
                        {totalIngresosBs.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 2 }}
                      >
                        Tasa BCV:{" "}
                        {cierre?.tasa
                          ? `${cierre.tasa.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                            })} (guardada)`
                          : tasaDia
                          ? `${tasaDia.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                            })}`
                          : "No disponible"}
                      </Typography>
                    </Box>
                    {/* Mostrar montos por forma de pago como subtítulo */}
                    <Box sx={{ mb: 1, mt: 1 }}>
                      {Object.entries(pagosPorForma)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([forma, monto]) => (
                          <Typography
                            key={forma}
                            variant="body2"
                            sx={{ mb: 0.5, pl: 1 }}
                          >
                            <b>{forma}: </b>
                            {forma === "Sin especificar" ? (
                              <span
                                style={{ color: "#d32f2f", fontWeight: 700 }}
                              >
                                $
                                {monto.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <>
                                $
                                {monto.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </>
                            )}
                            {" | Bs. "}
                            <span
                              style={
                                forma === "Sin especificar"
                                  ? { color: "#d32f2f", fontWeight: 700 }
                                  : {}
                              }
                            >
                              {(monto * tasaDia).toLocaleString("de-DE", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </Typography>
                        ))}
                    </Box>
                    <Typography>
                      <b>Egresos totales:</b> ${" "}
                      {totalEgresosUSD.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      | Bs.{" "}
                      {totalEgresosBs.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                      })}
                    </Typography>
                    <Typography>
                      <b>Utilidad:</b> ${" "}
                      {utilidadUSD.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      | Bs.{" "}
                      {utilidadBs.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                      })}
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
                      <Table
                        component={Paper}
                        size="small"
                        sx={{ boxShadow: "none", mb: 0 }}
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
                                  {(i.monto || i.montoUSD).toLocaleString(
                                    "en-US",
                                    { minimumFractionDigits: 2 }
                                  )}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ py: 0.5, fontSize: 13 }}
                                >
                                  {(i.montoBs && i.montoBs > 0
                                    ? i.montoBs
                                    : (i.montoUSD || i.monto || 0) * tasaDia
                                  ).toLocaleString("de-DE", {
                                    minimumFractionDigits: 2,
                                  })}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
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
                      <Table
                        component={Paper}
                        size="small"
                        sx={{ boxShadow: "none", mb: 0 }}
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
                                    : (e.montoUSD || 0) * (e.tasa || tasaDia)
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
