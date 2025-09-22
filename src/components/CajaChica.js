import React, { useState, useEffect, useRef } from "react";
import { guardarMovimientoCajaChica, obtenerMovimientosCajaChica } from "../lib/cajaChicaFirebase";
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
} from "@mui/material";

export default function CajaChica({ tasaBCV }) {
  useEffect(() => {
    obtenerMovimientosCajaChica().then(movs => {
      setMovimientos(movs); // Ya vienen ordenados por fecha descendente
    });
  }, []);
  const [grupoVisible, setGrupoVisible] = useState('egreso');
  const [movimientos, setMovimientos] = useState([]);
  const [ingresoDesc, setIngresoDesc] = useState("");
  const [ingresoMontoUSD, setIngresoMontoUSD] = useState("");
  const [ingresoMontoBs, setIngresoMontoBs] = useState("");
  const [egresoDesc, setEgresoDesc] = useState("");
  const [egresoMontoUSD, setEgresoMontoUSD] = useState("");
  const [egresoMontoBs, setEgresoMontoBs] = useState("");

  // Calcular saldo
  const saldo = movimientos.reduce((acc, mov) => acc + mov.monto, 0);

  // Agregar ingreso
  const handleAgregarIngreso = async () => {
    const montoUSD = Number(ingresoMontoUSD);
    const montoBs = Number(ingresoMontoBs);
    if (!ingresoDesc || (!montoUSD && !montoBs)) return;
    const nuevoMov = {
      tipo: "Ingreso",
      descripcion: ingresoDesc,
      monto: montoUSD || (montoBs / tasaBCV),
      montoBs: montoBs || (montoUSD * tasaBCV),
      fecha: new Date().toLocaleDateString('es-VE'),
    };
    await guardarMovimientoCajaChica(nuevoMov);
  setMovimientos([nuevoMov, ...movimientos]);
    setIngresoDesc("");
    setIngresoMontoUSD("");
    setIngresoMontoBs("");
  };

  // Agregar egreso
  const handleAgregarEgreso = async () => {
    const montoUSD = Number(egresoMontoUSD);
    const montoBs = Number(egresoMontoBs);
    if (!egresoDesc || (!montoUSD && !montoBs)) return;
    const nuevoMov = {
      tipo: "Egreso",
      descripcion: egresoDesc,
      monto: -(montoUSD || (montoBs / tasaBCV)),
      montoBs: -(montoBs || (montoUSD * tasaBCV)),
      fecha: new Date().toLocaleDateString('es-VE'),
    };
    await guardarMovimientoCajaChica(nuevoMov);
  setMovimientos([nuevoMov, ...movimientos]);
    setEgresoDesc("");
    setEgresoMontoUSD("");
    setEgresoMontoBs("");
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Cuadre de Caja Chica
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
          Seleccione la operación:
        </Typography>
        <select
          value={grupoVisible}
          onChange={e => setGrupoVisible(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', color: '#757575', fontSize: '1rem', background: '#f5f5f5' }}
        >
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>
      </Box>
      {grupoVisible === 'ingreso' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} color="success.main" sx={{ mb: 1 }}>
            INGRESO
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Descripción"
              size="small"
              value={ingresoDesc}
              onChange={e => setIngresoDesc(e.target.value)}
              sx={{ flex: 2 }}
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
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary' }}
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
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary' }}
              inputProps={{ min: 0 }}
            />
            <Button
              variant="contained"
              color="success"
              onClick={handleAgregarIngreso}
              disabled={!ingresoDesc || (!ingresoMontoUSD && !ingresoMontoBs)}
            >
              Agregar
            </Button>
          </Box>
        </Box>
      )}
      {grupoVisible === 'egreso' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} color="error" sx={{ mb: 1 }}>
            EGRESO
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Descripción"
              size="small"
              value={egresoDesc}
              onChange={e => setEgresoDesc(e.target.value)}
              sx={{ flex: 2 }}
            />
            <TextField
              label="Monto ($)"
              type="number"
              size="small"
              value={egresoMontoUSD}
              onChange={e => {
                const val = e.target.value;
                setEgresoMontoUSD(val);
                if (val !== "" && !isNaN(Number(val))) {
                  setEgresoMontoBs((Number(val) * tasaBCV).toFixed(2));
                } else {
                  setEgresoMontoBs("");
                }
              }}
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary' }}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Monto (Bs)"
              type="number"
              size="small"
              value={egresoMontoBs}
              onChange={e => {
                const val = e.target.value;
                setEgresoMontoBs(val);
                if (val !== "" && !isNaN(Number(val))) {
                  setEgresoMontoUSD((Number(val) / tasaBCV).toFixed(2));
                } else {
                  setEgresoMontoUSD("");
                }
              }}
              sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary' }}
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
      )}
      <Table component={Paper} size="small" sx={{ mb: 2 }}>
        {/* TableHead para saldo */}
        <TableHead>
          <TableRow>
            <TableCell colSpan={3} sx={{ fontWeight: 700, bgcolor: '#e0f7fa' }}>Saldo Caja Chica</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', bgcolor: '#e0f7fa' }}>
              {saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', bgcolor: '#e0f7fa' }}>
              {(saldo * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
            </TableCell>
          </TableRow>
        </TableHead>
        {/* TableHead para columnas */}
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell align="right">Monto ($)</TableCell>
            <TableCell align="right">Monto (Bs)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movimientos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                Sin movimientos
              </TableCell>
            </TableRow>
          ) : (
            movimientos.map((mov, idx) => (
              <TableRow key={idx}>
                <TableCell>{mov.fecha}</TableCell>
                <TableCell>{mov.tipo}</TableCell>
                <TableCell>{mov.descripcion || "-"}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {mov.tipo === "Ingreso" ? "+" : "-"}{Math.abs(mov.monto).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {mov.tipo === "Ingreso" ? "+" : "-"}{Math.abs(mov.montoBs || mov.monto * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
