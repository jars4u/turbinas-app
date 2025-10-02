import React, { useState, useEffect } from "react";
import { obtenerFondoCajaChica } from "../lib/configuracionCajaChicaFirebase";
import { Timestamp, getFirestore, doc, deleteDoc } from "firebase/firestore";
import {
  guardarMovimientoCajaChica,
  obtenerMovimientosCajaChica,
} from "../lib/cajaChicaFirebase";
import { guardarEgreso } from "../lib/egresosFirebase";
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
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

export default function CajaChica({ tasaBCV, isOwner }) {
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  // Reponer movimiento: eliminar de caja chica y agregar a egresos
  const handleReponer = async (mov) => {
    // Eliminar movimiento de caja chica
    if (!mov.id) return;
    const db = getFirestore();
    await deleteDoc(doc(db, "cajaChicaMovimientos", mov.id));
    // Agregar a egresos con fecha como Timestamp
    await guardarEgreso({
      descripcion: mov.descripcion,
      montoUSD: Math.abs(mov.monto),
      montoBs: Math.abs(mov.montoBs || mov.monto * tasaBCV),
      tasa: tasaBCV,
      fecha: Timestamp.now(),
    });
    // Actualizar lista de movimientos
    const nuevosMovs = await obtenerMovimientosCajaChica();
    setMovimientos(nuevosMovs);
    setSnackMsg(
      `Se agregó la ${mov.descripcion} del movimiento a egresos del día`
    );
    setSnackOpen(true);
  };
  const [fondoCajaChica, setFondoCajaChica] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([obtenerMovimientosCajaChica(), obtenerFondoCajaChica()]).then(
      ([movs, fondo]) => {
        setMovimientos(movs);
        setFondoCajaChica(fondo);
        setLoading(false);
      }
    );
  }, []);
  const [movimientos, setMovimientos] = useState([]); // Keeping movimientos state
  const [egresoDesc, setEgresoDesc] = useState(""); // Keeping egresoDesc state
  const [egresoMontoUSD, setEgresoMontoUSD] = useState(""); // Keeping egresoMontoUSD state
  const [egresoMontoBs, setEgresoMontoBs] = useState(""); // Keeping egresoMontoBs state

  // Calcular saldo: fondo menos la suma de los movimientos
  const saldo =
    (fondoCajaChica !== null ? Number(fondoCajaChica) : 0) +
    movimientos.reduce((acc, mov) => acc + mov.monto, 0);

  // Agregar ingreso
  // Removed unused variables and function related to ingreso

  // Agregar egreso
  const handleAgregarEgreso = async () => {
    const montoUSD = Number(egresoMontoUSD);
    const montoBs = Number(egresoMontoBs);
    if (!egresoDesc || (!montoUSD && !montoBs)) return;
    const nuevoMov = {
      tipo: "Egreso",
      descripcion: egresoDesc ? egresoDesc.toUpperCase() : '',
      monto: -(montoUSD || montoBs / tasaBCV),
      montoBs: -(montoBs || montoUSD * tasaBCV),
      fecha: new Date().toLocaleDateString("es-VE"),
    };
    await guardarMovimientoCajaChica(nuevoMov);
    setMovimientos([nuevoMov, ...movimientos]);
    setEgresoDesc("");
    setEgresoMontoUSD("");
    setEgresoMontoBs("");
  };

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 0, sm: 2 } }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Cuadre de Caja Chica
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {/* Box combinado para fondo y saldo */}
      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ bgcolor: '#fffde7', borderRadius: 1, p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={600} color="primary" sx={{ minWidth: 100 }}>
            Fondo caja chica:
          </Typography>
          <Typography variant="body2" fontWeight={600} color="primary">
            $ {fondoCajaChica !== null ? Number(fondoCajaChica).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "--"}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="primary">
            | Bs. {fondoCajaChica !== null ? (Number(fondoCajaChica) * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "--"}
          </Typography>
        </Box>
        <Box sx={{ bgcolor: '#e0f7fa', borderRadius: 1, p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ minWidth: 100 }}>
            Saldo caja chica:
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            $ {saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            | Bs. {(saldo * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </Typography>
        </Box>
      </Box>

      {/* xs: Accordion, sm+: bloque normal */}
      <Box sx={{ display: { xs: 'none', sm: 'block' }, mb: 2 }}>
        <Typography
          variant="subtitle2"
          fontWeight={600}
          color="error"
          sx={{ mb: 1 }}
        >
          SALIDAS
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            label="Descripción"
            size="small"
            value={egresoDesc}
            onChange={(e) => setEgresoDesc(e.target.value)}
            sx={{ flex: 2 }}
          />
          <TextField
            label="Monto ($)"
            type="number"
            size="small"
            value={egresoMontoUSD}
            onChange={(e) => {
              const val = e.target.value;
              setEgresoMontoUSD(val);
              if (val !== "" && !isNaN(Number(val))) {
                setEgresoMontoBs((Number(val) * tasaBCV).toFixed(2));
              } else {
                setEgresoMontoBs("");
              }
            }}
            sx={{ flex: 1, bgcolor: "#f5f5f5", color: "text.secondary" }}
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Monto (Bs)"
            type="number"
            size="small"
            value={egresoMontoBs}
            onChange={(e) => {
              const val = e.target.value;
              setEgresoMontoBs(val);
              if (val !== "" && !isNaN(Number(val))) {
                setEgresoMontoUSD((Number(val) / tasaBCV).toFixed(2));
              } else {
                setEgresoMontoUSD("");
              }
            }}
            sx={{ flex: 1, bgcolor: "#f5f5f5", color: "text.secondary" }}
            inputProps={{ min: 0 }}
          />
          <Button
            variant="contained"
            color="error"
            onClick={handleAgregarEgreso}
            disabled={!egresoDesc || (!egresoMontoUSD && !egresoMontoBs)}
          >
            Agregar
          </Button>
        </Box>
      </Box>
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}>
        <Accordion>
          <AccordionSummary expandIcon={<span>▼</span>}>
            <Typography variant="subtitle2" fontWeight={600} color="error">Agregar salida de caja chica</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Descripción"
                size="small"
                value={egresoDesc}
                onChange={(e) => setEgresoDesc(e.target.value)}
                sx={{ mb: 1 }}
              />
              <TextField
                label="Monto ($)"
                type="number"
                size="small"
                value={egresoMontoUSD}
                onChange={(e) => {
                  const val = e.target.value;
                  setEgresoMontoUSD(val);
                  if (val !== "" && !isNaN(Number(val))) {
                    setEgresoMontoBs((Number(val) * tasaBCV).toFixed(2));
                  } else {
                    setEgresoMontoBs("");
                  }
                }}
                sx={{ mb: 1, bgcolor: "#f5f5f5", color: "text.secondary" }}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Monto (Bs)"
                type="number"
                size="small"
                value={egresoMontoBs}
                onChange={(e) => {
                  const val = e.target.value;
                  setEgresoMontoBs(val);
                  if (val !== "" && !isNaN(Number(val))) {
                    setEgresoMontoUSD((Number(val) / tasaBCV).toFixed(2));
                  } else {
                    setEgresoMontoUSD("");
                  }
                }}
                sx={{ mb: 1, bgcolor: "#f5f5f5", color: "text.secondary" }}
                inputProps={{ min: 0 }}
              />
              <Button
                variant="contained"
                color="error"
                onClick={handleAgregarEgreso}
                disabled={!egresoDesc || (!egresoMontoUSD && !egresoMontoBs)}
                sx={{ mb: 1 }}
              >
                Agregar
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
      <Box sx={{ width: '100%', overflowX: { xs: 'auto', sm: 'visible' } }}>
        <Table component={Paper} size="small" sx={{ mb: 2 }}>
        {/* Boxes para fondo y saldo fuera de la tabla */}
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 120,
              }}
            >
              Fecha
            </TableCell>
            <TableCell
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 180,
              }}
            >
              Descripción
            </TableCell>
            <TableCell
              align="right"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 100,
              }}
            >
              Monto ($)
            </TableCell>
            <TableCell
              align="right"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 120,
              }}
            >
              Monto (Bs)
            </TableCell>
            <TableCell
              align="center"
              sx={{ whiteSpace: "nowrap", maxWidth: 100 }}
            >
              Reposición
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ p: 0 }}>
                <LinearProgress sx={{ width: "100%" }} />
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* Fila fondo caja chica movida al TableHead */}
              {movimientos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{ color: "text.secondary" }}
                  >
                    Sin movimientos
                  </TableCell>
                </TableRow>
              ) : (
                movimientos.map((mov, idx) => (
                  <TableRow key={mov.id || idx}>
                    <TableCell
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 120,
                      }}
                    >
                      {mov.fecha && typeof mov.fecha === "string"
                        ? (() => {
                            const parts = mov.fecha.split(/[/-]/);
                            if (parts.length === 3) {
                              return `${parts[0].padStart(
                                2,
                                "0"
                              )}/${parts[1].padStart(2, "0")}/${parts[2]}`;
                            }
                            return mov.fecha;
                          })()
                        : mov.fecha && mov.fecha.seconds
                        ? new Date(mov.fecha.seconds * 1000).toLocaleDateString(
                            "es-VE",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            }
                          )
                        : "-"}
                    </TableCell>
                    <TableCell
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 180,
                      }}
                    >
                      {mov.descripcion || "-"}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 100,
                      }}
                    >
                      {mov.tipo === "Ingreso" ? "+" : "-"}
                      {Math.abs(mov.monto).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 120,
                      }}
                    >
                      {mov.tipo === "Ingreso" ? "+" : "-"}
                      {Math.abs(
                        mov.montoBs || mov.monto * tasaBCV
                      ).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => isOwner && handleReponer(mov)}
                        disabled={!isOwner}
                        title={isOwner ? '' : 'Solo el Owner puede reponer a egresos'}
                      >
                        Reponer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </>
          )}
        </TableBody>
        </Table>
      </Box>
      <Snackbar
        open={snackOpen}
        autoHideDuration={3500}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={() => setSnackOpen(false)}
          severity="success"
        >
          {snackMsg}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
}
